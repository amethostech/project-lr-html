import express from 'express'
import { searchPubMed } from '../controllers/pubMedController.js'

const router= express.Router(); 

router.post('/search' , searchPubMed);

export default router;
