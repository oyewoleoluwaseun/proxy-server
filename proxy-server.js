const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");
const morgan = require("morgan");

const app = express();
const PORT = 3001;

// Configuration
const ALLOWED_ORIGIN = "https://lawpaviliontranscription.netlify.app";
const TARGET_SERVER = "http://192.168.1.144:8000";

// Middleware
app.use(morgan("dev"));
app.use(express.json());

// CORS Configuration
const corsOptions = {
  origin: ALLOWED_ORIGIN,
  methods: ["GET", "POST", "OPTIONS", "DELETE"],
  allowedHeaders: ["Content-Type", "x-api-key", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// SSE-Specific Proxy Middleware
const sseProxy = createProxyMiddleware({
  target: TARGET_SERVER,
  changeOrigin: true,
  pathRewrite: {
    "^/sse": "/api", // Rewrite /sse to /api for backend
  },
  onProxyReq: (proxyReq, req) => {
    console.log(`Proxying SSE request to: ${proxyReq.path}`);
    proxyReq.setHeader("Accept", "text/event-stream");
    proxyReq.setHeader("Cache-Control", "no-cache");
    proxyReq.setHeader("Connection", "keep-alive");
  },
  onProxyRes: (proxyRes) => {
    // Force SSE headers
    proxyRes.headers["Content-Type"] = "text/event-stream";
    proxyRes.headers["Cache-Control"] = "no-cache";
    proxyRes.headers["Connection"] = "keep-alive";
    proxyRes.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN;
    proxyRes.headers["Access-Control-Allow-Credentials"] = "true";
    delete proxyRes.headers["content-length"];
  },
  proxyTimeout: 0, // Disable timeout
});

// API Proxy Middleware
const apiProxy = createProxyMiddleware({
  target: TARGET_SERVER,
  changeOrigin: true,
  onProxyRes: (proxyRes) => {
    proxyRes.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN;
    proxyRes.headers["Access-Control-Allow-Credentials"] = "true";
  },
});

// Routes
app.use("/sse", sseProxy); // SSE-specific route
app.use("/api", apiProxy); // Regular API route

// Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Handle preflight requests
app.options("*", cors(corsOptions));

// Start Server
app.listen(PORT, () => {
  console.log(`
  Proxy Server Running
  -------------------
  Local:  http://localhost:${PORT}
  Target: ${TARGET_SERVER}
  Allowed Origin: ${ALLOWED_ORIGIN}
  SSE Path: /sse -> /api
  `);
});
