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

        const pageSize = 50;
        const maxPages = Math.ceil(maxResults / pageSize);
        const keywords = query.split(',').map(k => k.trim()).filter(k => k.length > 0);
        const { operator = 'OR' } = req.body;

        let searchQuery = query;
        if (keywords.length > 1) {
            const joinOp = (operator && operator.toUpperCase() === 'AND') ? ' AND ' : ' OR ';
            searchQuery = keywords.map(k => `(${k})`).join(joinOp);
        } else if (keywords.length === 1) {
            searchQuery = keywords[0];
        }

        console.log(`[Clinical Trials] Using search term: "${searchQuery}" with operator: ${operator}`);

        const { raw, formatted } = await fetchStudies({
            customQuery: searchQuery,
            maxPages,
            pageSize
        });

        console.log(`[Clinical Trials] Found ${formatted.length} studies`);

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
