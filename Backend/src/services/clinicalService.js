import axios from "axios";
import dotenv from "dotenv";
import { logInfo } from "../utils/logger.js";

dotenv.config();

const BASE_URL = process.env.CLINICAL_BASE_URL || "https://clinicaltrials.gov/api/v2/studies";
const DEFAULT_PAGE_SIZE = Number(process.env.PAGE_SIZE) || 50;
const DEFAULT_MAX_PAGES = Number(process.env.DEFAULT_MAX_PAGES) || 2;

/**
 * Options: { keywords: string[], customQuery?: string, pageSize?: number, phase?: string, status?: string, sponsor_type?: string }
 * Returns: { raw: Array, formatted: Array }
 * Paginates through ALL pages until no nextPageToken is returned.
 */
export async function fetchStudies(options = {}) {
  const { keywords = [], customQuery, pageSize = DEFAULT_PAGE_SIZE, phase, status, sponsor_type } = options;

  const query = customQuery || keywords.join(" ").trim();
  let pageToken = null;
  const allStudies = [];
  const MAX_SAFETY_PAGES = 200; // Safety limit to prevent infinite loops
  let pageCount = 0;

  while (pageCount < MAX_SAFETY_PAGES) {
    const params = {
      format: "json",
      pageSize
    };
    if (query) params["query.term"] = query;
    if (pageToken) params["pageToken"] = pageToken;

    // Apply filters if provided
    if (phase && phase !== 'Any') {
      // Map "Phase 1" -> "PHASE1", "Phase 2" -> "PHASE2", etc.
      const phaseMap = { 'Phase 1': 'PHASE1', 'Phase 2': 'PHASE2', 'Phase 3': 'PHASE3', 'Phase 4': 'PHASE4' };
      const mappedPhase = phaseMap[phase] || phase;
      params["filter.phase"] = mappedPhase;
    }
    if (status && status !== 'Any') {
      // Map "Recruiting" -> "RECRUITING", "Completed" -> "COMPLETED", etc.
      params["filter.overallStatus"] = status.toUpperCase().replace(/ /g, '_');
    }

    const resp = await axios.get(BASE_URL, { params, timeout: 60_000 });
    if (resp.status !== 200) {
      throw new Error(`ClinicalTrials.gov returned ${resp.status}`);
    }

    const data = resp.data || {};
    const studies = data.studies || [];
    allStudies.push(...studies);
    pageCount++;

    logInfo(`[Clinical] Page ${pageCount}: fetched ${studies.length} studies (total so far: ${allStudies.length})`);

    pageToken = data.nextPageToken;
    if (!pageToken) break; // No more pages
  }

  // Full field extraction
  const formatted = allStudies.map((study) => {
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
  });

  logInfo(`Fetched ${allStudies.length} raw items across ${pageCount} pages, returning ${formatted.length} formatted items`);
  return { raw: allStudies, formatted };
}
