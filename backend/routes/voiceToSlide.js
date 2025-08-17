const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const { transcribeAudio, generateSlideStructure } = require("../utils/openai");

const router = express.Router();

// Test endpoint
router.get("/test", (req, res) => {
  res.json({ message: "Voice-to-Slide route is working!" });
});

// Test PDF generation endpoint
router.get("/test-pdf", async (req, res) => {
  try {
    console.log("Testing PDF generation with pdf-lib...");

    const testSlides = [
      {
        title: "Test Slide 1",
        content:
          "This is a test slide to verify PDF generation is working correctly.",
      },
      {
        title: "Test Slide 2",
        content: "If you can see this PDF, the generation is working properly.",
      },
    ];

    const pdfBuffer = await generatePDFWithPdfLib(testSlides);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=test-presentation.pdf"
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Test PDF generation error:", error);
    res.status(500).json({
      error: "PDF generation test failed",
      details: error.message,
    });
  }
});

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
    // More permissive audio file filter
    const allowedMimeTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/wave",
      "audio/x-wav",
      "audio/mp4",
      "audio/aac",
      "audio/ogg",
      "audio/webm",
      "audio/flac",
      "audio/x-m4a",
    ];

    const allowedExtensions = /\.(mp3|wav|m4a|aac|ogg|webm|flac)$/i;

    const hasValidMimeType = allowedMimeTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.test(file.originalname);

    if (hasValidMimeType || hasValidExtension) {
      return cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.source}`));
    }
  },
});

// POST /api/voice-to-slide/upload-audio
// Upload audio file for slide generation
router.post("/upload-audio", (req, res) => {
  upload.single("audio")(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({
        error: "File upload failed",
        details: err.message,
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file uploaded" });
      }

      console.log("File uploaded:", req.file);

      const audioFile = {
        id: uuidv4(),
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: path.relative(process.cwd(), req.file.path), // Store relative path
        size: req.file.size,
        uploadedAt: new Date(),
        status: "processing",
      };

      // Process audio file with GPT-4 and Whisper
      const audioFilePath = path.isAbsolute(req.file.path)
        ? req.file.path
        : path.join(process.cwd(), req.file.path);

      try {
        console.log("Starting audio processing for file:", req.file.filename);
        const audioType = path.extname(req.file.originalname).substring(1);
        console.log("Audio type:", audioType);

        // Transcribe audio using Whisper
        console.log("Starting transcription...");
        const transcribedText = await transcribeAudio(audioFilePath, audioType);
        console.log(
          "Transcription completed, length:",
          transcribedText?.length
        );

        // Generate slide structure using GPT-4
        console.log("Starting slide structure generation...");
        const slideStructure = await generateSlideStructure(transcribedText);
        console.log("Slide structure generated");

        audioFile.transcribedText = transcribedText;
        audioFile.slideStructure = slideStructure;
        audioFile.status = "completed";

        // Save processed data to JSON file using audioId
        const dataPath = path.join(
          path.dirname(audioFilePath),
          `${audioFile.id}.json`
        );
        console.log("Saving JSON file to:", dataPath);

        const jsonData = {
          id: audioFile.id,
          transcribedText,
          slideStructure,
          processedAt: new Date(),
        };

        fs.writeFileSync(dataPath, JSON.stringify(jsonData, null, 2));
        console.log("JSON file saved successfully");
      } catch (error) {
        console.error("Error processing audio:", error);
        audioFile.status = "failed";
        audioFile.error = error.message;

        // Still save a JSON file with error information
        const errorDataPath = path.join(
          path.dirname(audioFilePath),
          `${audioFile.id}.json`
        );

        const errorData = {
          id: audioFile.id,
          status: "failed",
          error: error.message,
          processedAt: new Date(),
        };

        fs.writeFileSync(errorDataPath, JSON.stringify(errorData, null, 2));
        console.log("Error JSON file saved to:", errorDataPath);
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
});

// POST /api/voice-to-slide/record-audio
// Record audio directly in the browser
router.post("/record-audio", (req, res) => {
  upload.single("audioBlob")(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({
        error: "File upload failed",
        details: err.message,
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio data received" });
      }

      console.log("Recorded file uploaded:", req.file);

      const audioFile = {
        id: uuidv4(),
        filename: req.file.filename,
        originalName: "recorded-audio.wav",
        path: path.relative(process.cwd(), req.file.path), // Store relative path
        size: req.file.size,
        recordedAt: new Date(),
        status: "processing",
      };

      // Process recorded audio with Whisper
      const recordedAudioFilePath = path.isAbsolute(req.file.path)
        ? req.file.path
        : path.join(process.cwd(), req.file.path);

      try {
        console.log(
          "Starting recorded audio processing for file:",
          req.file.filename
        );
        const audioType = path.extname(req.file.filename).substring(1);
        console.log("Audio type:", audioType);

        // Transcribe audio using Whisper
        console.log("Starting transcription...");
        const transcribedText = await transcribeAudio(
          recordedAudioFilePath,
          audioType
        );
        console.log(
          "Transcription completed, length:",
          transcribedText?.length
        );

        // Generate slide structure using GPT-4
        console.log("Starting slide structure generation...");
        const slideStructure = await generateSlideStructure(transcribedText);
        console.log("Slide structure generated");

        audioFile.transcribedText = transcribedText;
        audioFile.slideStructure = slideStructure;
        audioFile.status = "completed";

        // Save processed data to JSON file using audioId
        const dataPath = path.join(
          path.dirname(recordedAudioFilePath),
          `${audioFile.id}.json`
        );
        console.log("Saving JSON file to:", dataPath);

        const jsonData = {
          id: audioFile.id,
          transcribedText,
          slideStructure,
          processedAt: new Date(),
        };

        fs.writeFileSync(dataPath, JSON.stringify(jsonData, null, 2));
        console.log("JSON file saved successfully");
      } catch (error) {
        console.error("Error processing recorded audio:", error);
        audioFile.status = "failed";
        audioFile.error = error.message;

        // Still save a JSON file with error information
        const errorDataPath = path.join(
          path.dirname(recordedAudioFilePath),
          `${audioFile.id}.json`
        );

        const errorData = {
          id: audioFile.id,
          status: "failed",
          error: error.message,
          processedAt: new Date(),
        };

        fs.writeFileSync(errorDataPath, JSON.stringify(errorData, null, 2));
        console.log("Error JSON file saved to:", errorDataPath);
      }

      res.json({
        message: "Audio recorded successfully",
        audio: audioFile,
        status: "processing",
      });
    } catch (error) {
      console.error("Recording error:", error);
      res.status(500).json({ error: "Failed to record audio" });
    }
  });
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

    // Generate slide deck from processed audio (without speaker notes)
    const slideDeck = {
      id: audioId, // Use audioId as the deck ID for consistency
      audioId: audioId,
      slides: (
        audioData?.slideStructure?.slides || [
          {
            id: "1",
            title: "Introduction",
            content: "Welcome to our presentation...",
            order: 1,
          },
          {
            id: "2",
            title: "Key Points",
            content: "Main discussion points...",
            order: 2,
          },
          {
            id: "3",
            title: "Details",
            content: "Detailed information...",
            order: 3,
          },
          {
            id: "4",
            title: "Analysis",
            content: "Analysis and insights...",
            order: 4,
          },
          {
            id: "5",
            title: "Conclusion",
            content: "Summary and next steps...",
            order: 5,
          },
        ]
      ).map((slide) => ({
        id: slide.id,
        title: slide.title,
        content: slide.content,
        order: slide.order,
      })),
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
    const { id } = req.params; // This is the audioId
    const { format = "html" } = req.query;

    // Find the slide deck data using the audioId
    const audioFilePath = path.join(__dirname, "../uploads/audio");
    const jsonFilePath = path.join(audioFilePath, `${id}.json`);

    if (!fs.existsSync(jsonFilePath)) {
      return res.status(404).json({ error: "Slide deck not found" });
    }

    const slideDeck = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));

    if (!slideDeck.slideStructure) {
      return res.status(404).json({ error: "Slide structure not found" });
    }

    if (format === "html") {
      // Generate HTML presentation
      const htmlContent = generateHTMLPresentation(
        slideDeck.slideStructure.slides
      );

      // Generate timestamp for filename
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      const filename = `presentation-${timestamp}.html`;

      res.setHeader("Content-Type", "text/html");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send(htmlContent);
    } else if (format === "pdf") {
      // Generate timestamp for filename
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      const filename = `presentation-${timestamp}.pdf`;

      try {
        console.log("Starting PDF generation with pdf-lib...");

        // Generate PDF using pdf-lib
        const pdfBuffer = await generatePDFWithPdfLib(
          slideDeck.slideStructure.slides
        );

        console.log("PDF generated, buffer size:", pdfBuffer.length);

        // Verify PDF buffer is valid
        if (!pdfBuffer || pdfBuffer.length === 0) {
          throw new Error("Generated PDF buffer is empty");
        }

        // Set headers for PDF download
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        res.setHeader("Content-Length", pdfBuffer.length);

        console.log("Sending PDF response...");
        res.send(pdfBuffer);
      } catch (error) {
        console.error("PDF generation error:", error);

        // Fallback: return HTML that can be manually converted to PDF
        console.log("PDF generation failed, falling back to HTML download.");

        const pdfContent = generatePDFPresentation(
          slideDeck.slideStructure.slides
        );
        res.setHeader("Content-Type", "text/html");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="presentation-${timestamp}-for-pdf.html"`
        );
        res.send(pdfContent);
      }
    } else {
      res
        .status(400)
        .json({ error: "Unsupported format. Use 'html' or 'pdf'" });
    }
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: "Failed to download slide deck" });
  }
});

