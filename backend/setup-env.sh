#!/bin/bash

# Setup script for environment variables

echo "🔧 Setting up environment variables..."

# Check if .env file already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled."
        exit 1
    fi
fi

# Copy from example file
if [ -f "env.example" ]; then
    cp env.example .env
    echo "✅ Created .env file from env.example"
else
    echo "❌ env.example file not found!"
    exit 1
fi

echo ""
echo "📝 Next steps:"
echo "1. Edit the .env file and add your OpenAI API key"
echo "2. Get your API key from: https://platform.openai.com/api-keys"
echo "3. Replace 'your_openai_api_key_here' with your actual API key"
echo ""
echo "🚀 Then run: npm run dev"
