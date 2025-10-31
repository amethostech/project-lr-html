import express from 'express'

import { searchAPIController } from '../controllers/pubMedController.js';
const router = express.Router(); 
import { authenticateJWT } from '../middlewares/authMiddleware.js';
router.post('/search' , authenticateJWT , searchAPIController);


export default router; 