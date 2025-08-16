const OpenAI = require("openai");
const fs = require("fs");

// Check if OpenAI API key is configured
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY environment variable is not set!");
  console.error("📝 Please create a .env file in the backend directory with:");
  console.error("   OPENAI_API_KEY=your_actual_api_key_here");
  console.error(
    "🔗 Get your API key from: https://platform.openai.com/api-keys"
  );
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract text from image using GPT-4 Vision
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} imageType - Image type (png, jpg, etc.)
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromImage(imageBuffer, imageType = "png") {
  try {
    const base64Image = imageBuffer.toString("base64");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this image. Return only the text content, no explanations. If there's no text, return 'No text found'.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/${imageType};base64,${base64Image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error extracting text from image:", error);
    throw new Error("Failed to extract text from image");
  }
}

/**
 * Generate visual description of image using GPT-4 Vision
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} imageType - Image type
 * @returns {Promise<string>} Visual description
 */
async function generateVisualDescription(imageBuffer, imageType = "png") {
  try {
    const base64Image = imageBuffer.toString("base64");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this image in detail, focusing on visual elements, UI components, colors, layout, and any interactive elements. Be specific about what you see.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/${imageType};base64,${base64Image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error generating visual description:", error);
    throw new Error("Failed to generate visual description");
  }
}

/**
 * Transcribe audio using Whisper
 * @param {string} filePath - Path to audio file
 * @param {string} audioType - Audio type (mp3, wav, etc.)
 * @returns {Promise<string>} Transcribed text
 */
async function transcribeAudio(filePath, audioType = "mp3") {
  try {
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      response_format: "text",
    });

    return response;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw new Error("Failed to transcribe audio");
  }
}

/**
 * Analyze content and generate slide structure
 * @param {string} content - Transcribed content
 * @returns {Promise<Object>} Slide structure with content and speaker notes
 */
async function generateSlideStructure(content) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a presentation expert. Create a structured slide deck from the given content. Return a JSON object with slides array, each containing title, content, and speakerNotes. Aim for 5-7 slides.",
        },
        {
          role: "user",
          content: `Create a slide deck from this content: ${content}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Error generating slide structure:", error);
    throw new Error("Failed to generate slide structure");
  }
}

/**
 * Analyze sentiment of text
 * @param {string} text - Text to analyze
 * @returns {Promise<Object>} Sentiment analysis results
 */
async function analyzeSentiment(text) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "Analyze the sentiment of the given text. Return a JSON object with sentiment (positive/negative/neutral), confidence (0-1), and emotions array. Format your response as valid JSON only.",
        },
        {
          role: "user",
          content: `Analyze sentiment: ${text}`,
        },
      ],
      max_tokens: 200,
    });

    const content = response.choices[0].message.content;

    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.warn("Failed to parse JSON response, using fallback:", content);
      // Fallback: simple sentiment analysis
      const lowerText = text.toLowerCase();
      let sentiment = "neutral";
      let confidence = 0.5;

      const positiveWords = [
        "good",
        "great",
        "awesome",
        "excellent",
        "happy",
        "love",
        "like",
        "thanks",
        "thank you",
        "👍",
        "😊",
        "🎉",
      ];
      const negativeWords = [
        "bad",
        "terrible",
        "awful",
        "hate",
        "dislike",
        "angry",
        "sad",
        "😔",
        "😤",
        "😴",
      ];

      const positiveCount = positiveWords.filter((word) =>
        lowerText.includes(word)
      ).length;
      const negativeCount = negativeWords.filter((word) =>
        lowerText.includes(word)
      ).length;

      if (positiveCount > negativeCount) {
        sentiment = "positive";
        confidence = Math.min(0.8, 0.5 + positiveCount * 0.1);
      } else if (negativeCount > positiveCount) {
        sentiment = "negative";
        confidence = Math.min(0.8, 0.5 + negativeCount * 0.1);
      }

      return {
        sentiment,
        confidence,
        emotions: [],
      };
    }
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    // Return neutral sentiment as fallback
    return {
      sentiment: "neutral",
      confidence: 0.5,
      emotions: [],
    };
  }
}

/**
 * Extract entities and relationships from text for knowledge graph
 * @param {string} text - Text to process
 * @returns {Promise<Object>} Entities and relationships
 */
async function extractEntitiesAndRelationships(text) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "Extract entities and relationships from the text. Return a JSON object with entities array (each with id, label, type, description) and relationships array (each with source, target, label, weight).",
        },
        {
          role: "user",
          content: `Extract entities and relationships from: ${text}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Error extracting entities:", error);
    throw new Error("Failed to extract entities and relationships");
  }
}

