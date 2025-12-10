import express from "express";
import { searchTrials } from "../controllers/searchController.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";
const router = express.Router();

router.post("/", authenticateJWT, searchTrials);

export default router;
