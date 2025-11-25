import mongoose from "mongoose";

/**
 * Audit Log Schema for tracking authentication events
 * Stores login attempts, failures, and security events
 */
const auditLogSchema = new mongoose.Schema(
    {
        eventType: {
            type: String,
            required: true,
            enum: [
                'LOGIN_SUCCESS',
                'LOGIN_FAILED',
                'LOGIN_BLOCKED',
                'LOGOUT',
                'REGISTER_SUCCESS',
                'REGISTER_FAILED',
                'ACCOUNT_LOCKED',
                'ACCOUNT_UNLOCKED',
                'PASSWORD_RESET_REQUEST',
                'PASSWORD_RESET_SUCCESS',
                'SUSPICIOUS_ACTIVITY'
            ],
            index: true
        },
        userEmail: {
            type: String,
            required: false, // May be null for failed attempts with invalid emails
            lowercase: true,
            trim: true,
            index: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
            index: true
        },
        ipAddress: {
            type: String,
            required: true,
            index: true
        },
        userAgent: {
            type: String,
            required: false // May not always be available
        },
        reason: {
            type: String,
            required: false // For failed attempts: "Invalid password", "User not found", etc.
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {} // Store additional context like device info, location hints, etc.
        },
        success: {
            type: Boolean,
            required: true,
            default: false,
            index: true
        },
        timestamp: {
            type: Date,
            default: Date.now,
            required: true,
            index: true
        }
    },
    {
        timestamps: true, // Adds createdAt and updatedAt
        collection: 'audit_logs'
    }
);

// Compound indexes for common queries
auditLogSchema.index({ userEmail: 1, timestamp: -1 }); // User's login history
auditLogSchema.index({ ipAddress: 1, timestamp: -1 }); // IP-based tracking
auditLogSchema.index({ eventType: 1, timestamp: -1 }); // Event type queries
auditLogSchema.index({ success: 1, timestamp: -1 }); // Failed attempts tracking

// TTL index to auto-delete old logs after 1 year (optional, adjust as needed)
// auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

export default mongoose.model("AuditLog", auditLogSchema);

