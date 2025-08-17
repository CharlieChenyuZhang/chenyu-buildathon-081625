const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { analyzeImageComprehensive } = require("../utils/openai");

const router = express.Router();

// JSON file storage for uploaded screenshots
const STORAGE_FILE = path.join(__dirname, "../data/visual_entities.json");
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
      { entities: [], lastUpdated: new Date().toISOString() },
      null,
      2
    )
  );
}

// Helper functions for JSON file storage
function loadVisualEntities() {
  try {
    const data = fs.readFileSync(STORAGE_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading visual entities:", error);
    return { entities: [], lastUpdated: new Date().toISOString() };
  }
}

function saveVisualEntities(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving visual entities:", error);
    return false;
  }
}

function addVisualEntity(entity) {
  const data = loadVisualEntities();
  data.entities.push(entity);
  return saveVisualEntities(data);
}

function updateVisualEntity(id, updates) {
  const data = loadVisualEntities();
  const index = data.entities.findIndex((entity) => entity.id === id);
  if (index !== -1) {
    data.entities[index] = { ...data.entities[index], ...updates };
    return saveVisualEntities(data);
  }
  return false;
}

function deleteVisualEntity(id) {
  const data = loadVisualEntities();
  data.entities = data.entities.filter((entity) => entity.id !== id);
  return saveVisualEntities(data);
}

// Image validation helper function
const isValidImage = (file) => {
  const allowedTypes = /jpeg|jpg|png|gif|bmp|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  return mimetype && extname;
};

// Folder validation helper function
const validateFolderStructure = (files) => {
  const folderNames = new Set();
  const fileNames = new Set();

  files.forEach((file) => {
    const pathParts = file.originalname.split("/");

    // Check for nested folders
    if (pathParts.length > 2) {
      throw new Error(
        `Nested folders detected in: ${file.originalname}. Only single-level folders are allowed.`
      );
    }

    if (pathParts.length === 2) {
      folderNames.add(pathParts[0]);
      fileNames.add(pathParts[1]);
    } else {
      fileNames.add(pathParts[0]);
    }
  });

  // Validate all files are images
  files.forEach((file) => {
    if (!isValidImage(file)) {
      throw new Error(
        `Invalid file type: ${file.originalname}. Only image files are allowed.`
      );
    }
  });

  return {
    hasFolders: folderNames.size > 0,
    folderCount: folderNames.size,
    fileCount: fileNames.size,
    folders: Array.from(folderNames),
  };
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/screenshots");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Preserve folder structure if present
    const pathParts = file.originalname.split("/");
    if (pathParts.length === 2) {
      // Create folder structure
      const folderPath = path.join(
        __dirname,
        "../uploads/screenshots",
        pathParts[0]
      );
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      const uniqueName = `${
        pathParts[0]
      }/${uuidv4()}-${Date.now()}${path.extname(pathParts[1])}`;
      cb(null, uniqueName);
    } else {
      const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(
        file.originalname
      )}`;
      cb(null, uniqueName);
    }
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 100, // Allow up to 100 files
  },
  fileFilter: (req, file, cb) => {
    if (isValidImage(file)) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type: ${file.originalname}. Only image files are allowed.`
        )
      );
    }
  },
});

