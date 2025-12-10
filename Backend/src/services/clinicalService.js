import axios from "axios";
import dotenv from "dotenv";
import { logInfo } from "../utils/logger.js";

dotenv.config();

const BASE_URL = process.env.CLINICAL_BASE_URL || "https://clinicaltrials.gov/api/v2/studies";
const DEFAULT_PAGE_SIZE = Number(process.env.PAGE_SIZE) || 50;
const DEFAULT_MAX_PAGES = Number(process.env.DEFAULT_MAX_PAGES) || 2;

/**
 * Options: { keywords: string[], maxPages?: number, pageSize?: number }
 * Returns: { raw: Array, formatted: Array }
 */
export async function fetchStudies(options = {}) {
  const { keywords = [], customQuery, maxPages = DEFAULT_MAX_PAGES, pageSize = DEFAULT_PAGE_SIZE } = options;

  const query = customQuery || keywords.join(" ").trim();
  let pageToken = null;
  const allStudies = [];

  for (let i = 0; i < maxPages; i++) {
    const params = {
      format: "json",
      pageSize
    };
    if (query) params["query.term"] = query;
    if (pageToken) params["pageToken"] = pageToken;

    const resp = await axios.get(BASE_URL, { params, timeout: 60_000 });
    if (resp.status !== 200) {
      throw new Error(`ClinicalTrials.gov returned ${resp.status}`);
    }

    const data = resp.data || {};
    const studies = data.studies || [];
    allStudies.push(...studies);

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  // Minimal formatting for client (you can expand later)
  const formatted = allStudies.map((study) => {
    const protocol = study.protocolSection || {};
    return {
      id: protocol.identificationModule?.nctId || "",
      title: protocol.identificationModule?.briefTitle || "",
      officialTitle: protocol.identificationModule?.officialTitle || "",
      sponsor: protocol.sponsorCollaboratorsModule?.leadSponsor?.name || "",
      status: protocol.statusModule?.overallStatus || ""
    };
  });

  logInfo(`Fetched ${allStudies.length} raw items, returning ${formatted.length} formatted items`);
  return { raw: allStudies, formatted };
}
