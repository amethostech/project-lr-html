import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import bcrypt from 'bcryptjs' 
import { validationResult } from "express-validator";

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
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: errors.array(),
            });
        }

        const { name, email, password, phone } = req.body;
        const existingUser = await User.findOne({ email });
        
        if (existingUser) {
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
        
        res.status(201).json({
            success: true,
            message: "Account created successfully",
            data: { user, token },
        });
    } catch (error) {
        console.error("register error:", error);
        res.status(500).json({
            success: false,
            message: "Server error occurred during registration"
        });
    }
}

const login = async(req, res) => {
    try {
        const errors = validationResult(req); 
        if(!errors.isEmpty()){
            return res.status(400).json({
                success:false,
                message:"validation failed",
                errors : errors.array()
            }) ;
        }
        
        const {email , password} = req.body; 
        const user = await User.findOne({email}).select("+password"); 
        
        if(!user){
            return res.status(401).json({
                success:false,
                message :"invalid email or passsword",
            });
        }
        
        const isPasswordMatch = await user.comparePassword(password) ; 
        
        if(!isPasswordMatch){
            return res.status(401).json({
                success: false , 
                message :"Invalid Email or password",
            }) ;
        }
        

        const tokenPayload = {
            id: user._id,
            email: user.email
        };

        const token = generateToken(tokenPayload);
        
        user.password = undefined ;

        res.status(200).json({
            success:true , 
            message :"Login Successfull" ,
            data : {user, token},
        })
    } catch (error) {
        console.log("login error", error) ;
        res.status(500).json({
            success:false, 
            message :"server error occured while login "
        })
    }
}

export { register , login};