// POST /api/visual-memory/upload-screenshots
// Upload screenshots with enhanced validation
router.post(
  "/upload-screenshots",
  upload.array("screenshots", 100),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: "No files uploaded",
          details: "Please select at least one image file to upload.",
        });
      }

      // Validate folder structure and file types
      let folderValidation;
      try {
        folderValidation = validateFolderStructure(req.files);
      } catch (validationError) {
        return res.status(400).json({
          error: "Upload validation failed",
          details: validationError.message,
        });
      }

      const uploadedFiles = [];
      const processingErrors = [];

      // Process each screenshot with comprehensive analysis
      for (const file of req.files) {
        try {
          const imageBuffer = fs.readFileSync(file.path);
          const imageType = path.extname(file.originalname).substring(1);

          // Perform comprehensive analysis using the new function
          const analysisResults = await analyzeImageComprehensive(
            imageBuffer,
            imageType
          );

          const processedFile = {
            id: uuidv4(),
            filename: file.filename,
            originalName: file.originalname,
            path: path.relative(process.cwd(), file.path), // Store relative path
            size: file.size,
            uploadedAt: new Date(),
            processed: true,
            folder: file.originalname.includes("/")
              ? file.originalname.split("/")[0]
              : null,
            // Structured analysis results
            analysis: {
              textContent: analysisResults.textContent,
              visualDescription: analysisResults.visualDescription,
              entityAnalysis: analysisResults.entityAnalysis,
              processedAt: analysisResults.processedAt,
              analysisVersion: analysisResults.analysisVersion,
            },
            // Extracted metadata for easy searching
            metadata: {
              extractedText: analysisResults.textContent,
              visualElements:
                analysisResults.entityAnalysis.summary?.ui_components || [],
              dominantColors:
                analysisResults.entityAnalysis.summary?.dominant_colors || [],
              primaryObjects:
                analysisResults.entityAnalysis.summary?.primary_objects || [],
              totalEntities:
                analysisResults.entityAnalysis.summary?.total_entities || 0,
              entityTypes:
                analysisResults.entityAnalysis.entities?.map((e) => e.type) ||
                [],
            },
            // Searchable tags
            tags: [
              ...(analysisResults.entityAnalysis.summary?.ui_components || []),
              ...(analysisResults.entityAnalysis.summary?.dominant_colors ||
                []),
              ...(analysisResults.entityAnalysis.summary?.primary_objects ||
                []),
              ...(analysisResults.entityAnalysis.entities?.map(
                (e) => e.label
              ) || []),
            ].filter((tag, index, arr) => arr.indexOf(tag) === index), // Remove duplicates
          };

          uploadedFiles.push(processedFile);
        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          processingErrors.push({
            filename: file.originalname,
            error: error.message,
          });

          // Add file without processing if AI processing fails
          uploadedFiles.push({
            id: uuidv4(),
            filename: file.filename,
            originalName: file.originalname,
            path: path.relative(process.cwd(), file.path), // Store relative path
            size: file.size,
            uploadedAt: new Date(),
            processed: false,
            error: error.message,
            folder: file.originalname.includes("/")
              ? file.originalname.split("/")[0]
              : null,
            analysis: null,
            metadata: null,
            tags: [],
          });
        }
      }

      // Store uploaded files in JSON file
      uploadedFiles.forEach((file) => {
        addVisualEntity({
          id: file.id,
          filename: file.filename,
          originalName: file.originalName,
          path: file.path,
          size: file.size,
          uploadedAt: file.uploadedAt,
          processed: file.processed,
          folder: file.folder,
          analysis: file.analysis,
          metadata: file.metadata,
          tags: file.tags,
        });
      });

      res.json({
        message: "Upload completed successfully",
        summary: {
          totalFiles: req.files.length,
          successfullyProcessed: uploadedFiles.filter((f) => f.processed)
            .length,
          processingErrors: processingErrors.length,
          folderStructure: folderValidation,
        },
        files: uploadedFiles,
        errors: processingErrors,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        error: "Failed to upload files",
        details: error.message,
      });
    }
  }
);

