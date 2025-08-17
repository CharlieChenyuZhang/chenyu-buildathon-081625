const express = require("express");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const { analyzeEmailClusters } = require("../utils/openai");
const gmailService = require("../utils/gmailService");

const router = express.Router();

// JSON file storage for email clusters
const STORAGE_FILE = path.join(__dirname, "../data/email_clusters.json");
const DATA_DIR = path.dirname(STORAGE_FILE);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize storage file if it doesn't exist
if (!fs.existsSync(STORAGE_FILE)) {
  fs.writeFileSync(
    STORAGE_FILE,
    JSON.stringify(
      { clusters: [], lastUpdated: new Date().toISOString() },
      null,
      2
    )
  );
}

// Helper functions for JSON file storage
function loadEmailClusters() {
  try {
    const data = fs.readFileSync(STORAGE_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading email clusters:", error);
    return { clusters: [], lastUpdated: new Date().toISOString() };
  }
}

function saveEmailClusters(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving email clusters:", error);
    return false;
  }
}

function addEmailCluster(cluster) {
  const data = loadEmailClusters();
  data.clusters.push(cluster);
  return saveEmailClusters(data);
}

function updateEmailCluster(id, updates) {
  const data = loadEmailClusters();
  const index = data.clusters.findIndex((cluster) => cluster.id === id);
  if (index !== -1) {
    data.clusters[index] = { ...data.clusters[index], ...updates };
    return saveEmailClusters(data);
  }
  return false;
}

function deleteEmailCluster(id) {
  const data = loadEmailClusters();
  data.clusters = data.clusters.filter((cluster) => cluster.id !== id);
  return saveEmailClusters(data);
}

// POST /api/inbox-triage/authenticate
// Authenticate with Gmail using OAuth2
router.post("/authenticate", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email is required",
        details: "Please provide your Gmail address for authentication.",
      });
    }

    // Try to authenticate with Gmail API
    const authResult = await gmailService.authenticate();

    if (authResult.authenticated) {
      res.json({
        success: true,
        email: email,
        authenticatedAt: new Date().toISOString(),
        message: authResult.message,
      });
    } else {
      res.json({
        success: false,
        authUrl: authResult.authUrl,
        message: authResult.message,
        requiresAuth: true,
      });
    }
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({
      error: "Authentication failed",
      details: error.message,
    });
  }
});

// POST /api/inbox-triage/fetch-emails
// Fetch last 200 emails from Gmail using Gmail API
router.post("/fetch-emails", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email is required",
        details: "Please provide the email address to fetch emails from.",
      });
    }

    // Fetch real emails from Gmail API
    const emails = await gmailService.fetchEmails(200);

    res.json({
      success: true,
      email: email,
      totalEmails: emails.length,
      emails: emails,
      message: `Successfully fetched ${emails.length} emails from Gmail`,
    });
  } catch (error) {
    console.error("Email fetching error:", error);
    res.status(500).json({
      error: "Failed to fetch emails",
      details: error.message,
    });
  }
});

// POST /api/inbox-triage/cluster-emails
// Cluster emails into actionable groups
router.post("/cluster-emails", async (req, res) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        error: "Emails array is required",
        details: "Please provide an array of emails to cluster.",
      });
    }

    // Use OpenAI to analyze and cluster emails
    const clusterAnalysis = await analyzeEmailClusters(emails);

    // Create cluster objects
    const clusters = clusterAnalysis.clusters.map((cluster, index) => ({
      id: uuidv4(),
      name: cluster.name,
      description: cluster.description,
      action: cluster.action,
      emailIds: cluster.emailIds,
      count: cluster.emailIds.length,
      priority: cluster.priority,
      createdAt: new Date().toISOString(),
      emails: emails.filter((email) => cluster.emailIds.includes(email.id)),
    }));

    // Store clusters
    clusters.forEach((cluster) => {
      addEmailCluster(cluster);
    });

    res.json({
      success: true,
      totalEmails: emails.length,
      clusters: clusters,
      analysis: clusterAnalysis.analysis,
      message: `Successfully clustered ${emails.length} emails into ${clusters.length} actionable groups`,
    });
  } catch (error) {
    console.error("Email clustering error:", error);
    res.status(500).json({
      error: "Failed to cluster emails",
      details: error.message,
    });
  }
});

