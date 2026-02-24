import express from 'express';

import { 
    pubchemSearchController,
    pubchemCacheStatsController,
    pubchemClearCacheController,
    pubchemMechanismController
} from '../controllers/pubchemController.js';
import { authenticateJWT } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Main search endpoint
router.post('/search', authenticateJWT, pubchemSearchController);

// Mechanism of action endpoint
router.post('/mechanism', authenticateJWT, pubchemMechanismController);

// Cache management endpoints (should be protected by admin middleware in production)
router.get('/cache/stats', authenticateJWT, pubchemCacheStatsController);
router.delete('/cache/clear', authenticateJWT, pubchemClearCacheController);

export default router;
