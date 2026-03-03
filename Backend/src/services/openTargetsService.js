import axios from "axios";
import { logInfo, logError } from "../utils/logger.js";

const OPENTARGETS_API_URL = "https://api.platform.opentargets.org/api/v4/graphql";

/**
 * Confirm a target using OpenTargets GraphQL API.
 * @param {string} targetName - The name of the target to confirm (e.g. "EGFR")
 * @returns {Promise<Array>} List of matched targets
 */
export async function confirmTarget(targetName) {
  const query = `
    query searchTarget($queryString: String!) {
      search(queryString: $queryString, entityNames: ["target"], page: { index: 0, size: 5 }) {
        total
        hits {
          id
          name
          description
          entity
        }
      }
    }
  `;

  const variables = {
    queryString: targetName
  };

  try {
    logInfo(`[OpenTargets] Searching for target: ${targetName}`);
    const response = await axios.post(OPENTARGETS_API_URL, {
      query,
      variables
    }, { timeout: 15000 });

    const data = response.data.data;
    if (data && data.search && data.search.hits) {
      return data.search.hits.map(hit => ({
        TargetID: hit.id,
        Name: hit.name,
        Description: hit.description || "N/A",
        Source: "OpenTargets"
      }));
    }
    return [];
  } catch (error) {
    logError(`[OpenTargets] Error fetching target ${targetName}`, error);
    return [];
  }
}