// POST /api/inbox-triage/archive-cluster
// Archive all emails in a cluster using Gmail API
router.post("/archive-cluster/:clusterId", async (req, res) => {
  try {
    const { clusterId } = req.params;

    const data = loadEmailClusters();
    const cluster = data.clusters.find((c) => c.id === clusterId);

    if (!cluster) {
      return res.status(404).json({
        error: "Cluster not found",
        details: "The specified cluster could not be found.",
      });
    }

    // Archive emails using Gmail API
    const archiveResults = await gmailService.archiveEmails(cluster.emailIds);

    // Update cluster status
    updateEmailCluster(clusterId, {
      archived: true,
      archivedAt: new Date().toISOString(),
      archivedEmails: archiveResults,
    });

    const successfulArchives = archiveResults.filter(
      (result) => result.status === "archived"
    ).length;

    res.json({
      success: true,
      clusterId: clusterId,
      clusterName: cluster.name,
      archivedEmails: archiveResults,
      message: `Successfully archived ${successfulArchives} out of ${cluster.emailIds.length} emails from cluster "${cluster.name}"`,
    });
  } catch (error) {
    console.error("Archive error:", error);
    res.status(500).json({
      error: "Failed to archive cluster",
      details: error.message,
    });
  }
});

// GET /api/inbox-triage/clusters
// Get all email clusters
router.get("/clusters", async (req, res) => {
  try {
    const data = loadEmailClusters();
    res.json({
      clusters: data.clusters,
      totalClusters: data.clusters.length,
      lastUpdated: data.lastUpdated,
    });
  } catch (error) {
    console.error("Error fetching clusters:", error);
    res.status(500).json({
      error: "Failed to fetch clusters",
      details: error.message,
    });
  }
});

// GET /api/inbox-triage/cluster/:id
// Get specific cluster details
router.get("/cluster/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const data = loadEmailClusters();
    const cluster = data.clusters.find((c) => c.id === id);

    if (!cluster) {
      return res.status(404).json({
        error: "Cluster not found",
        details: "The specified cluster could not be found.",
      });
    }

    res.json({ cluster });
  } catch (error) {
    console.error("Error fetching cluster:", error);
    res.status(500).json({
      error: "Failed to fetch cluster",
      details: error.message,
    });
  }
});

// DELETE /api/inbox-triage/cluster/:id
// Delete a cluster
router.delete("/cluster/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (deleteEmailCluster(id)) {
      res.json({ message: "Cluster deleted successfully" });
    } else {
      res.status(404).json({
        error: "Cluster not found",
        details: "The specified cluster could not be found.",
      });
    }
  } catch (error) {
    console.error("Error deleting cluster:", error);
    res.status(500).json({
      error: "Failed to delete cluster",
      details: error.message,
    });
  }
});

// GET /api/inbox-triage/auth/callback
// Handle OAuth2 callback from Google
router.get("/auth/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        error: "Authorization code is required",
        details: "No authorization code received from Google OAuth.",
      });
    }

    // Exchange code for tokens
    const tokens = await gmailService.getTokensFromCode(code);

    // Set credentials
    await gmailService.setCredentials(tokens);

    res.json({
      success: true,
      message:
        "Successfully authenticated with Gmail! You can now close this window and return to the app.",
      authenticatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).json({
      error: "Authentication failed",
      details: error.message,
    });
  }
});

// GET /api/inbox-triage/test
// Test endpoint to verify API is working
router.get("/test", (req, res) => {
  res.json({
    message: "Inbox Triage API is working",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    storageFile: STORAGE_FILE,
    clusters: loadEmailClusters().clusters.length,
  });
});

// GET /api/inbox-triage/storage-info
// Get information about the JSON storage
router.get("/storage-info", async (req, res) => {
  try {
    const data = loadEmailClusters();
    const stats = fs.statSync(STORAGE_FILE);

    res.json({
      storageFile: STORAGE_FILE,
      fileSize: stats.size,
      totalClusters: data.clusters.length,
      lastUpdated: data.lastUpdated,
      archivedClusters: data.clusters.filter((c) => c.archived).length,
      activeClusters: data.clusters.filter((c) => !c.archived).length,
      totalEmails: data.clusters.reduce((sum, c) => sum + c.count, 0),
    });
  } catch (error) {
    console.error("Error fetching storage info:", error);
    res.status(500).json({
      error: "Failed to fetch storage info",
      details: error.message,
    });
  }
});

// POST /api/inbox-triage/clear-storage
// Clear all stored clusters (for testing/reset)
router.post("/clear-storage", async (req, res) => {
  try {
    const success = saveEmailClusters({
      clusters: [],
      lastUpdated: new Date().toISOString(),
    });

    if (success) {
      res.json({ message: "Storage cleared successfully" });
    } else {
      res.status(500).json({
        error: "Failed to clear storage",
        details: "Could not clear the storage file.",
      });
    }
  } catch (error) {
    console.error("Error clearing storage:", error);
    res.status(500).json({
      error: "Failed to clear storage",
      details: error.message,
    });
  }
});

module.exports = router;
