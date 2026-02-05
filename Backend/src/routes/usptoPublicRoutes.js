import express from 'express';
import { searchUsptoController } from '../controllers/usptoController.js';

const router = express.Router();

/**
 * Public USPTO search endpoint (no JWT required)
 * POST /api/uspto-public/search
 * Body: { keywords: string[], year: number, size?: number }
 */
router.post('/search', searchUsptoController);

export default router;
