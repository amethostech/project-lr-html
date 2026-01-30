import https from 'https';
import querystring from 'querystring';
import zlib from 'zlib';

// Redirect all console.log to stderr to keep stdout clean for JSON output
const originalLog = console.log;
console.log = function (...args) {
    console.error(...args);
};

// --- API IMPLEMENTATIONS ---

// Helper: Generic HTTPS Request with gzip support
function httpsRequest(urlString, options = {}, postData = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlString);

        const reqOptions = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            rejectUnauthorized: options.rejectUnauthorized !== undefined ? options.rejectUnauthorized : true
        };

        const req = https.request(reqOptions, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                let buffer = Buffer.concat(chunks);
                const encoding = res.headers['content-encoding'];

                // Decompress if gzip or deflate
                if (encoding === 'gzip') {
                    buffer = zlib.gunzipSync(buffer);
                } else if (encoding === 'deflate') {
                    buffer = zlib.inflateSync(buffer);
                }

                const data = buffer.toString('utf8');

                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data); // Return text if not JSON
                    }
                } else {
                    reject(new Error(`Request failed with status ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

// 1. USPTO Implementation
async function searchUsptoDsapiLocal(keywords, operator = "AND", limit = 100) {
    if (!keywords || keywords.length === 0) return { results: [] };

    const BASE_URL = "https://developer.uspto.gov/ds-api/enriched_cited_reference_metadata/v3/records";

    // Build Lucene query
    let criteria;
    const queryParts = keywords.map(kw => `*:${kw}*`);
    criteria = operator.toUpperCase() === "AND"
        ? `(${queryParts.join(" AND ")})`
        : `(${queryParts.join(" OR ")})`;

    const postData = querystring.stringify({
        criteria: criteria,
        start: '0',
        rows: String(Math.min(limit, 100))
    });

    console.error("DEBUG USPTO: Query criteria =", criteria);
    console.error("DEBUG USPTO: POST data =", postData);

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'Accept-Encoding': 'identity',  // Request uncompressed response
            'Content-Length': Buffer.byteLength(postData)
        },
        rejectUnauthorized: false // Match original service behavior
    };

    try {
        const data = await httpsRequest(BASE_URL, options, postData);
        console.error("DEBUG USPTO: Raw response type =", typeof data);

        // If response is a string, try to parse it
        let parsedData = data;
        if (typeof data === 'string') {
            console.error("DEBUG USPTO: Response (first 500 chars) =", data.substring(0, 500));
            try {
                parsedData = JSON.parse(data);
            } catch (e) {
                console.error("DEBUG USPTO: Failed to parse string response:", e.message);
                return { results: [] };
            }
        }

        console.error("DEBUG USPTO: Parsed response keys =", parsedData ? Object.keys(parsedData) : 'null');

        const docs = parsedData.response?.docs || parsedData.docs || [];
        console.error("DEBUG USPTO: Found", docs.length, "documents");

        return {
            results: Array.isArray(docs) ? docs : [docs],
            total: parsedData.response?.numFound || docs.length
        };
    } catch (error) {
        console.error("USPTO Error:", error.message || error);
        return { results: [] };
    }
}

// 2. PubMed Implementation
async function searchPubMedUtilLocal(query, dateFrom, dateTo, maxResults = 100) {
    const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

    try {
        // Step 1: ESearch
        let searchUrl = `${EUTILS_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json`;
        if (dateFrom && dateTo) {
            searchUrl += `&mindate=${dateFrom}&maxdate=${dateTo}&datetype=pdat`;
        }

        const searchData = await httpsRequest(searchUrl);
        const ids = searchData.esearchresult?.idlist || [];

        if (ids.length === 0) return { results: [] };

        // Step 2: ESummary (fetch details)
        const summaryUrl = `${EUTILS_BASE}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
        const summaryData = await httpsRequest(summaryUrl);

        const results = paramsToArticleList(summaryData.result, ids);
        return { results };

    } catch (error) {
        console.error("PubMed Error:", error);
        return { results: [] };
    }
}

function paramsToArticleList(result, ids) {
    if (!result) return [];
    return ids.map(id => {
        const doc = result[id];
        if (!doc) return null;
        return {
            id: id,
            title: doc.title,
            authors: (doc.authors || []).map(a => a.name),
            source: doc.source,
            pubdate: doc.pubdate,
            url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`
        };
    }).filter(x => x !== null);
}


// --- MAIN EXECUTION ---

const chunks = [];
process.stdin.on('data', chunk => chunks.push(chunk));
process.stdin.on('end', async () => {
    try {
        const inputRaw = Buffer.concat(chunks).toString();
        // DEBUG: Log raw input to stderr so it appears in Python uvicorn logs
        console.error("DEBUG Bridge Input:", inputRaw);

        const input = JSON.parse(inputRaw);
        const { api, params } = input;
        let result = { results: [] };

        switch (api.toLowerCase()) {
            case 'uspto':
                const usptoKeywords = Array.isArray(params.query) ? params.query : params.query.split(',').map(s => s.trim());
                // Use OR by default to ensure results if multiple disparate keywords are provided
                const rawResult = await searchUsptoDsapiLocal(usptoKeywords, params.operator || "OR", params.limit);

                // Client-side filtering logic
                result = rawResult;
                if (params.start_year || params.end_year) {
                    const start = params.start_year ? parseInt(params.start_year) : 0;
                    const end = params.end_year ? parseInt(params.end_year) : 9999;
                    const beforeCount = result.results?.length || 0;
                    if (result.results) {
                        result.results = result.results.filter(doc => {
                            const dateStr = doc.publicationDate || doc.date || "";
                            if (!dateStr) return true; // Keep docs without dates
                            const year = parseInt(dateStr.substring(0, 4));
                            return year >= start && year <= end;
                        });
                    }
                    console.error("DEBUG USPTO: After date filter:", beforeCount, "->", result.results?.length);
                    // Log first doc's keys to understand the structure
                    if (result.results && result.results.length > 0) {
                        console.error("DEBUG USPTO: First doc keys:", Object.keys(result.results[0]));
                        console.error("DEBUG USPTO: First doc sample:", JSON.stringify(result.results[0]).substring(0, 500));
                    }
                }
                break;

            case 'pubmed':
                result = await searchPubMedUtilLocal(
                    params.query,
                    params.dateFrom,
                    params.dateTo,
                    params.maxResults
                );
                break;

            // Minimal placeholders for others
            case 'pubchem':
            case 'patentsview':
                result = { results: [] }; // Not prioritized right now
                break;
        }

        process.stdout.write(JSON.stringify({ success: true, data: result }));

    } catch (error) {
        console.error(error);
        process.stdout.write(JSON.stringify({ success: false, error: error.message }));
        process.exit(1);
    }
});