// POST /api/visual-memory/search
// Search screenshots using natural language queries
router.post("/search", async (req, res) => {
  try {
    const { query, filters = {} } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const data = loadVisualEntities();
    const entities = data.entities;

    // Search through uploaded screenshots
    const searchResults = [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower
      .split(/\s+/)
      .filter((word) => word.length > 0);

    entities.forEach((entity) => {
      if (!entity.processed || !entity.analysis) {
        return; // Skip unprocessed screenshots
      }

      let confidence = 0;
      const textMatches = [];
      const visualMatches = [];
      const entityMatches = [];
      const tagMatches = [];
      let matchDetails = {};

      // Enhanced text content search
      if (
        entity.analysis.textContent &&
        entity.analysis.textContent !== "No text found."
      ) {
        const textContent = entity.analysis.textContent.toLowerCase();

        // Exact phrase match
        if (textContent.includes(queryLower)) {
          confidence += 0.5;
          textMatches.push(`Exact text match: "${query}"`);
          matchDetails.textExact = true;
        }

        // Word-by-word matching
        const matchedWords = queryWords.filter((word) =>
          textContent.includes(word)
        );
        if (matchedWords.length > 0) {
          confidence += 0.3 * (matchedWords.length / queryWords.length);
          textMatches.push(`Text contains: ${matchedWords.join(", ")}`);
          matchDetails.textWords = matchedWords;
        }
      }

      // Enhanced visual description search
      if (entity.analysis.visualDescription) {
        const visualDesc = entity.analysis.visualDescription.toLowerCase();

        // Exact phrase match in visual description
        if (visualDesc.includes(queryLower)) {
          confidence += 0.4;
          visualMatches.push(`Visual description contains: "${query}"`);
          matchDetails.visualExact = true;
        }

        // Word-by-word matching in visual description
        const matchedVisualWords = queryWords.filter((word) =>
          visualDesc.includes(word)
        );
        if (matchedVisualWords.length > 0) {
          confidence += 0.25 * (matchedVisualWords.length / queryWords.length);
          visualMatches.push(
            `Visual elements: ${matchedVisualWords.join(", ")}`
          );
          matchDetails.visualWords = matchedVisualWords;
        }
      }

      // Enhanced tag search
      if (entity.tags && entity.tags.length > 0) {
        entity.tags.forEach((tag) => {
          const tagLower = tag.toLowerCase();

          // Exact tag match
          if (tagLower === queryLower) {
            confidence += 0.4;
            tagMatches.push(`Exact tag match: "${tag}"`);
            matchDetails.tagExact = true;
          }
          // Partial tag match
          else if (
            tagLower.includes(queryLower) ||
            queryLower.includes(tagLower)
          ) {
            confidence += 0.2;
            tagMatches.push(`Tag contains: "${tag}"`);
            matchDetails.tagPartial = true;
          }
          // Word matching in tags
          else {
            const matchedTagWords = queryWords.filter((word) =>
              tagLower.includes(word)
            );
            if (matchedTagWords.length > 0) {
              confidence += 0.1 * (matchedTagWords.length / queryWords.length);
              tagMatches.push(
                `Tag "${tag}" matches: ${matchedTagWords.join(", ")}`
              );
            }
          }
        });
      }

      // Enhanced entity search
      if (entity.analysis.entityAnalysis?.entities) {
        entity.analysis.entityAnalysis.entities.forEach((entity) => {
          const entityLabel = entity.label.toLowerCase();
          const entityType = entity.type.toLowerCase();

          // Exact entity label match
          if (entityLabel === queryLower) {
            confidence += 0.3;
            entityMatches.push(
              `Exact entity: "${entity.label}" (${entity.type})`
            );
            matchDetails.entityExact = true;
          }
          // Partial entity match
          else if (
            entityLabel.includes(queryLower) ||
            queryLower.includes(entityLabel)
          ) {
            confidence += 0.15;
            entityMatches.push(
              `Entity contains: "${entity.label}" (${entity.type})`
            );
            matchDetails.entityPartial = true;
          }
          // Entity type match
          else if (entityType === queryLower) {
            confidence += 0.1;
            entityMatches.push(
              `Entity type: "${entity.type}" - "${entity.label}"`
            );
            matchDetails.entityType = true;
          }
        });
      }

      // Enhanced metadata search
      if (entity.metadata) {
        // Search in dominant colors
        if (entity.metadata.dominantColors) {
          entity.metadata.dominantColors.forEach((color) => {
            if (color.toLowerCase().includes(queryLower)) {
              confidence += 0.1;
              visualMatches.push(`Color match: "${color}"`);
              matchDetails.colorMatch = true;
            }
          });
        }

        // Search in primary objects
        if (entity.metadata.primaryObjects) {
          entity.metadata.primaryObjects.forEach((obj) => {
            if (obj.toLowerCase().includes(queryLower)) {
              confidence += 0.15;
              visualMatches.push(`Primary object: "${obj}"`);
              matchDetails.primaryObject = true;
            }
          });
        }

        // Search in entity types
        if (entity.metadata.entityTypes) {
          entity.metadata.entityTypes.forEach((type) => {
            if (type.toLowerCase().includes(queryLower)) {
              confidence += 0.1;
              entityMatches.push(`Entity type: "${type}"`);
              matchDetails.entityTypeMatch = true;
            }
          });
        }
      }

      // Apply filters if provided
      if (filters.folder && entity.folder !== filters.folder) {
        return; // Skip if folder filter doesn't match
      }

      if (filters.minConfidence && confidence < filters.minConfidence) {
        return; // Skip if confidence is too low
      }

      // If we found matches, add to results
      if (confidence > 0) {
        // Calculate relevance score based on recency and confidence
        const daysSinceUpload =
          (new Date() - new Date(entity.uploadedAt)) / (1000 * 60 * 60 * 24);
        const recencyBonus = Math.max(0, 1 - daysSinceUpload / 30); // Bonus for recent uploads
        const finalConfidence = Math.min(1.0, confidence + recencyBonus * 0.1);

        searchResults.push({
          id: entity.id,
          filename: entity.filename,
          originalName: entity.originalName,
          confidence: finalConfidence,
          textMatches: [...new Set(textMatches)], // Remove duplicates
          visualMatches: [...new Set(visualMatches)],
          entityMatches: [...new Set(entityMatches)],
          tagMatches: [...new Set(tagMatches)],
          thumbnail: `/api/visual-memory/thumbnail/${entity.id}`,
          timestamp: entity.uploadedAt,
          textContent: entity.analysis.textContent,
          visualDescription: entity.analysis.visualDescription,
          entityCount: entity.metadata?.totalEntities || 0,
          tags: entity.tags || [],
          folder: entity.folder,
          matchDetails: matchDetails,
          // Add additional metadata for better display
          dominantColors: entity.metadata?.dominantColors || [],
          primaryObjects: entity.metadata?.primaryObjects || [],
          entityTypes: entity.metadata?.entityTypes || [],
          fileSize: entity.size,
          uploadedDate: entity.uploadedAt,
        });
      }
    });

    // Sort by confidence (highest first)
    searchResults.sort((a, b) => b.confidence - a.confidence);

    // Apply limit if specified
    const limit = filters.limit || searchResults.length;
    const limitedResults = searchResults.slice(0, limit);

    res.json({
      query: query,
      results: limitedResults,
      totalResults: searchResults.length,
      filters: filters,
      searchStats: {
        totalEntities: entities.length,
        processedEntities: entities.filter((e) => e.processed).length,
        queryWords: queryWords,
        averageConfidence:
          searchResults.length > 0
            ? searchResults.reduce((sum, r) => sum + r.confidence, 0) /
              searchResults.length
            : 0,
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed", details: error.message });
  }
});

// GET /api/visual-memory/screenshots
// Get all uploaded screenshots
router.get("/screenshots", async (req, res) => {
  try {
    const data = loadVisualEntities();
    res.json({ screenshots: data.entities });
  } catch (error) {
    console.error("Error fetching screenshots:", error);
    res.status(500).json({ error: "Failed to fetch screenshots" });
  }
});

// GET /api/visual-memory/screenshot/:id
// Get specific screenshot details
router.get("/screenshot/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const data = loadVisualEntities();
    const screenshot = data.entities.find((s) => s.id === id);

    if (!screenshot) {
      return res.status(404).json({ error: "Screenshot not found" });
    }

    res.json({ screenshot });
  } catch (error) {
    console.error("Error fetching screenshot:", error);
    res.status(500).json({ error: "Failed to fetch screenshot" });
  }
});

// GET /api/visual-memory/screenshot/:id/analysis
// Get detailed analysis results for a specific screenshot
router.get("/screenshot/:id/analysis", async (req, res) => {
  try {
    const { id } = req.params;

    const data = loadVisualEntities();
    const screenshot = data.entities.find((s) => s.id === id);

    if (!screenshot) {
      return res.status(404).json({ error: "Screenshot not found" });
    }

    if (!screenshot.processed || !screenshot.analysis) {
      return res
        .status(400)
        .json({ error: "Screenshot has not been processed" });
    }

    res.json({
      id: screenshot.id,
      filename: screenshot.filename,
      originalName: screenshot.originalName,
      uploadedAt: screenshot.uploadedAt,
      analysis: screenshot.analysis,
      metadata: screenshot.metadata,
      tags: screenshot.tags,
      folder: screenshot.folder,
    });
  } catch (error) {
    console.error("Error fetching screenshot analysis:", error);
    res.status(500).json({ error: "Failed to fetch screenshot analysis" });
  }
});

// DELETE /api/visual-memory/screenshot/:id
// Delete a screenshot
router.delete("/screenshot/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (deleteVisualEntity(id)) {
      res.json({ message: "Screenshot deleted successfully" });
    } else {
      res.status(404).json({ error: "Screenshot not found" });
    }
  } catch (error) {
    console.error("Error deleting screenshot:", error);
    res.status(500).json({ error: "Failed to delete screenshot" });
  }
});