// Helper function to generate HTML presentation
function generateHTMLPresentation(slides) {
  const slideHtml = slides
    .map(
      (slide, index) => `
    <div class="slide" id="slide-${index + 1}">
      <div class="slide-content">
        <h1 class="slide-title">${slide.title}</h1>
        <div class="slide-body">
          <p class="slide-text">${slide.content}</p>
        </div>
      </div>
    </div>
  `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voice-to-Slide Presentation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .presentation-container {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .slide {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 3rem;
            margin-bottom: 2rem;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            position: relative;
            overflow: hidden;
        }
        
        .slide::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #007aff, #5856d6, #ff3b30, #34c759);
        }
        
        .slide-title {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 2rem;
            background: linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            line-height: 1.2;
        }
        
        .slide-text {
            font-size: 1.3rem;
            line-height: 1.6;
            color: #e0e0e0;
            margin: 0;
        }
        
        .slide-number {
            position: absolute;
            top: 1rem;
            right: 1rem;
            background: #007aff;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-weight: 600;
            font-size: 0.9rem;
        }
        
        @media print {
            body {
                background: white;
                color: black;
            }
            
            .slide {
                background: white;
                border: 1px solid #ccc;
                color: black;
                margin-bottom: 1rem;
                page-break-after: always;
            }
            
            .slide-title {
                color: #333;
                -webkit-text-fill-color: #333;
            }
            
            .slide-text {
                color: #666;
            }
                 }
     </style>
 </head>
 <body>
     <div class="presentation-container">
         ${slideHtml}
     </div>
 </body>
 </html>`;
}

// Helper function to generate PDF-optimized HTML presentation
function generatePDFPresentation(slides) {
  // Sanitize slide content to prevent HTML injection and ensure proper escaping
  const sanitizeText = (text) => {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/\n/g, "<br>");
  };

  const slideHtml = slides
    .map(
      (slide, index) => `
    <div class="slide" id="slide-${index + 1}">
      <div class="slide-content">
        <h1 class="slide-title">${sanitizeText(slide.title)}</h1>
        <div class="slide-body">
          <p class="slide-text">${sanitizeText(slide.content)}</p>
        </div>
      </div>
      <div class="slide-number">${index + 1}</div>
    </div>
  `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voice-to-Slide Presentation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, Helvetica, sans-serif;
            background: white;
            color: black;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            font-size: 14px;
        }
        
        .presentation-container {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
        }
        
        .slide {
            background: white;
            border: 2px solid #007aff;
            border-radius: 8px;
            padding: 40px;
            margin-bottom: 20px;
            text-align: center;
            page-break-after: always;
            page-break-inside: avoid;
            min-height: 500px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            position: relative;
            box-sizing: border-box;
        }
        
        .slide:last-child {
            page-break-after: avoid;
        }
        
        .slide::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 6px;
            background: #007aff;
            border-radius: 8px 8px 0 0;
        }
        
        .slide-content {
            width: 100%;
            max-width: 600px;
            z-index: 1;
        }
        
        .slide-title {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 20px;
            color: #1d1d1f;
            line-height: 1.2;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        .slide-text {
            font-size: 1.1rem;
            line-height: 1.6;
            color: #424245;
            margin: 0;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        .slide-number {
            position: absolute;
            top: 15px;
            right: 15px;
            background: #007aff;
            color: white;
            padding: 8px 12px;
            border-radius: 15px;
            font-weight: bold;
            font-size: 0.9rem;
            z-index: 2;
        }
        
        @media print {
            body {
                background: white !important;
                color: black !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            
            .presentation-container {
                margin: 0 !important;
                padding: 0 !important;
            }
            
            .slide {
                background: white !important;
                border: 2px solid #007aff !important;
                color: black !important;
                margin: 10px !important;
                page-break-after: always !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                height: auto !important;
                min-height: 500px !important;
                padding: 40px !important;
            }
            
            .slide:last-child {
                page-break-after: avoid !important;
            }
            
            .slide-title {
                color: #1d1d1f !important;
                -webkit-text-fill-color: #1d1d1f !important;
                font-size: 2rem !important;
            }
            
            .slide-text {
                color: #424245 !important;
                font-size: 1.1rem !important;
            }
            
            .slide-number {
                background: #007aff !important;
                color: white !important;
            }
        }
        
        @page {
            size: A4;
            margin: 0.5in;
        }
    </style>
</head>
<body>
    <div class="presentation-container">
        ${slideHtml}
    </div>
</body>
</html>`;
}

// GET /api/voice-to-slide/deck/:id/speaker-notes
// Download speaker notes as text file
router.get("/deck/:id/speaker-notes", async (req, res) => {
  try {
    const { id } = req.params; // This is now the audioId

    // Find the slide deck data using the audioId
    const audioFilePath = path.join(__dirname, "../uploads/audio");

    if (!fs.existsSync(audioFilePath)) {
      return res.status(404).json({ error: "Audio directory not found" });
    }

    // Look for the JSON file with this audioId
    const jsonFilePath = path.join(audioFilePath, `${id}.json`);

    if (!fs.existsSync(jsonFilePath)) {
      return res.status(404).json({ error: "Slide deck not found" });
    }

    const slideDeck = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));

    if (!slideDeck.slideStructure) {
      return res.status(404).json({ error: "Slide structure not found" });
    }

    // Generate speaker notes text from the original slide structure (which includes speaker notes)
    let speakerNotesText = `SPEAKER NOTES\n`;
    speakerNotesText += `Generated on: ${new Date().toLocaleDateString()}\n`;
    speakerNotesText += `Total Slides: ${slideDeck.slideStructure.slides.length}\n\n`;

    slideDeck.slideStructure.slides.forEach((slide, index) => {
      speakerNotesText += `SLIDE ${index + 1}: ${slide.title}\n`;
      speakerNotesText += `Content: ${slide.content}\n`;
      if (slide.speakerNotes) {
        speakerNotesText += `Notes: ${slide.speakerNotes}\n`;
      }
      speakerNotesText += `\n`;
    });

    // Generate timestamp for filename
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `speaker-notes-${timestamp}.txt`;

    // Set headers for text file download
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    res.send(speakerNotesText);
  } catch (error) {
    console.error("Speaker notes download error:", error);
    res.status(500).json({ error: "Failed to download speaker notes" });
  }
});

