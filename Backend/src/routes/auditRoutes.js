import express from 'express';
import { authenticateJWT } from '../middlewares/authMiddleware.js';
import { getMyAuditLogs, getFailedAttempts, getAuditLogs } from '../controllers/auditController.js';

const router = express.Router();

// Get current user's audit logs (requires authentication)
router.get('/my-logs', authenticateJWT, getMyAuditLogs);

// Admin endpoints (add admin role check middleware in production)
router.get('/failed-attempts', authenticateJWT, getFailedAttempts);
router.get('/logs', authenticateJWT, getAuditLogs);

export default router;

