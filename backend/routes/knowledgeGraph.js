const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const {
  extractEntitiesAndRelationships,
  answerQuestion,
} = require("../utils/openai");

const router = express.Router();

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/documents");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /txt|pdf|doc|docx|md|html/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only document files are allowed!"));
    }
  },
});

// POST /api/knowledge-graph/create-project
// Create a new knowledge graph project
router.post("/create-project", async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Project name is required" });
    }

    const project = {
      id: uuidv4(),
      name: name,
      description: description || "",
      createdAt: new Date(),
      status: "active",
      documents: [],
      graphStats: {
        nodes: 0,
        edges: 0,
        concepts: 0,
      },
    };

    res.json({
      message: "Knowledge graph project created successfully",
      project: project,
    });
  } catch (error) {
    console.error("Project creation error:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// POST /api/knowledge-graph/project/:id/upload-documents
// Upload documents to a project
router.post(
  "/project/:id/upload-documents",
  upload.array("documents", 50),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No documents uploaded" });
      }

      const uploadedFiles = req.files.map((file) => ({
        id: uuidv4(),
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        size: file.size,
        uploadedAt: new Date(),
        status: "pending",
      }));

      // Process documents with GPT-4
      for (const file of uploadedFiles) {
        try {
          const filePath = file.path;
          const fileExtension = path.extname(file.originalName).toLowerCase();

          let textContent = "";

          // Extract text based on file type
          if (fileExtension === ".txt" || fileExtension === ".md") {
            textContent = fs.readFileSync(filePath, "utf8");
          } else if (fileExtension === ".pdf") {
            // TODO: Add PDF text extraction
            textContent = "PDF content extraction not implemented yet";
          } else {
            textContent = "Unsupported file type";
          }

          // Extract entities and relationships using GPT-4
          if (textContent && textContent !== "Unsupported file type") {
            const extractionResult = await extractEntitiesAndRelationships(
              textContent
            );

            file.textContent = textContent;
            file.entities = extractionResult.entities || [];
            file.relationships = extractionResult.relationships || [];
            file.processed = true;
          } else {
            file.processed = false;
            file.error = "Could not extract text content";
          }
        } catch (error) {
          console.error(`Error processing file ${file.originalName}:`, error);
          file.processed = false;
          file.error = error.message;
        }
      }

      res.json({
        message: "Documents uploaded successfully",
        projectId: id,
        count: uploadedFiles.length,
        files: uploadedFiles,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload documents" });
    }
  }
);

// POST /api/knowledge-graph/project/:id/add-url
// Add URL content to the knowledge graph
router.post("/project/:id/add-url", async (req, res) => {
  try {
    const { id } = req.params;
    const { url, title } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // TODO: Fetch and process URL content
    // - Scrape webpage content
    // - Extract text and structure
    // - Add to knowledge graph

    const urlContent = {
      id: uuidv4(),
      url: url,
      title: title || "Untitled",
      addedAt: new Date(),
      status: "processing",
    };

    res.json({
      message: "URL added successfully",
      projectId: id,
      content: urlContent,
    });
  } catch (error) {
    console.error("URL addition error:", error);
    res.status(500).json({ error: "Failed to add URL" });
  }
});

// POST /api/knowledge-graph/project/:id/build-graph
// Build or rebuild the knowledge graph
router.post("/project/:id/build-graph", async (req, res) => {
  try {
    const { id } = req.params;
    const { options } = req.body;

    // TODO: Build knowledge graph
    // - Process all documents and URLs
    // - Extract entities and relationships
    // - Create graph structure
    // - Calculate embeddings

    const graphBuild = {
      id: uuidv4(),
      projectId: id,
      status: "processing",
      startedAt: new Date(),
      options: options || {},
    };

    res.json({
      message: "Knowledge graph build started",
      build: graphBuild,
    });
  } catch (error) {
    console.error("Graph build error:", error);
    res.status(500).json({ error: "Failed to build knowledge graph" });
  }
});

// GET /api/knowledge-graph/project/:id/graph
// Get the knowledge graph data
router.get("/project/:id/graph", async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: Fetch graph from database
    const graph = {
      projectId: id,
      nodes: [
        {
          id: "1",
          label: "Machine Learning",
          type: "concept",
          properties: {
            frequency: 45,
            documents: ["doc1.txt", "doc2.pdf"],
            description: "A subset of artificial intelligence",
          },
        },
        {
          id: "2",
          label: "Neural Networks",
          type: "concept",
          properties: {
            frequency: 32,
            documents: ["doc1.txt"],
            description:
              "Computing systems inspired by biological neural networks",
          },
        },
      ],
      edges: [
        {
          id: "1",
          source: "1",
          target: "2",
          label: "includes",
          weight: 0.85,
        },
      ],
      stats: {
        totalNodes: 150,
        totalEdges: 320,
        concepts: 120,
        entities: 30,
      },
    };

    res.json({ graph });
  } catch (error) {
    console.error("Error fetching graph:", error);
    res.status(500).json({ error: "Failed to fetch knowledge graph" });
  }
});

