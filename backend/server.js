const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Buildathon API is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
