import { getUserAuditLogs, getRecentFailedAttempts } from '../services/auditLogService.js';
import AuditLog from '../models/AuditLog.js';
import mongoose from 'mongoose';
import { authenticateJWT } from '../middlewares/authMiddleware.js';

/**
 * Get audit logs for the authenticated user
 * GET /api/audit/my-logs
 */
export const getMyAuditLogs = async (req, res) => {
    try {
        const userEmail = req.userEmail;
        if (!userEmail) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        const limit = parseInt(req.query.limit) || 50;
        const logs = await getUserAuditLogs(userEmail, limit);

        return res.status(200).json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) {
        console.error('[Audit Controller] Error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch audit logs',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get recent failed login attempts (Admin only - optional)
 * GET /api/audit/failed-attempts
 * Note: In production, add admin role check middleware
 */
export const getFailedAttempts = async (req, res) => {
    try {
        // TODO: Add admin authentication check here
        // if (!req.user || req.user.role !== 'admin') {
        //     return res.status(403).json({ success: false, message: 'Admin access required' });
        // }

        const hours = parseInt(req.query.hours) || 24;
        const limit = parseInt(req.query.limit) || 100;
        
        const logs = await getRecentFailedAttempts(hours, limit);

        return res.status(200).json({
            success: true,
            count: logs.length,
            hours,
            data: logs
        });
    } catch (error) {
        console.error('[Audit Controller] Error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch failed attempts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get audit logs with filters (Admin only - optional)
 * GET /api/audit/logs
 */
export const getAuditLogs = async (req, res) => {
    try {
        // TODO: Add admin authentication check here
        // if (!req.user || req.user.role !== 'admin') {
        //     return res.status(403).json({ success: false, message: 'Admin access required' });
        // }

        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                success: false,
                message: 'Database not connected'
            });
        }

        const {
            userEmail,
            ipAddress,
            eventType,
            success,
            startDate,
            endDate,
            limit = 100,
            page = 1
        } = req.query;

        const query = {};

        if (userEmail) query.userEmail = userEmail.toLowerCase();
        if (ipAddress) query.ipAddress = ipAddress;
        if (eventType) query.eventType = eventType;
        if (success !== undefined) query.success = success === 'true';

        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const logs = await AuditLog.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .select('-__v')
            .lean();

        const total = await AuditLog.countDocuments(query);

        return res.status(200).json({
            success: true,
            count: logs.length,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            data: logs
        });
    } catch (error) {
        console.error('[Audit Controller] Error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch audit logs',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

