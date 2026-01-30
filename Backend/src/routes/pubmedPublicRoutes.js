import express from 'express';
import { searchPubMedUtil } from '../services/pubmedService.js';

const router = express.Router();

/**
 * Public PubMed search endpoint (no JWT required)
 * POST /api/pubmed-public/search
 * Body: { query: string, from?: string, to?: string, maxResults?: number }
 */
router.post('/search', async (req, res) => {
    try {
        const { query, from, to, maxResults = 100 } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: query'
            });
        }

        console.log(`[PubMed Public] Searching for: "${query}", from: ${from}, to: ${to}`);

        // Convert comma-separated keywords to PubMed OR query syntax
        // e.g., "diabetes, cancer, heart" -> "(diabetes) OR (cancer) OR (heart)"
        const keywords = query.split(',').map(k => k.trim()).filter(k => k.length > 0);
        let pubmedQuery;
        if (keywords.length > 1) {
            pubmedQuery = keywords.map(k => `(${k})`).join(' OR ');
        } else {
            pubmedQuery = query;
        }

        console.log(`[PubMed Public] Using PubMed query: "${pubmedQuery}"`);

        const searchData = await searchPubMedUtil(pubmedQuery, from || null, to || null, maxResults);

        console.log(`[PubMed Public] Found ${searchData.count} results, returning ${searchData.results.length}`);

        // Transform results to consistent format for frontend
        const results = searchData.results.map(article => ({
            id: article['DOI/PMID'] || '',
            title: article['Title'] || '',
            authors: article['Authors'] || '',
            abstract: article['Abstract'] || '',
            year: article['Publication Year'] || '',
            source: 'PubMed',
            searchTerm: article['Search Term'] || query
        }));

        return res.status(200).json({
            success: true,
            count: searchData.count,
            results,
            message: `Found ${searchData.count} PubMed articles`
        });

    } catch (error) {
        console.error('[PubMed Public] Error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to search PubMed',
            details: error.message
        });
    }
});

export default router;
