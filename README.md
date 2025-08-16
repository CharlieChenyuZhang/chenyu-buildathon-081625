# Buildathon Projects - AI-Powered Applications

A collection of 5 innovative AI-powered applications built for a hackathon. Each project demonstrates different aspects of modern AI technology and provides practical solutions for real-world problems. All projects leverage GPT-4 for advanced AI processing including OCR, transcription, sentiment analysis, and natural language understanding.

## 🚀 Projects Overview

### 1. Visual Memory Search

**Search your screenshot history using natural language queries for both text content AND visual elements.**

- **Features:**

  - Upload multiple screenshots (up to 50 files)
  - OCR text extraction and visual description generation
  - Natural language search queries
  - Support for both text and visual element searches
  - Confidence scoring for search results
  - Top 5 matches with detailed breakdown

- **Use Cases:**
  - Finding specific error messages in screenshots
  - Locating UI elements or buttons
  - Searching through design mockups
  - Document organization and retrieval

### 2. Voice-to-Slide Generator

**Generate a polished slide deck from a 3-minute spoken prompt.**

- **Features:**

  - Audio file upload (MP3, WAV, M4A, AAC, OGG, WebM)
  - Real-time audio recording in browser
  - Automatic transcription and content analysis
  - Slide deck generation with speaker notes
  - Multiple output formats (HTML, PDF)
  - Generation history tracking

- **Use Cases:**
  - Quick presentation creation
  - Meeting note conversion
  - Educational content generation
  - Business proposal development

### 3. Employee Engagement Pulse

**Provide managers with a weekly sentiment dashboard built from all messages in configurable Slack channels.**

- **Features:**

  - Slack workspace integration
  - Multi-channel monitoring
  - Real-time sentiment analysis
  - Text and emoji sentiment processing
  - Weekly trend analysis
  - Burnout warning system
  - Actionable insights for managers
  - Real-time alerts and notifications

- **Use Cases:**
  - Team morale monitoring
  - Manager decision support
  - Employee wellness tracking
  - Organizational health assessment

### 4. Codebase Time Machine

**Navigate any codebase through time, understanding evolution of features and architectural decisions.**

- **Features:**

  - Git repository analysis
  - Full commit history processing
  - Natural language queries about code evolution
  - Code ownership visualization
  - Complexity trend analysis
  - Feature timeline mapping
  - Architectural decision tracking
  - Contributor analysis

- **Use Cases:**
  - Understanding legacy code
  - Tracking feature development
  - Code review and audit
  - Team productivity analysis

### 5. Universal Knowledge-Graph Builder

**Convert a document archive into an interactive knowledge graph with NL Q&A.**

- **Features:**

  - Document ingestion (TXT, PDF, DOC, DOCX, MD, HTML)
  - URL content scraping
  - Knowledge graph construction
  - Natural language Q&A interface
  - Interactive graph visualization
  - Source attribution
  - Confidence scoring
  - Multiple project support

- **Use Cases:**
  - Research paper analysis
  - Company knowledge base
  - Educational content organization
  - Legal document analysis

## 🤖 AI-Powered Features

All projects leverage advanced AI capabilities powered by OpenAI's GPT-4:

### GPT-4 Vision Integration

- **Visual Memory Search**: Advanced image analysis and text extraction from screenshots
- **OCR Processing**: High-accuracy text extraction from images using GPT-4 Vision
- **Visual Description Generation**: Detailed descriptions of UI elements and visual content

### Whisper Audio Processing

- **Voice-to-Slide Generator**: High-quality audio transcription for spoken content
- **Real-time Processing**: Fast and accurate speech-to-text conversion
- **Multi-language Support**: Automatic language detection and transcription

### GPT-4 Natural Language Processing

- **Semantic Search**: Intelligent search across all content types
- **Sentiment Analysis**: Advanced emotion and sentiment detection for employee engagement
- **Code Analysis**: Understanding code changes and architectural decisions
- **Knowledge Graph Q&A**: Natural language question answering over document collections
- **Content Generation**: Automated slide deck creation and insights generation

### Advanced AI Capabilities

- **Multi-modal Processing**: Combining text, image, and audio analysis
- **Context Understanding**: Deep comprehension of content relationships
- **Confidence Scoring**: Reliable accuracy metrics for all AI outputs
- **Fallback Handling**: Graceful degradation when AI services are unavailable

## 🛠️ Technology Stack

### Backend

