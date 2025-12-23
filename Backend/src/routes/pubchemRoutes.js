import express from 'express';

import { pubchemSearchController } from '../controllers/pubchemController.js';
import { authenticateJWT } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/search', authenticateJWT, pubchemSearchController);

export default router;
