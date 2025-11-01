import express from 'express'
import { searchGoogleScholar } from '../controllers/googleScholarController.js'

const router  = express.Router(); 

 import { authenticateJWT } from '../middlewares/authMiddleware.js';
router.post('/googlescholar',authenticateJWT, searchGoogleScholar)


export default router ;