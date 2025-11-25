import AuditLog from '../models/AuditLog.js';
import mongoose from 'mongoose';

/**
 * Service for logging authentication events to audit trail
 * All functions are safe - they won't throw errors if MongoDB is not connected
 */

/**
 * Get client IP address from request
 */
export function getClientIp(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           'unknown';
}

/**
 * Get user agent from request
 */
export function getUserAgent(req) {
    return req.headers['user-agent'] || 'unknown';
}

/**
 * Log an authentication event
 * @param {Object} options
 * @param {string} options.eventType - Type of event (LOGIN_SUCCESS, LOGIN_FAILED, etc.)
 * @param {string} [options.userEmail] - User email (null for failed attempts with invalid emails)
 * @param {string} [options.userId] - User ID (if available)
 * @param {string} [options.ipAddress] - Client IP address
 * @param {string} [options.userAgent] - User agent string
 * @param {string} [options.reason] - Reason for failure or additional context
 * @param {Object} [options.metadata] - Additional metadata
 * @param {boolean} [options.success] - Whether the event was successful
 */
export async function logAuthEvent({
    eventType,
    userEmail = null,
    userId = null,
    ipAddress = null,
    userAgent = null,
    reason = null,
    metadata = {},
    success = false
}) {
    // Only log if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
        console.warn('[AuditLog] MongoDB not connected - audit event not logged:', eventType);
        return null;
    }

    try {
        const auditLog = await AuditLog.create({
            eventType,
            userEmail: userEmail?.toLowerCase() || null,
            userId: userId || null,
            ipAddress: ipAddress || 'unknown',
            userAgent: userAgent || 'unknown',
            reason: reason || null,
            metadata,
            success,
            timestamp: new Date()
        });

        return auditLog;
    } catch (error) {
        // Don't throw - audit logging should never break the main flow
        console.error('[AuditLog] Failed to log event:', error.message);
        return null;
    }
}

/**
 * Check if an IP address has too many failed login attempts
 * @param {string} ipAddress - IP address to check
 * @param {number} maxAttempts - Maximum allowed attempts (default: 5)
 * @param {number} windowMinutes - Time window in minutes (default: 15)
 * @returns {Promise<{blocked: boolean, attempts: number, remainingTime: number}>}
 */
export async function checkIpBlocked(ipAddress, maxAttempts = 5, windowMinutes = 15) {
    if (mongoose.connection.readyState !== 1) {
        return { blocked: false, attempts: 0, remainingTime: 0 };
    }

    try {
        const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
        
        const failedAttempts = await AuditLog.countDocuments({
            ipAddress,
            eventType: 'LOGIN_FAILED',
            timestamp: { $gte: windowStart }
        });

        if (failedAttempts >= maxAttempts) {
            // Calculate remaining time until window expires
            // The lockout expires windowMinutes after the OLDEST failed attempt
            const oldestAttempt = await AuditLog.findOne({
                ipAddress,
                eventType: 'LOGIN_FAILED',
                timestamp: { $gte: windowStart }
            }).sort({ timestamp: 1 });

            const remainingTime = oldestAttempt 
                ? Math.ceil((oldestAttempt.timestamp.getTime() + windowMinutes * 60 * 1000 - Date.now()) / 1000 / 60)
                : 0;

            return {
                blocked: true,
                attempts: failedAttempts,
                remainingTime: Math.max(0, remainingTime)
            };
        }

        return {
            blocked: false,
            attempts: failedAttempts,
            remainingTime: 0
        };
    } catch (error) {
        console.error('[AuditLog] Error checking IP block:', error.message);
        return { blocked: false, attempts: 0, remainingTime: 0 };
    }
}

/**
 * Check if a user account is locked due to too many failed attempts
 * @param {string} userEmail - User email to check
 * @param {number} maxAttempts - Maximum allowed attempts (default: 5)
 * @param {number} windowMinutes - Time window in minutes (default: 15)
 * @returns {Promise<{locked: boolean, attempts: number, remainingTime: number}>}
 */
export async function checkUserLocked(userEmail, maxAttempts = 5, windowMinutes = 15) {
    if (mongoose.connection.readyState !== 1) {
        return { locked: false, attempts: 0, remainingTime: 0 };
    }

    try {
        const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
        
        const failedAttempts = await AuditLog.countDocuments({
            userEmail: userEmail.toLowerCase(),
            eventType: 'LOGIN_FAILED',
            timestamp: { $gte: windowStart }
        });

        if (failedAttempts >= maxAttempts) {
            // Calculate remaining time until window expires
            // The lockout expires windowMinutes after the OLDEST failed attempt
            const oldestAttempt = await AuditLog.findOne({
                userEmail: userEmail.toLowerCase(),
                eventType: 'LOGIN_FAILED',
                timestamp: { $gte: windowStart }
            }).sort({ timestamp: 1 });

            const remainingTime = oldestAttempt 
                ? Math.ceil((oldestAttempt.timestamp.getTime() + windowMinutes * 60 * 1000 - Date.now()) / 1000 / 60)
                : 0;

            return {
                locked: true,
                attempts: failedAttempts,
                remainingTime: Math.max(0, remainingTime)
            };
        }

        return {
            locked: false,
            attempts: failedAttempts,
            remainingTime: 0
        };
    } catch (error) {
        console.error('[AuditLog] Error checking user lock:', error.message);
        return { locked: false, attempts: 0, remainingTime: 0 };
    }
}

/**
 * Get audit logs for a specific user
 * @param {string} userEmail - User email
 * @param {number} limit - Number of logs to return (default: 50)
 * @returns {Promise<Array>}
 */
export async function getUserAuditLogs(userEmail, limit = 50) {
    if (mongoose.connection.readyState !== 1) {
        return [];
    }

    try {
        return await AuditLog.find({
            userEmail: userEmail.toLowerCase()
        })
        .sort({ timestamp: -1 })
        .limit(limit)
        .select('-__v')
        .lean();
    } catch (error) {
        console.error('[AuditLog] Error fetching user logs:', error.message);
        return [];
    }
}

/**
 * Get recent failed login attempts for monitoring
 * @param {number} hours - Hours to look back (default: 24)
 * @param {number} limit - Number of logs to return (default: 100)
 * @returns {Promise<Array>}
 */
export async function getRecentFailedAttempts(hours = 24, limit = 100) {
    if (mongoose.connection.readyState !== 1) {
        return [];
    }

    try {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        return await AuditLog.find({
            eventType: 'LOGIN_FAILED',
            timestamp: { $gte: since }
        })
        .sort({ timestamp: -1 })
        .limit(limit)
        .select('-__v')
        .lean();
    } catch (error) {
        console.error('[AuditLog] Error fetching failed attempts:', error.message);
        return [];
    }
}