// GET /api/visual-memory/thumbnail/:id
// Serve thumbnail/image for a specific screenshot
router.get("/thumbnail/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const data = loadVisualEntities();
    const screenshot = data.entities.find((s) => s.id === id);

    if (!screenshot) {
      return res.status(404).json({ error: "Screenshot not found" });
    }

    // Convert relative path to absolute path
    const absolutePath = path.isAbsolute(screenshot.path) 
      ? screenshot.path 
      : path.join(process.cwd(), screenshot.path);
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: "Image file not found" });
    }

    // Get file stats
    const stats = fs.statSync(absolutePath);
    const fileSize = stats.size;
    const ext = path.extname(screenshot.path).toLowerCase();

    // Set appropriate content type
    let contentType = "image/jpeg"; // default
    switch (ext) {
      case ".png":
        contentType = "image/png";
        break;
      case ".gif":
        contentType = "image/gif";
        break;
      case ".bmp":
        contentType = "image/bmp";
        break;
      case ".webp":
        contentType = "image/webp";
        break;
    }

    // Set headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year

    // Stream the file
    const fileStream = fs.createReadStream(absolutePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error serving thumbnail:", error);
    res.status(500).json({ error: "Failed to serve thumbnail" });
  }
});

// GET /api/visual-memory/storage-info
// Get information about the JSON storage
router.get("/storage-info", async (req, res) => {
  try {
    const data = loadVisualEntities();
    const stats = fs.statSync(STORAGE_FILE);

    res.json({
      storageFile: STORAGE_FILE,
      fileSize: stats.size,
      totalEntities: data.entities.length,
      lastUpdated: data.lastUpdated,
      processedEntities: data.entities.filter((e) => e.processed).length,
      unprocessedEntities: data.entities.filter((e) => !e.processed).length,
      folders: [...new Set(data.entities.map((e) => e.folder).filter(Boolean))],
      entityTypes: [
        ...new Set(data.entities.flatMap((e) => e.metadata?.entityTypes || [])),
      ],
    });
  } catch (error) {
    console.error("Error fetching storage info:", error);
    res.status(500).json({ error: "Failed to fetch storage info" });
  }
});

// POST /api/visual-memory/clear-storage
// Clear all stored entities (for testing/reset)
router.post("/clear-storage", async (req, res) => {
  try {
    const success = saveVisualEntities({
      entities: [],
      lastUpdated: new Date().toISOString(),
    });

    if (success) {
      res.json({ message: "Storage cleared successfully" });
    } else {
      res.status(500).json({ error: "Failed to clear storage" });
    }
  } catch (error) {
    console.error("Error clearing storage:", error);
    res.status(500).json({ error: "Failed to clear storage" });
  }
});

module.exports = router;
