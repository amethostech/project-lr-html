// API base URL for frontend -> backend calls.
// Localhost uses the local backend; otherwise use the deployed URL.
export const API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://project-lr-backend.onrender.com";