// GET /api/voice-to-slide/status/:audioId
// Check processing status of audio file
router.get("/status/:audioId", async (req, res) => {
  try {
    const { audioId } = req.params;
    console.log("Checking status for audioId:", audioId);

    // Look for the JSON file with transcription data
    const audioFilePath = path.join(__dirname, "../uploads/audio");

    // Check if directory exists
    if (!fs.existsSync(audioFilePath)) {
      console.log("Audio directory does not exist:", audioFilePath);
      return res.status(404).json({ error: "Audio directory not found" });
    }

    const files = fs.readdirSync(audioFilePath);
    console.log("Available files:", files);

    // More flexible file matching - look for any JSON file that might contain this audioId
    const jsonFiles = files.filter((file) => file.endsWith(".json"));
    console.log("Found JSON files:", jsonFiles);

    let foundData = null;
    let foundJsonFile = null;

    // Check each JSON file to see if it contains the right audioId
    for (const jsonFile of jsonFiles) {
      try {
        const jsonPath = path.join(audioFilePath, jsonFile);
        const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

        if (data.id === audioId) {
          foundData = data;
          foundJsonFile = jsonFile;
          break;
        }
      } catch (error) {
        console.log("Error reading JSON file:", jsonFile, error.message);
      }
    }

    console.log("Found matching JSON file:", foundJsonFile);

    if (foundData) {
      let status, progress, message;

      if (foundData.status === "failed") {
        status = "failed";
        progress = 0;
        message = "Audio processing failed";
      } else if (foundData.status === "partial") {
        status = "partial";
        progress = 75;
        message = "Transcription completed, slide generation failed";
      } else {
        status = "completed";
        progress = 100;
        message = "Audio processed successfully";
      }

      const statusResponse = {
        audioId: audioId,
        status: status,
        progress: progress,
        message: message,
        transcribedText: foundData.transcribedText,
      };

      res.json({ status: statusResponse });
    } else {
      // Check if audio file exists but no JSON yet
      const audioFile = files.find(
        (file) => file.includes(audioId) && !file.endsWith(".json")
      );

      console.log("Found audio file:", audioFile);

      if (audioFile) {
        const status = {
          audioId: audioId,
          status: "processing",
          progress: 50,
          message: "Processing audio...",
        };
        res.json({ status });
      } else {
        console.log("No files found for audioId:", audioId);
        res.status(404).json({
          error: "Audio file not found",
          audioId: audioId,
          availableFiles: files,
        });
      }
    }
  } catch (error) {
    console.error("Status check error:", error);
    res.status(500).json({ error: "Failed to check status" });
  }
});

