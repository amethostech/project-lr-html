import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../utils/constants.js';
export const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header missing' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        return res.status(401).json({ error: 'Token format is "Bearer <token>"' });
    }
    const token = parts[1];

    try {
        // Use imported constant
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (!decoded.email) {
            console.error("JWT Decode Error: Email field missing from payload.");
            return res.status(403).json({ 
                error: 'Token is valid but missing required email data in payload.' 
            });
        }
        
        req.userEmail = decoded.email;
        next();

    } catch (err) {
        console.error('JWT Verification Error:', err);
        return res.status(403).json({
            error: 'Invalid or expired token',
            details: err.message
        });
    }
};