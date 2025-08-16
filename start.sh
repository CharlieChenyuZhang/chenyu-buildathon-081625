#!/bin/bash

echo "🚀 Starting Buildathon Projects..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing frontend dependencies..."
npm install

echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

       echo "🔧 Creating backend environment file..."
       if [ ! -f backend/.env ]; then
           cat > backend/.env << EOF
       # Server Configuration
       PORT=8080
       NODE_ENV=development

       # OpenAI API (Required for all AI features - OCR, transcription, analysis)
       OPENAI_API_KEY=your_openai_api_key_here

# Slack API (for Employee Engagement)
SLACK_BOT_TOKEN=your_slack_bot_token_here
SLACK_SIGNING_SECRET=your_slack_signing_secret_here

# File Upload Configuration
MAX_FILE_SIZE=100000000
UPLOAD_PATH=./uploads

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=info
EOF
               echo "✅ Created backend/.env file. Please update it with your API keys."
           echo "⚠️  IMPORTANT: You must add your OpenAI API key to backend/.env for AI features to work!"
else
    echo "✅ Backend environment file already exists."
fi

echo "📁 Creating upload directories..."
mkdir -p backend/uploads/screenshots
mkdir -p backend/uploads/audio
mkdir -p backend/uploads/documents

echo "🎯 Starting servers..."

# Start backend in background
echo "🔧 Starting backend server on port 8080..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend server on port 3000..."
npm start

# Cleanup function
cleanup() {
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for background processes
wait
