import dotenv from "dotenv";
import app from "./app.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(
    `Server running  on port ${PORT}`
  );
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Unhandled Rejection: ${err.message}`.red);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log(`Uncaught Exception: ${err.message}`.red);
  server.close(() => process.exit(1));
});