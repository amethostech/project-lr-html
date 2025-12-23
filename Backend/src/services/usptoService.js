import fetch from 'node-fetch';
import https from 'https';

// USPTO DSAPI Configuration
const BASE_URL = "https://developer.uspto.gov/ds-api";
const DATASET = "enriched_cited_reference_metadata";
const VERSION = "v3";

/**
 * Search USPTO DSAPI using keywords.
 * 
 * @param {string[]} keywords - List of keywords to search for
 * @param {string} operator - Boolean operator ("AND" or "OR")
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Object>} Dictionary with results and metadata
 */
export async function searchUsptoDsapi(keywords, operator = "AND", limit = 100) {
    if (!keywords || keywords.length === 0) {
        return { error: "No keywords provided", results: [], total: 0 };
    }
    // Build Lucene query
    let criteria;
    if (operator.toUpperCase() === "AND") {
        // Search for all keywords
        const queryParts = keywords.map(kw => `*:${kw}*`);
        criteria = queryParts.join(" AND ");
    } else {
        // OR operator
        const queryParts = keywords.map(kw => `*:${kw}*`);
        criteria = queryParts.join(" OR ");
    }

    const url = `${BASE_URL}/${DATASET}/${VERSION}/records`;

    // Prepare form data
    const formData = new URLSearchParams();
    formData.append("criteria", criteria);
    formData.append("start", "0");
    formData.append("rows", String(Math.min(limit, 10000)));

    const headers = {
        "Accept": "application/json"
    };

    // Create HTTPS agent that doesn't verify certificates
    // For node-fetch v3, we use the agent option
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: formData,
            // @ts-ignore - node-fetch v3 supports agent
            agent: httpsAgent
        });

        if (response.status === 200) {
            const data = await response.json();

            // Extract records
            if (data.response) {
                const docs = data.response.docs || [];
                const numFound = data.response.numFound || 0;
                return {
                    results: docs,
                    total: numFound,
                    shown: docs.length,
                    query: criteria
                };
            } else if (data.docs) {
                return {
                    results: data.docs,
                    total: data.docs.length,
                    shown: data.docs.length,
                    query: criteria
                };
            } else {
                return {
                    results: typeof data === 'object' ? [data] : [],
                    total: typeof data === 'object' ? 1 : 0,
                    shown: typeof data === 'object' ? 1 : 0,
                    query: criteria
                };
            }
        } else {
            const errorText = await response.text();
            return {
                error: `API Error ${response.status}: ${errorText}`,
                results: [],
                total: 0
            };
        }
    } catch (error) {
        return {
            error: `Error making request: ${error.message}`,
            results: [],
            total: 0
        };
    }
}
