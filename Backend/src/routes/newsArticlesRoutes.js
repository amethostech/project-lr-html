import express from "express";
import { searchNewsArticlesController, getNewsArticlesStatusController } from "../controllers/newsArticlesController.js";
import { authenticateJWT } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Authenticated endpoint – runs the CSV search and emails results to the user
router.post("/search", authenticateJWT, searchNewsArticlesController);

// Status endpoint – can be public, it only returns metadata about the CSV source
router.get("/status", getNewsArticlesStatusController);

export default router;