// GET /api/voice-to-slide/transcription/:audioId
// Get transcription data for audio file
router.get("/transcription/:audioId", async (req, res) => {
  try {
    const { audioId } = req.params;

    // Look for the JSON file with transcription data
    const audioFilePath = path.join(__dirname, "../uploads/audio");
    const files = fs.readdirSync(audioFilePath);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    let foundData = null;

    // Check each JSON file to see if it contains the right audioId
    for (const jsonFile of jsonFiles) {
      try {
        const jsonPath = path.join(audioFilePath, jsonFile);
        const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

        if (data.id === audioId) {
          foundData = data;
          break;
        }
      } catch (error) {
        console.log("Error reading JSON file:", jsonFile, error.message);
      }
    }

    if (foundData) {
      res.json({
        audioId: audioId,
        transcribedText: foundData.transcribedText,
        slideStructure: foundData.slideStructure,
        processedAt: foundData.processedAt,
      });
    } else {
      res.status(404).json({ error: "Transcription not found" });
    }
  } catch (error) {
    console.error("Transcription fetch error:", error);
    res.status(500).json({ error: "Failed to fetch transcription" });
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

// Helper function to generate PDF using pdf-lib
async function generatePDFWithPdfLib(slides) {
  try {
    console.log("Creating PDF document with pdf-lib...");

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // Embed the standard font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Set page dimensions (A4)
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 50;
    const contentWidth = pageWidth - 2 * margin;
    const contentHeight = pageHeight - 2 * margin;

    // Process each slide
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];

      // Add a new page for each slide
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Draw slide number
      const slideNumber = `${i + 1}`;
      const slideNumberWidth = boldFont.widthOfTextAtSize(slideNumber, 12);
      page.drawText(slideNumber, {
        x: pageWidth - margin - slideNumberWidth - 10,
        y: pageHeight - margin - 20,
        size: 12,
        font: boldFont,
        color: rgb(0, 0.48, 1), // Blue color
      });

      // Draw slide title
      const title = slide.title || `Slide ${i + 1}`;
      const titleFontSize = 24;
      const titleWidth = boldFont.widthOfTextAtSize(title, titleFontSize);

      // Center the title
      const titleX = (pageWidth - titleWidth) / 2;
      page.drawText(title, {
        x: titleX,
        y: pageHeight - margin - 80,
        size: titleFontSize,
        font: boldFont,
        color: rgb(0.11, 0.11, 0.12), // Dark gray
      });

      // Draw slide content
      const content = slide.content || "No content available";
      const contentFontSize = 14;
      const lineHeight = contentFontSize * 1.4;

      // Split content into lines that fit within the page width
      const words = content.split(" ");
      const lines = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine + (currentLine ? " " : "") + word;
        const testWidth = font.widthOfTextAtSize(testLine, contentFontSize);

        if (testWidth <= contentWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            // Word is too long, split it
            lines.push(word);
          }
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }

      // Draw content lines
      let contentY = pageHeight - margin - 120;
      for (const line of lines) {
        if (contentY < margin + 50) {
          // If we run out of space, break
          break;
        }

        page.drawText(line, {
          x: margin,
          y: contentY,
          size: contentFontSize,
          font: font,
          color: rgb(0.26, 0.26, 0.27), // Medium gray
        });

        contentY -= lineHeight;
      }

      // Draw a decorative line at the top
      page.drawLine({
        start: { x: margin, y: pageHeight - margin - 10 },
        end: { x: pageWidth - margin, y: pageHeight - margin - 10 },
        thickness: 3,
        color: rgb(0, 0.48, 1), // Blue color
      });
    }

    // Serialize the PDF to bytes
    const pdfBytes = await pdfDoc.save();
    console.log("PDF generated successfully, size:", pdfBytes.length);

    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error("Error generating PDF with pdf-lib:", error);
    throw error;
  }
}

module.exports = router;
