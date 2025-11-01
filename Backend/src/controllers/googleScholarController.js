import { GoogleSearch } from 'google-search-results-nodejs';
import { SERP_API_KEY } from '../utils/constants.js';
console.log(SERP_API_KEY);

// --- Helper Function for Google Scholar Search ---
export const searchGoogleScholar = async (req, res) => {
    const payload = req.body; 
    const { query, maxResults, dbParams } = payload;
    
    if (!query) {
        return res.status(400).json({ status: 'error', error: 'Query term is required.' });
    }

    const scholarParams = dbParams['google_scholar'] || {};
    const numResults = Math.min(parseInt(maxResults) || 10, 20); 

    if (!SERP_API_KEY) {
         return res.status(500).json({ status: 'error', error: 'SERPAPI_API_KEY is not configured on the server.' });
    }
    
    const search = new GoogleSearch(SERP_API_KEY);

    const params = {
        engine: 'google_scholar',
        q: query,
        num: numResults, 
        ...(scholarParams.as_ylo && { as_ylo: scholarParams.as_ylo }), 
        ...(scholarParams.as_yhi && { as_yhi: scholarParams.as_yhi }), 
        ...(scholarParams.as_sdt && { as_sdt: scholarParams.as_sdt.split(' ')[0] }) 
    };

    try {
        const result = await new Promise((resolve, reject) => {
            search.json(params, (json) => {
                if (json.error) return reject(new Error(json.error));
                resolve(json);
            });
        });

        const formattedResults = (result.organic_results || []).map(item => ({
            Title: item.title,
            Authors: item.publication_info?.authors?.map(a => a.name).join(', ') || 'N/A',
            PublicationYear: item.publication_info?.summary?.match(/(\d{4})/) ? item.publication_info.summary.match(/(\d{4})/)[1] : 'N/A',
            Abstract: item.snippet,
            DOI_PMID: item.resources?.[0]?.link.includes('doi.org') ? item.resources[0].link.split('doi.org/')[1] : 'N/A',
            Source: 'Google Scholar',
            MeSH_Major_1: 'N/A', 
        }));

        res.json({
            status: 'success',
            count: result.search_information?.total_results || formattedResults.length,
            results: formattedResults,
            message: `Search completed on Google Scholar. Found ${result.search_information?.total_results} records.`,
        });

    } catch (error) {
        console.error("Google Scholar Search Failed:", error.message);
        res.status(500).json({ 
            status: 'error', 
            error: `Google Scholar API failed: ${error.message}. Check your SerpApi key and query.` 
        });
    }
};