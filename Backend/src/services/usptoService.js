import fetch from 'node-fetch';
import https from 'https';
import { logInfo, logError } from '../utils/logger.js';

// ======================== PatentsView API ========================
// Using PatentsView API which returns full patent data with proper fields
const PATENTSVIEW_URL = "https://api.patentsview.org/patents/query";

/**
 * Search patents using the PatentsView API.
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

    // Try PatentsView first, fallback to DS-API
    try {
        const pvResult = await searchPatentsView(keywords, operator, limit);
        if (pvResult.results.length > 0) return pvResult;
    } catch (e) {
        logError('[USPTO] PatentsView failed, trying DS-API fallback', e);
    }

    // Fallback to DS-API
    return await searchDsApi(keywords, operator, limit);
}

/**
 * Search using PatentsView API (returns proper patent fields)
 */
async function searchPatentsView(keywords, operator, limit) {
    // Build the query object for PatentsView
    const op = operator.toUpperCase() === "AND" ? "_and" : "_or";
    const conditions = keywords.map(kw => ({
        "_text_any": { "patent_abstract": kw }
    }));

    // If only one keyword, also search in title
    const titleConditions = keywords.map(kw => ({
        "_text_any": { "patent_title": kw }
    }));

    const query = {
        "_or": [
            { [op]: conditions },
            { [op]: titleConditions }
        ]
    };

    const body = {
        q: query,
        f: [
            "patent_number", "patent_title", "patent_abstract",
            "patent_date", "assignee_organization",
            "inventor_first_name", "inventor_last_name"
        ],
        o: { "per_page": Math.min(limit, 100) },
        s: [{ "patent_date": "desc" }]
    };

    logInfo(`[USPTO PatentsView] Searching for: ${keywords.join(', ')}`);

    const response = await fetch(PATENTSVIEW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        timeout: 30000
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`PatentsView returned ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const patents = data.patents || [];
    const totalFound = data.total_patent_count || patents.length;

    logInfo(`[USPTO PatentsView] Found ${totalFound} patents, returned ${patents.length}`);

    const results = patents.map(p => ({
        patentNumber: p.patent_number || 'N/A',
        title: p.patent_title || 'N/A',
        abstract: p.patent_abstract || 'N/A',
        date: p.patent_date || 'N/A',
        assignee: (p.assignees || []).map(a => a.assignee_organization || 'N/A').join('; ') || 'N/A',
        inventors: (p.inventors || []).map(i => `${i.inventor_first_name || ''} ${i.inventor_last_name || ''}`.trim()).join('; ') || 'N/A'
    }));

    return {
        results,
        total: totalFound,
        shown: results.length,
        query: keywords.join(` ${operator} `)
    };
}

/**
 * Fallback: Search using USPTO DS-API (enriched_cited_reference_metadata)
 */
async function searchDsApi(keywords, operator, limit) {
    const BASE_URL = "https://developer.uspto.gov/ds-api";
    const DATASET = "enriched_cited_reference_metadata";
    const VERSION = "v3";

    let criteria;
    if (operator.toUpperCase() === "AND") {
        const queryParts = keywords.map(kw => `*:${kw}*`);
        criteria = queryParts.join(" AND ");
    } else {
        const queryParts = keywords.map(kw => `*:${kw}*`);
        criteria = queryParts.join(" OR ");
    }

    const url = `${BASE_URL}/${DATASET}/${VERSION}/records`;

    const formData = new URLSearchParams();
    formData.append("criteria", criteria);
    formData.append("start", "0");
    formData.append("rows", String(Math.min(limit, 10000)));

    const headers = { "Accept": "application/json" };

    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    try {
        logInfo(`[USPTO DS-API] Searching: ${criteria}`);
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData,
            agent: httpsAgent
        });

        if (response.status === 200) {
            const data = await response.json();
            if (data.response) {
                const docs = data.response.docs || [];
                logInfo(`[USPTO DS-API] Found ${data.response.numFound || 0} results, returned ${docs.length}`);
                return {
                    results: docs,
                    total: data.response.numFound || 0,
                    shown: docs.length,
                    query: criteria
                };
            }
            return { results: [], total: 0, query: criteria };
        } else {
            const errorText = await response.text();
            return { error: `API Error ${response.status}: ${errorText}`, results: [], total: 0 };
        }
    } catch (error) {
        return { error: `Error: ${error.message}`, results: [], total: 0 };
    }
}
