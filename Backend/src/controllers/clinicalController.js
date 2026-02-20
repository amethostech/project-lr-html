import { fetchStudies } from '../services/clinicalService.js';

/**
 * Controller for Clinical Trials search
 * POST /api/clinical/search
 * Body: { query: string, maxResults?: number }
 */
export const searchClinicalTrials = async (req, res) => {
    try {
        const { query = '', maxResults = 100, operator = 'OR', phase, status: trialStatus, sponsor_type, intervention, condition } = req.body;

        console.log(`[Clinical Trials] Searching for: "${query}", maxResults: ${maxResults}`);

        const pageSize = 50;
        const keywords = query ? query.split(',').map(k => k.trim()).filter(k => k.length > 0) : [];

        let searchQuery = query;
        if (keywords.length > 1) {
            const joinOp = (operator && operator.toUpperCase() === 'AND') ? ' AND ' : ' OR ';
            searchQuery = keywords.map(k => `(${k})`).join(joinOp);
        } else if (keywords.length === 1) {
            searchQuery = keywords[0];
        }

        console.log(`[Clinical Trials] Using search term: "${searchQuery}" with operator: ${operator}`);

        const { formatted, totalFetched, pageCount } = await fetchStudies({
            customQuery: searchQuery,
            pageSize,
            maxResults,
            phase,
            status: trialStatus,
            sponsor_type,
            intervention,
            condition
        });

        console.log(`[Clinical Trials] Found ${formatted.length} studies`);

        return res.status(200).json({
            success: true,
            count: formatted.length,
            results: formatted,
            message: `Found ${formatted.length} clinical trials`
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
