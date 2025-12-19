import express from 'express'
import { register } from '../controllers/authController.js'
import { login } from '../controllers/authController.js';
import rateLimit from 'express-rate-limit';
import { registerValidation , loginValidation } from '../middlewares/validators/authValidator.js';

const router = express.Router();
// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter,registerValidation ,  register);
router.post('/login', authLimiter,   login);


export default router; 