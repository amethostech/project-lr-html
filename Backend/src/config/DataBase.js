import mongoose from "mongoose";
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    // Validate MONGO_URI exists and is properly formatted
    const mongoURI = process.env.MONGO_URI?.trim();
    
    if (!mongoURI) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }

    if (!mongoURI.startsWith('mongodb://') && !mongoURI.startsWith('mongodb+srv://')) {
      throw new Error('MONGO_URI must start with "mongodb://" or "mongodb+srv://"');
    }

    console.log('Attempting to connect to MongoDB...');

    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000, 
      socketTimeoutMS: 45000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed due to app termination');
        process.exit(0);
      } catch (err) {
        console.error('Error closing MongoDB connection:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    
    // Log additional debugging info
    if (error.message.includes('Invalid scheme')) {
      console.error('Check your MONGO_URI in .env file. It should start with mongodb:// or mongodb+srv://');
    }
    
    if (error.message.includes('SSL') || error.message.includes('TLS')) {
      console.error('SSL/TLS error detected. Check MongoDB Atlas network access and try regenerating your connection string.');
    }
    
    process.exit(1);
  }
};

export default connectDB;