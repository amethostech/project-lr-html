import express from "express";
import cors from 'cors'
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from "./src/config/DataBase.js";
import pubmedRoutes from './src/routes/pubmedRoutes.js';
import pubchemRoutes from './src/routes/pubchemRoutes.js';
import authRoutes from './src/routes/authRoutes.js'
import profileRoutes from './src/routes/profileRoutes.js';
import googleScholarRoutes from './src/routes/googleScholarRoutes.js'
import usptoRoutes from './src/routes/usptoRoutes.js'
import auditRoutes from './src/routes/auditRoutes.js'
import searchRoutes from './src/routes/searchRoutes.js'
import newsArticlesRoutes from './src/routes/newsArticlesRoutes.js'
import clinicalRoutes from './src/routes/clinicalRoutes.js'
import pubmedPublicRoutes from './src/routes/pubmedPublicRoutes.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const allowedOrigins = [
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://project-lr-html.vercel.app/index.html',
    'https://project-lr-one.vercel.app',
    'https://project-lr-frontend.onrender.com'
];
if (process.env.MONGO_URI) {
    connectDB().catch(err => {
        console.warn('⚠️  MongoDB connection failed, but server will continue running.');
        console.warn('   USPTO searches will work without MongoDB.');
        console.warn('   Error:', err.message);
    });
} else {
    console.log('ℹ️  MONGO_URI not set - MongoDB features disabled.');
    console.log('   USPTO searches will work without MongoDB.');
}
// Trust proxy for accurate IP detection (important for production behind load balancers/proxies)
// Set to 1 to trust first proxy, or use specific IP ranges in production
app.set('trust proxy', 1);

app.use(cors({
    origin: allowedOrigins,
    //  credentials : true, 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
}))

app.use(express.json());
app.get("/", (req, res) => {
    res.send("Backend API is Running...")
})

// API Routes
app.use("/api/pubmed", pubmedRoutes);
app.use("/api/pubchem", pubchemRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", profileRoutes)
app.use('/api/google', googleScholarRoutes)
app.use('/api/uspto', usptoRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/news', newsArticlesRoutes);
app.use('/api/clinical', clinicalRoutes);
app.use('/api/pubmed-public', pubmedPublicRoutes);
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

export default app;