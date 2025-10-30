import express from "express";
import cors from 'cors'
import connectDB from "./src/config/DataBase.js";
import pubmedRoutes from './src/routes/pubmedRoutes.js';
import authRoutes from './src/routes/authRoutes.js'
const app = express();

const allowedOrigins = ['https://project-lr-html.vercel.app']
connectDB();
app.use(cors({
    origin: allowedOrigins,
    //  credentials : true, 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

app.use(express.json()) ;
app.get("/" , (req,res)=>{
    res.send("Backend API is Running...")
})

app.use("/api/pubmed", pubmedRoutes);
app.use("/api/auth" , authRoutes);
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

export default app ;