// POST /api/knowledge-graph/project/:id/query
// Query the knowledge graph with natural language
router.post("/project/:id/query", async (req, res) => {
  try {
    const { id } = req.params;
    const { question, options } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    // TODO: Process natural language query
    // - Parse question
    // - Search knowledge graph
    // - Generate answer with sources

    // Process question using GPT-4
    let queryResult;
    try {
      // TODO: Get relevant context from knowledge graph
      const mockContext = [
        {
          content:
            "Machine Learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed.",
          document: "doc1.txt",
        },
        {
          content:
            "Neural networks are computing systems inspired by biological neural networks.",
          document: "doc2.pdf",
        },
      ];

      const aiResult = await answerQuestion(question, mockContext);
      queryResult = {
        id: uuidv4(),
        projectId: id,
        question: question,
        ...aiResult,
      };
    } catch (error) {
      console.error("Error processing question:", error);
      // Fallback to mock result if AI processing fails
      queryResult = {
        id: uuidv4(),
        projectId: id,
        question: question,
        answer:
          "Machine Learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. It includes various techniques such as neural networks, which are computing systems inspired by biological neural networks.",
        confidence: 0.92,
        sources: [
          {
            document: "doc1.txt",
            page: 15,
            relevance: 0.95,
          },
          {
            document: "doc2.pdf",
            page: 8,
            relevance: 0.87,
          },
        ],
        relatedConcepts: [
          {
            id: "1",
            label: "Machine Learning",
            relevance: 0.95,
          },
          {
            id: "2",
            label: "Neural Networks",
            relevance: 0.87,
          },
        ],
      };
    }

    res.json({ queryResult });
  } catch (error) {
    console.error("Query error:", error);
    res.status(500).json({ error: "Failed to process query" });
  }
});

// GET /api/knowledge-graph/project/:id/visualization
// Get graph visualization data
router.get("/project/:id/visualization", async (req, res) => {
  try {
    const { id } = req.params;
    const { layout = "force", filters } = req.query;

    // TODO: Generate visualization data
    const visualization = {
      projectId: id,
      layout: layout,
      nodes: [
        {
          id: "1",
          label: "Machine Learning",
          x: 100,
          y: 200,
          size: 20,
          color: "#ff6b6b",
          group: "concept",
        },
        {
          id: "2",
          label: "Neural Networks",
          x: 300,
          y: 150,
          size: 15,
          color: "#4ecdc4",
          group: "concept",
        },
      ],
      edges: [
        {
          id: "1",
          source: "1",
          target: "2",
          weight: 0.85,
          color: "#45b7d1",
        },
      ],
      groups: [
        {
          id: "concept",
          label: "Concepts",
          color: "#ff6b6b",
        },
        {
          id: "entity",
          label: "Entities",
          color: "#4ecdc4",
        },
      ],
    };

    res.json({ visualization });
  } catch (error) {
    console.error("Error fetching visualization:", error);
    res.status(500).json({ error: "Failed to fetch visualization data" });
  }
});

// GET /api/knowledge-graph/project/:id/documents
// Get all documents in the project
router.get("/project/:id/documents", async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: Fetch from database
    const documents = [
      {
        id: "1",
        name: "Machine Learning Basics.txt",
        type: "txt",
        size: 15000,
        uploadedAt: new Date(),
        status: "processed",
        concepts: 25,
      },
      {
        id: "2",
        name: "AI Research Paper.pdf",
        type: "pdf",
        size: 2500000,
        uploadedAt: new Date(),
        status: "processed",
        concepts: 45,
      },
    ];

    res.json({ documents });
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// GET /api/knowledge-graph/projects
// Get all knowledge graph projects
router.get("/projects", async (req, res) => {
  try {
    // TODO: Fetch from database
    const projects = [
      {
        id: "1",
        name: "AI Research Knowledge Graph",
        description: "Knowledge graph for AI and machine learning research",
        createdAt: new Date(),
        status: "active",
        graphStats: {
          nodes: 150,
          edges: 320,
          concepts: 120,
        },
      },
      {
        id: "2",
        name: "Company Documentation",
        description: "Internal company knowledge base",
        createdAt: new Date(),
        status: "active",
        graphStats: {
          nodes: 75,
          edges: 180,
          concepts: 60,
        },
      },
    ];

    res.json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// DELETE /api/knowledge-graph/project/:id
// Delete a knowledge graph project
router.delete("/project/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: Delete project and all associated data

    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

module.exports = router;
