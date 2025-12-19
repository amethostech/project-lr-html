import express from "express";
import cors from 'cors'
import connectDB from "./src/config/DataBase.js";
import pubmedRoutes from './src/routes/pubmedRoutes.js';
import authRoutes from './src/routes/authRoutes.js'
import profileRoutes from './src/routes/profileRoutes.js';
import googleScholarRoutes from './src/routes/googleScholarRoutes.js'
import usptoRoutes from './src/routes/usptoRoutes.js'
import auditRoutes from './src/routes/auditRoutes.js'
import searchRoutes from './src/routes/searchRoutes.js'
import newsArticlesRoutes from './src/routes/newsArticlesRoutes.js'
const app = express();

const allowedOrigins = [
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'https://project-lr-html.vercel.app/index.html',
    'https://project-lr-one.vercel.app',
    'https://project-lr-frontend.onrender.com' 
  ];
// Connect to MongoDB (optional - only needed for auth/user features)
// USPTO searches work without MongoDB
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

app.use(express.json()) ;
app.get("/" , (req,res)=>{
    res.send("Backend API is Running...")
})

app.use("/api/pubmed", pubmedRoutes);
app.use("/api/auth" , authRoutes);
app.use("/api", profileRoutes)
app.use('/api/google', googleScholarRoutes)
app.use('/api/uspto', usptoRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/search' , searchRoutes) 
app.use('/api/news', newsArticlesRoutes) ;
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

export default app ;