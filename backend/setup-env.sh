#!/bin/bash

echo "Setting up Slack Employee Engagement Environment Variables"
echo "========================================================"
echo ""

# Check if .env already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists. This will overwrite it."
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 1
    fi
fi

echo ""
echo "📋 Creating .env file with your Slack app credentials..."
echo ""

# Create .env file
cat > .env << 'EOF'
# OpenAI API Configuration
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=8080
NODE_ENV=development

# Slack App Configuration
# From your Slack app credentials:
SLACK_APP_ID=A09ARAWCV1C
SLACK_CLIENT_ID=8802479792208.9365370437046
SLACK_CLIENT_SECRET=2c6a0e04c32a5ea4b7fc41774e8a028a
SLACK_SIGNING_SECRET=1c304d5329d5c3721b79927f2e3279b9
SLACK_VERIFICATION_TOKEN=anYoClk8ZeygaDUGqxtjdiXT

# Bot Token (you'll need to get this from your Slack app)
# This is the Bot User OAuth Token that starts with xoxb-
SLACK_BOT_TOKEN=xoxb-your-bot-token-here

# Default channels to monitor
DEFAULT_SLACK_CHANNELS=aifund-buildathon-081625
EOF

echo "✅ .env file created successfully!"
echo ""
echo "🔧 Next steps:"
echo "1. Get your Bot User OAuth Token from your Slack app settings"
echo "2. Replace 'xoxb-your-bot-token-here' in the .env file with your actual bot token"
echo "3. Add your OpenAI API key if you want sentiment analysis"
echo "4. Start the backend server with: npm run dev"
echo ""
echo "📖 Your Slack app credentials are already configured:"
echo "   - App ID: A09ARAWCV1C"
echo "   - Client ID: 8802479792208.9365370437046"
echo "   - Default channel: aifund-buildathon-081625"
echo ""
echo "🔐 Remember: Never commit your .env file to version control!"
