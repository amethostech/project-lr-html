import express from 'express';
import { searchAPIController } from '../controllers/pubMedController.js';

const router = express.Router();

/**
 * Public PubMed search endpoint (no JWT required)
 * POST /api/pubmed-public/search
 * Body: { query: string, from?: string, to?: string, maxResults?: number }
 */
router.post('/search', searchAPIController);

export default router;
