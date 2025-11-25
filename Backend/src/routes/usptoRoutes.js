import express from 'express';
import { searchUsptoController, getUsptoFieldsController } from '../controllers/usptoController.js';
import { authenticateJWT } from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * POST /api/uspto/search
 * Search USPTO database and automatically save results to Excel
 * Requires authentication - results will be emailed to user
 * 
 * Body: {
 *   keywords: string[],
 *   operator: "AND" | "OR" (optional, default: "AND"),
 *   limit: number (optional, default: 500)
 * }
 */
router.post('/search', authenticateJWT, searchUsptoController);

/**
 * GET /api/uspto/fields
 * Get available searchable fields from USPTO API
 */
router.get('/fields', getUsptoFieldsController);

export default router;