- **Node.js** with Express.js
- **Multer** for file uploads
- **OpenAI GPT-4** for AI processing (OCR, transcription, analysis)
- **OpenAI Whisper** for audio transcription
- **OpenAI GPT-4 Vision** for image analysis and text extraction
- **Slack API** for workspace integration
- **Simple-git** for repository analysis
- **Natural** for text processing
- **PDF-lib** for document generation

### Frontend

- **React 19** with modern hooks
- **React Router** for navigation
- **Axios** for API communication
- **CSS3** with modern styling
- **Responsive design** for mobile compatibility

## 📦 Installation & Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Git

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Configure environment variables
# Add your API keys and configuration

# Start development server
npm run dev
```

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm start
```

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=8080
NODE_ENV=development

# OpenAI API
# OpenAI API Configuration (Required for all AI features)
OPENAI_API_KEY=your_openai_api_key

# Slack API
SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_SIGNING_SECRET=your_slack_signing_secret

# File Upload
MAX_FILE_SIZE=100000000
UPLOAD_PATH=./uploads

# Database (if using)
DATABASE_URL=your_database_url
```

## 🚀 API Endpoints

### Visual Memory Search

- `POST /api/visual-memory/upload-screenshots` - Upload screenshots
- `POST /api/visual-memory/search` - Search with natural language
- `GET /api/visual-memory/screenshots` - Get all screenshots
- `GET /api/visual-memory/screenshot/:id` - Get specific screenshot

### Voice-to-Slide Generator

- `POST /api/voice-to-slide/upload-audio` - Upload audio file
- `POST /api/voice-to-slide/record-audio` - Record audio
- `POST /api/voice-to-slide/generate-slides` - Generate slides
- `GET /api/voice-to-slide/deck/:id` - Get slide deck
- `GET /api/voice-to-slide/deck/:id/download` - Download slides

### Employee Engagement

- `POST /api/employee-engagement/connect-slack` - Connect Slack workspace
- `GET /api/employee-engagement/dashboard/:workspaceId` - Get dashboard
- `GET /api/employee-engagement/sentiment/:workspaceId` - Get sentiment data
- `POST /api/employee-engagement/insights/:workspaceId` - Generate insights
- `GET /api/employee-engagement/alerts/:workspaceId` - Get alerts

### Codebase Time Machine

- `POST /api/codebase-time-machine/analyze-repo` - Analyze repository
- `POST /api/codebase-time-machine/query` - Query codebase
- `GET /api/codebase-time-machine/evolution/:analysisId` - Get evolution data
- `GET /api/codebase-time-machine/ownership/:analysisId` - Get ownership data

### Knowledge Graph

- `POST /api/knowledge-graph/create-project` - Create project
- `POST /api/knowledge-graph/project/:id/upload-documents` - Upload documents
- `POST /api/knowledge-graph/project/:id/build-graph` - Build graph
- `POST /api/knowledge-graph/project/:id/query` - Query knowledge graph

## 🎯 Usage Examples

### Visual Memory Search

```javascript
// Upload screenshots
const formData = new FormData();
files.forEach((file) => formData.append("screenshots", file));
await axios.post("/api/visual-memory/upload-screenshots", formData);

// Search for error messages
const response = await axios.post("/api/visual-memory/search", {
  query: "error message about authentication",
  filters: {},
});
```

### Voice-to-Slide Generation

```javascript
// Upload audio and generate slides
const audioFormData = new FormData();
audioFormData.append("audio", audioFile);
const uploadResponse = await axios.post(
  "/api/voice-to-slide/upload-audio",
  audioFormData
);

const slideResponse = await axios.post("/api/voice-to-slide/generate-slides", {
  audioId: uploadResponse.data.file.id,
  options: { format: "html", slideCount: 5 },
});
```

## 🔧 Development

### Project Structure

```
├── backend/
│   ├── routes/           # API route handlers
│   ├── uploads/          # File upload directory
│   ├── server.js         # Main server file
│   └── package.json      # Backend dependencies
├── src/
│   ├── components/       # React components
│   ├── App.js           # Main app component
│   └── index.js         # App entry point
├── public/              # Static assets
└── package.json         # Frontend dependencies
```

### Adding New Features

1. Create new route in `backend/routes/`
2. Add corresponding React component in `src/components/`
3. Update navigation in `src/App.js`
4. Add styling in component-specific CSS file

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for AI capabilities
- Slack for workspace integration
- React team for the amazing framework
- All contributors and participants

## 📞 Support

For support and questions:

- Create an issue in the repository
- Contact the development team
- Check the documentation for each project

---

**Built with ❤️ for the Buildathon**
