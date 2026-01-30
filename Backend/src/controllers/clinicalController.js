import { fetchStudies } from '../services/clinicalService.js';

/**
 * Controller for Clinical Trials search
 * POST /api/clinical/search
 * Body: { query: string, maxResults?: number }
 */
export const searchClinicalTrials = async (req, res) => {
    try {
        const { query, maxResults = 100 } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: query'
            });
        }

        console.log(`[Clinical Trials] Searching for: "${query}", maxResults: ${maxResults}`);

        // Calculate pages needed (pageSize is 50 by default in service)
        const pageSize = 50;
        const maxPages = Math.ceil(maxResults / pageSize);

        // ClinicalTrials.gov works better with single terms or simple queries
        // Split by comma and use the first keyword for better results
        const keywords = query.split(',').map(k => k.trim()).filter(k => k.length > 0);
        const searchQuery = keywords.length > 0 ? keywords[0] : query;

        console.log(`[Clinical Trials] Using search term: "${searchQuery}"`);

        const { raw, formatted } = await fetchStudies({
            customQuery: searchQuery,  // Use customQuery for exact control
            maxPages,
            pageSize
        });

        console.log(`[Clinical Trials] Found ${formatted.length} studies`);

        // Transform to consistent format for frontend
        const results = formatted.map(study => ({
            id: study.id,
            title: study.title,
            officialTitle: study.officialTitle,
            sponsor: study.sponsor,
            status: study.status,
            source: 'ClinicalTrials.gov',
            url: `https://clinicaltrials.gov/study/${study.id}`
        }));

        return res.status(200).json({
            success: true,
            count: results.length,
            results,
            message: `Found ${results.length} clinical trials`
        });

    } catch (error) {
        console.error('[Clinical Trials] Error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to search clinical trials',
            details: error.message
        });
    }
};
