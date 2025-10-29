import express from "express";
import cors from 'cors'
import connectDB from "./src/config/DataBase.js";

const app = express();

const allowedOrigins = ['http://127.0.0.1:5500']
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

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

export default app ;