const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { transcribeAudio, generateSlideStructure } = require("../utils/openai");

const router = express.Router();

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/audio");
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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for audio
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp3|wav|m4a|aac|ogg|webm/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = file.mimetype.startsWith("audio/");

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed!"));
    }
  },
});

// POST /api/voice-to-slide/upload-audio
// Upload audio file for slide generation
router.post("/upload-audio", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    const audioFile = {
      id: uuidv4(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      uploadedAt: new Date(),
      status: "processing",
    };

    // Process audio file with GPT-4 and Whisper
    try {
      const audioBuffer = fs.readFileSync(req.file.path);
      const audioType = path.extname(req.file.originalname).substring(1);

      // Transcribe audio using Whisper
      const transcribedText = await transcribeAudio(audioBuffer, audioType);

      // Generate slide structure using GPT-4
      const slideStructure = await generateSlideStructure(transcribedText);

      audioFile.transcribedText = transcribedText;
      audioFile.slideStructure = slideStructure;
      audioFile.status = "completed";
    } catch (error) {
      console.error("Error processing audio:", error);
      audioFile.status = "failed";
      audioFile.error = error.message;
    }

    res.json({
      message: "Audio uploaded successfully",
      file: audioFile,
      status: "processing",
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload audio" });
  }
});

// POST /api/voice-to-slide/record-audio
// Record audio directly in the browser
router.post("/record-audio", async (req, res) => {
  try {
    const { audioBlob, duration } = req.body;

    if (!audioBlob) {
      return res.status(400).json({ error: "No audio data received" });
    }

    // TODO: Save recorded audio and process
    // - Convert blob to file
    // - Save to disk
    // - Process for slide generation

    const recordedAudio = {
      id: uuidv4(),
      duration: duration,
      recordedAt: new Date(),
    };

    res.json({
      message: "Audio recorded successfully",
      audio: recordedAudio,
      status: "processing",
    });
  } catch (error) {
    console.error("Recording error:", error);
    res.status(500).json({ error: "Failed to record audio" });
  }
});

// POST /api/voice-to-slide/generate-slides
// Generate slides from audio file
router.post("/generate-slides", async (req, res) => {
  try {
    const { audioId, options } = req.body;

    if (!audioId) {
      return res.status(400).json({ error: "Audio ID is required" });
    }

    // Get the processed audio file
    const audioFilePath = path.join(__dirname, "../uploads/audio");
    const audioFiles = fs.readdirSync(audioFilePath);
    const audioFile = audioFiles.find((file) => file.includes(audioId));

    if (!audioFile) {
      return res.status(404).json({ error: "Audio file not found" });
    }

    // Load the processed audio data
    const audioDataPath = path.join(
      audioFilePath,
      audioFile.replace(/\.[^/.]+$/, ".json")
    );
    let audioData = null;

    if (fs.existsSync(audioDataPath)) {
      audioData = JSON.parse(fs.readFileSync(audioDataPath, "utf8"));
    }

    // Generate slide deck from processed audio
    const slideDeck = {
      id: uuidv4(),
      audioId: audioId,
      slides: audioData?.slideStructure?.slides || [
        {
          id: "1",
          title: "Introduction",
          content: "Welcome to our presentation...",
          speakerNotes: "Start with a warm greeting and overview of topics",
          order: 1,
        },
        {
          id: "2",
          title: "Key Points",
          content: "Main discussion points...",
          speakerNotes: "Highlight the three main areas we'll cover",
          order: 2,
        },
      ],
      totalSlides: audioData?.slideStructure?.slides?.length || 5,
      generatedAt: new Date(),
      format: options?.format || "html",
      transcribedText:
        audioData?.transcribedText || "Audio transcription not available",
    };

    res.json({
      message: "Slide deck generated successfully",
      deck: slideDeck,
    });
  } catch (error) {
    console.error("Generation error:", error);
    res.status(500).json({ error: "Failed to generate slides" });
  }
});

// GET /api/voice-to-slide/deck/:id
// Get generated slide deck
router.get("/deck/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: Fetch from database
    const deck = {
      id: id,
      slides: [
        {
          id: "1",
          title: "Introduction",
          content: "Welcome to our presentation...",
          speakerNotes: "Start with a warm greeting",
          order: 1,
        },
      ],
      totalSlides: 5,
      generatedAt: new Date(),
      format: "html",
    };

    res.json({ deck });
  } catch (error) {
    console.error("Error fetching deck:", error);
    res.status(500).json({ error: "Failed to fetch slide deck" });
  }
});

// GET /api/voice-to-slide/deck/:id/download
// Download slide deck as HTML or PDF
router.get("/deck/:id/download", async (req, res) => {
  try {
    const { id } = req.params;
    const { format = "html" } = req.query;

    // TODO: Generate and return file
    // - Create HTML presentation or PDF
    // - Set appropriate headers
    // - Stream file to client

    res.json({
      message: "Download endpoint - implementation needed",
      deckId: id,
      format: format,
    });
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: "Failed to download slide deck" });
  }
});

// GET /api/voice-to-slide/status/:audioId
// Check processing status of audio file
router.get("/status/:audioId", async (req, res) => {
  try {
    const { audioId } = req.params;

    // TODO: Check actual status from database/queue
    const status = {
      audioId: audioId,
      status: "completed", // processing, completed, failed
      progress: 100,
      message: "Audio processed successfully",
    };

    res.json({ status });
  } catch (error) {
    console.error("Status check error:", error);
    res.status(500).json({ error: "Failed to check status" });
  }
});

// GET /api/voice-to-slide/history
// Get user's slide generation history
router.get("/history", async (req, res) => {
  try {
    // TODO: Fetch from database
    const history = [
      {
        id: "1",
        audioName: "presentation1.wav",
        generatedAt: new Date(),
        slideCount: 5,
        status: "completed",
      },
    ];

    res.json({ history });
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

module.exports = router;
