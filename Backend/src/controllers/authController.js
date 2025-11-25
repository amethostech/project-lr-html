import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import bcrypt from 'bcryptjs' 
import mongoose from 'mongoose'
import { validationResult } from "express-validator";
import { logAuthEvent, getClientIp, getUserAgent, checkIpBlocked, checkUserLocked } from '../services/auditLogService.js';

/**
 
 * @param {object} payload 
 * @param {string} [expiresIn] 
 */
const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET);
};

//@desc Register user 
//@route POST /api/auth/signup 
//@access Public 

const register = async (req, res) => {
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // Log failed registration attempt
            await logAuthEvent({
                eventType: 'REGISTER_FAILED',
                userEmail: req.body.email,
                ipAddress,
                userAgent,
                reason: 'Validation failed',
                metadata: { errors: errors.array() },
                success: false
            });
            
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: errors.array(),
            });
        }

        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                success: false,
                message: "Database not connected. Please check MongoDB connection.",
                error: "MongoDB connection required for registration"
            });
        }

        const { name, email, password, phone } = req.body;
        const existingUser = await User.findOne({ email });
        
        if (existingUser) {
            // Log failed registration attempt
            await logAuthEvent({
                eventType: 'REGISTER_FAILED',
                userEmail: email,
                ipAddress,
                userAgent,
                reason: 'User already exists',
                success: false
            });
            
            return res.status(400).json({
                success: false,
                message: "User already exists with this email",
            });
        }
        
        const user = await User.create({
            name,
            email,
            password,
            phone 
        });

        const tokenPayload = {
            id: user._id,
            email: user.email 
        };

        const token = generateToken(tokenPayload, '1d'); 
        
        user.password = undefined;
        
        // Log successful registration
        await logAuthEvent({
            eventType: 'REGISTER_SUCCESS',
            userEmail: user.email,
            userId: user._id,
            ipAddress,
            userAgent,
            success: true
        });
        
        res.status(201).json({
            success: true,
            message: "Account created successfully",
            data: { user, token },
        });
    } catch (error) {
        // Log registration error
        await logAuthEvent({
            eventType: 'REGISTER_FAILED',
            userEmail: req.body.email,
            ipAddress,
            userAgent,
            reason: 'Server error',
            metadata: { error: error.message },
            success: false
        });
        
        console.error("register error:", error);
        res.status(500).json({
            success: false,
            message: "Server error occurred during registration",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

const login = async(req, res) => {
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    
    try {
        const errors = validationResult(req); 
        if(!errors.isEmpty()){
            // Log failed login attempt
            await logAuthEvent({
                eventType: 'LOGIN_FAILED',
                userEmail: req.body.email,
                ipAddress,
                userAgent,
                reason: 'Validation failed',
                metadata: { errors: errors.array() },
                success: false
            });
            
            return res.status(400).json({
                success:false,
                message:"validation failed",
                errors : errors.array()
            }) ;
        }
        
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                success: false,
                message: "Database not connected. Please check MongoDB connection.",
                error: "MongoDB connection required for authentication"
            });
        }
        
        const {email , password} = req.body;
        
        // Check if IP is blocked due to too many failed attempts
        const ipBlockCheck = await checkIpBlocked(ipAddress, 5, 15);
        if (ipBlockCheck.blocked) {
            await logAuthEvent({
                eventType: 'LOGIN_BLOCKED',
                userEmail: email,
                ipAddress,
                userAgent,
                reason: `IP blocked - ${ipBlockCheck.attempts} failed attempts`,
                metadata: { 
                    attempts: ipBlockCheck.attempts,
                    remainingTime: ipBlockCheck.remainingTime 
                },
                success: false
            });
            
            return res.status(429).json({
                success: false,
                message: `Too many failed login attempts from this IP. Please try again in ${ipBlockCheck.remainingTime} minutes.`,
                error: 'IP_BLOCKED',
                retryAfter: ipBlockCheck.remainingTime
            });
        }
        
        const user = await User.findOne({email}).select("+password"); 
        
        if(!user){
            // Log failed login attempt - user not found
            await logAuthEvent({
                eventType: 'LOGIN_FAILED',
                userEmail: email,
                ipAddress,
                userAgent,
                reason: 'User not found',
                success: false
            });
            
            return res.status(401).json({
                success:false,
                message :"invalid email or password",
            });
        }
        
        // Check if user account is locked
        const userLockCheck = await checkUserLocked(email, 5, 15);
        if (userLockCheck.locked) {
            await logAuthEvent({
                eventType: 'ACCOUNT_LOCKED',
                userEmail: email,
                userId: user._id,
                ipAddress,
                userAgent,
                reason: `Account locked - ${userLockCheck.attempts} failed attempts`,
                metadata: { 
                    attempts: userLockCheck.attempts,
                    remainingTime: userLockCheck.remainingTime 
                },
                success: false
            });
            
            return res.status(429).json({
                success: false,
                message: `Account temporarily locked due to too many failed login attempts. Please try again in ${userLockCheck.remainingTime} minutes.`,
                error: 'ACCOUNT_LOCKED',
                retryAfter: userLockCheck.remainingTime
            });
        }
        
        const isPasswordMatch = await user.comparePassword(password); 
        
        if(!isPasswordMatch){
            // Log failed login attempt - wrong password
            await logAuthEvent({
                eventType: 'LOGIN_FAILED',
                userEmail: email,
                userId: user._id,
                ipAddress,
                userAgent,
                reason: 'Invalid password',
                success: false
            });
            
            return res.status(401).json({
                success: false , 
                message :"Invalid Email or password",
            }) ;
        }
        
        // Successful login
        const tokenPayload = {
            id: user._id,
            email: user.email
        };

        const token = generateToken(tokenPayload);
        
        user.password = undefined;
        
        // Log successful login
        await logAuthEvent({
            eventType: 'LOGIN_SUCCESS',
            userEmail: user.email,
            userId: user._id,
            ipAddress,
            userAgent,
            success: true
        });

        res.status(200).json({
            success:true , 
            message :"Login Successful" ,
            data : {user, token},
        })
    } catch (error) {
        // Log login error
        await logAuthEvent({
            eventType: 'LOGIN_FAILED',
            userEmail: req.body.email,
            ipAddress,
            userAgent,
            reason: 'Server error',
            metadata: { error: error.message },
            success: false
        });
        
        console.error("login error:", error) ;
        res.status(500).json({
            success:false, 
            message :"server error occurred while login",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}

export { register , login};