/**
 * Answer questions about knowledge graph content
 * @param {string} question - User question
 * @param {Array} context - Relevant context documents
 * @returns {Promise<Object>} Answer with confidence and sources
 */
async function answerQuestion(question, context) {
  try {
    const contextText = context.map((doc) => doc.content).join("\n\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "Answer the question based on the provided context. Return a JSON object with answer, confidence (0-1), and sources array with document names and relevance scores.",
        },
        {
          role: "user",
          content: `Context: ${contextText}\n\nQuestion: ${question}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Error answering question:", error);
    throw new Error("Failed to answer question");
  }
}

/**
 * Analyze code changes and extract insights
 * @param {string} commitMessage - Git commit message
 * @param {Array} fileChanges - Array of file changes
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeCodeChanges(commitMessage, fileChanges) {
  try {
    const changesText = fileChanges
      .map(
        (change) =>
          `${change.file}: ${change.linesAdded} added, ${change.linesRemoved} removed`
      )
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "Analyze the code changes and commit message. Return a JSON object with impact (high/medium/low), type (feature/bugfix/refactor), and description of what was changed.",
        },
        {
          role: "user",
          content: `Commit: ${commitMessage}\nChanges:\n${changesText}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Error analyzing code changes:", error);
    throw new Error("Failed to analyze code changes");
  }
}

/**
 * Generate insights from employee engagement data
 * @param {Object} engagementData - Engagement metrics and trends
 * @returns {Promise<Object>} Generated insights and recommendations
 */
async function generateEngagementInsights(engagementData) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "Analyze employee engagement data and generate actionable insights. Return a JSON object with insights array, recommendations array, and metrics object.",
        },
        {
          role: "user",
          content: `Analyze this engagement data: ${JSON.stringify(
            engagementData
          )}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Error generating engagement insights:", error);
    throw new Error("Failed to generate engagement insights");
  }
}

/**
 * Detect entities from image using GPT-4 Vision
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} imageType - Image type (png, jpg, etc.)
 * @returns {Promise<Object>} Detected entities with categories and details
 */
async function detectEntitiesFromImage(imageBuffer, imageType = "png") {
  try {
    const base64Image = imageBuffer.toString("base64");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image and detect all entities present. Return a JSON object with the following structure:
{
  "entities": [
    {
      "id": "unique_id",
      "type": "object|person|text|ui_element|symbol|logo|button|form|table|chart|diagram|icon",
      "label": "descriptive name",
      "description": "detailed description",
      "confidence": 0.95,
      "bbox": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4},
      "attributes": {
        "color": "blue",
        "size": "large",
        "text": "button text if applicable",
        "style": "rounded, modern, etc."
      }
    }
  ],
  "summary": {
    "total_entities": 5,
    "primary_objects": ["button", "text", "form"],
    "dominant_colors": ["blue", "white", "gray"],
    "ui_components": ["login form", "submit button", "input fields"]
  }
}

Focus on detecting:
- UI elements (buttons, forms, inputs, menus, dialogs)
- Text content and labels
- Icons and symbols
- People or objects
- Charts, diagrams, or visual data
- Colors and styling information
- Layout and positioning`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/${imageType};base64,${base64Image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Error detecting entities from image:", error);
    throw new Error("Failed to detect entities from image");
  }
}

/**
 * Comprehensive image analysis combining text extraction, visual description, and entity detection
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} imageType - Image type (png, jpg, etc.)
 * @returns {Promise<Object>} Complete analysis results
 */
async function analyzeImageComprehensive(imageBuffer, imageType = "png") {
  try {
    // Process all three analyses in parallel for efficiency
    const [textContent, visualDescription, entityAnalysis] = await Promise.all([
      extractTextFromImage(imageBuffer, imageType),
      generateVisualDescription(imageBuffer, imageType),
      detectEntitiesFromImage(imageBuffer, imageType),
    ]);

    return {
      textContent,
      visualDescription,
      entityAnalysis,
      processedAt: new Date().toISOString(),
      analysisVersion: "1.0",
    };
  } catch (error) {
    console.error("Error in comprehensive image analysis:", error);
    throw new Error("Failed to perform comprehensive image analysis");
  }
}

module.exports = {
  extractTextFromImage,
  generateVisualDescription,
  detectEntitiesFromImage,
  analyzeImageComprehensive,
  transcribeAudio,
  generateSlideStructure,
  analyzeSentiment,
  extractEntitiesAndRelationships,
  answerQuestion,
  analyzeCodeChanges,
  generateEngagementInsights,
};
