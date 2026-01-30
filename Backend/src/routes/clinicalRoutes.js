import express from 'express';
import { searchClinicalTrials } from '../controllers/clinicalController.js';

const router = express.Router();

// Public endpoint for clinical trials search
router.post('/search', searchClinicalTrials);

export default router;
