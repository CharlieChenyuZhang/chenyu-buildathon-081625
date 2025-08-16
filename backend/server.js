const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8080;
const isDevelopment = process.env.NODE_ENV === "development";

// Development configuration
let devConfig = {};
if (isDevelopment) {
  try {
    devConfig = require("./dev.config");
  } catch (error) {
    console.log("⚠️  dev.config.js not found, using default settings");
  }
}

// Middleware
app.use(
  cors(
    devConfig.server?.cors || {
      origin: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://main.dolpvcksb3r4b.amplifyapp.com",
      ],
      credentials: true,
    }
  )
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Development logging middleware
if (isDevelopment && devConfig.features?.requestLogging) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const method = req.method;
      const url = req.url;
      const statusColor =
        status >= 400 ? "\x1b[31m" : status >= 300 ? "\x1b[33m" : "\x1b[32m";
      console.log(
        `${statusColor}${method}\x1b[0m ${url} - ${status} (${duration}ms)`
      );
    });
    next();
  });
}

// Import route modules
const visualMemoryRoutes = require("./routes/visualMemory");
const voiceToSlideRoutes = require("./routes/voiceToSlide");
const employeeEngagementRoutes = require("./routes/employeeEngagement");
const codebaseTimeMachineRoutes = require("./routes/codebaseTimeMachine");
const knowledgeGraphRoutes = require("./routes/knowledgeGraph");

// Route middleware
app.use("/api/visual-memory", visualMemoryRoutes);
app.use("/api/voice-to-slide", voiceToSlideRoutes);
app.use("/api/employee-engagement", employeeEngagementRoutes);
app.use("/api/codebase-time-machine", codebaseTimeMachineRoutes);
app.use("/api/knowledge-graph", knowledgeGraphRoutes);

// Health check endpoint (for App Runner)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Buildathon API is running" });
});

// Legacy health check endpoint (for backward compatibility)
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Buildathon API is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  if (isDevelopment && devConfig.features?.stackTraces) {
    console.error("Stack trace:", err.stack);
  }
  res.status(500).json({
    error: "Something went wrong!",
    ...(isDevelopment && { details: err.message }),
  });
});

const host = "0.0.0.0"; // Bind to all interfaces for container deployment
app.listen(PORT, host, () => {
  console.log(`🚀 Server running on http://${host}:${PORT}`);
  if (isDevelopment) {
    console.log(`📡 Development mode enabled`);
    console.log(`🔄 Hot reload active - watching for changes`);
    console.log(`🌐 API available at http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
  } else {
    console.log(`📊 Health check: http://${host}:${PORT}/health`);
  }
});

module.exports = app;
