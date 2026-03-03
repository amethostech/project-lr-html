import express from 'express';
import { executeWorkflow } from '../controllers/workflowController.js';
import { authenticateJWT } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/execute', authenticateJWT, executeWorkflow);

export default router;
