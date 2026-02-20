import axios from "axios";
import dotenv from "dotenv";
import { logInfo, logError } from "../utils/logger.js";

dotenv.config();

const BASE_URL = process.env.CLINICAL_BASE_URL || "https://clinicaltrials.gov/api/v2/studies";
const DEFAULT_PAGE_SIZE = Number(process.env.PAGE_SIZE) || 50;
// Max results cap — configurable via env. With formatted-only accumulation (~200 bytes/study),
// even 10K results use only ~2MB of memory. Safe for Render free tier.
const DEFAULT_MAX_RESULTS = Number(process.env.CLINICAL_MAX_RESULTS) || 10000;

/**
 * Format a single raw study into a flat object with all 13 required fields.
 * Called per-page to avoid keeping raw data in memory.
 */
function formatStudy(study) {
  const protocol = study.protocolSection || {};
  const idModule = protocol.identificationModule || {};
  const statusModule = protocol.statusModule || {};
  const sponsorModule = protocol.sponsorCollaboratorsModule || {};
  const designModule = protocol.designModule || {};
  const conditionsModule = protocol.conditionsModule || {};
  const armsModule = protocol.armsInterventionsModule || {};
  const contactsModule = protocol.contactsLocationsModule || {};
  const outcomesModule = protocol.outcomesModule || {};

  const nctId = idModule.nctId || "";

  return {
    id: nctId,
    title: idModule.briefTitle || "",
    officialTitle: idModule.officialTitle || "",
    status: statusModule.overallStatus || "",
    conditions: (conditionsModule.conditions || []).join("; "),
    interventions: (armsModule.interventions || []).map(i => `${i.type || ''}: ${i.name || ''}`).join("; "),
    sponsor: sponsorModule.leadSponsor?.name || "",
    phases: (designModule.phases || []).join(", "),
    studyType: designModule.studyType || "",
    startDate: statusModule.startDateStruct?.date || "",
    completionDate: statusModule.completionDateStruct?.date || "",
    locations: (contactsModule.locations || []).map(l => `${l.facility || ''}, ${l.city || ''}, ${l.country || ''}`).join("; "),
    primaryOutcomes: (outcomesModule.primaryOutcomes || []).map(o => o.measure || '').join("; "),
    url: `https://clinicaltrials.gov/study/${nctId}`,
    source: 'ClinicalTrials.gov'
  };
}

/**
 * Fetch studies from ClinicalTrials.gov with memory-efficient page-by-page processing.
 *
 * Key design decisions for memory efficiency:
 * - Each page is fetched, formatted immediately, then raw data is discarded
 * - Only formatted results (flat objects, ~200 bytes each) are accumulated
 * - Raw API responses (~10-20KB per study) are NOT retained
 * - maxResults cap prevents unbounded growth (default 2000, configurable via env)
 */
/**
 * Options: { keywords, customQuery, pageSize, maxResults, phase, status, sponsor_type, intervention, condition }
 * Returns: { formatted: Array, totalFetched: number, pageCount: number }
 */
export async function fetchStudies(options = {}) {
  const {
    keywords = [],
    customQuery,
    pageSize = DEFAULT_PAGE_SIZE,
    maxResults = DEFAULT_MAX_RESULTS,
    phase,
    status,
    sponsor_type,
    intervention,
    condition
  } = options;

  const query = customQuery || keywords.join(" ").trim();
  let pageToken = null;
  const formatted = [];
  const MAX_SAFETY_PAGES = 200;
  let pageCount = 0;

  const filterParams = {};

  if (status && status !== 'Any') {
    filterParams["filter.overallStatus"] = status.toUpperCase().replace(/[, ]+/g, '_');
  }

  if (condition) {
    filterParams["query.cond"] = condition;
  }

  const advancedParts = [];

  if (phase && phase !== 'Any') {
    const phaseMap = {
      'Phase 1': 'PHASE1',
      'Phase 2': 'PHASE2',
      'Phase 3': 'PHASE3',
      'Phase 4': 'PHASE4',
      'Early Phase 1': 'EARLY_PHASE1'
    };
    const mapped = phaseMap[phase] || phase.toUpperCase().replace(/ /g, '_');
    advancedParts.push(`AREA[Phase]${mapped}`);
  }

  if (intervention && intervention !== 'Any') {

    const intMap = {
      'Biological/Vaccine': 'BIOLOGICAL',
      'Procedure/Surgery': 'PROCEDURE',
      'Dietary Supplement': 'DIETARY_SUPPLEMENT',
      'Combination Product': 'COMBINATION',
      'Diagnostic Test': 'DIAGNOSTIC'
    };
    const mapped = intMap[intervention] || intervention.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    advancedParts.push(`AREA[InterventionType]${mapped}`);
  }

  if (sponsor_type && sponsor_type !== 'Any') {

    const sponsorMap = {
      'Industry': 'AREA[LeadSponsorClass]INDUSTRY',
      'Academic': 'AREA[LeadSponsorClass]OTHER',
      'Govt': '(AREA[LeadSponsorClass]NIH OR AREA[LeadSponsorClass]FED)',
      'NIH': 'AREA[LeadSponsorClass]NIH'
    };
    advancedParts.push(sponsorMap[sponsor_type] || `AREA[LeadSponsorClass]${sponsor_type.toUpperCase()}`);
  }

  if (advancedParts.length > 0) {
    filterParams["filter.advanced"] = advancedParts.join(' AND ');
  }

  logInfo(`[Clinical] Filters: ${JSON.stringify(filterParams)}`);

  while (pageCount < MAX_SAFETY_PAGES) {
    const params = {
      format: "json",
      pageSize,
      ...filterParams
    };
    if (query) params["query.term"] = query;
    if (pageToken) params["pageToken"] = pageToken;

    const resp = await axios.get(BASE_URL, { params, timeout: 60_000 });
    if (resp.status !== 200) {
      throw new Error(`ClinicalTrials.gov returned ${resp.status}`);
    }

    const data = resp.data || {};
    const studies = data.studies || [];
    pageCount++;

    for (const study of studies) {
      formatted.push(formatStudy(study));
    }

    logInfo(`[Clinical] Page ${pageCount}: fetched ${studies.length} studies (formatted total: ${formatted.length})`);

    if (formatted.length >= maxResults) {
      logInfo(`[Clinical] Reached maxResults cap (${maxResults}), stopping pagination`);
      break;
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  const trimmed = formatted.length > maxResults ? formatted.slice(0, maxResults) : formatted;

  logInfo(`[Clinical] Done: ${trimmed.length} formatted results across ${pageCount} pages`);
  return { formatted: trimmed, totalFetched: trimmed.length, pageCount };
}
