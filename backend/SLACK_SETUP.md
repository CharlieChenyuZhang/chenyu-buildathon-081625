# Slack Employee Engagement Setup Guide

## 🚀 Quick Start

1. **Your .env file has been created** with your Slack app credentials
2. **Get your Bot User OAuth Token** (see instructions below)
3. **Update the .env file** with your bot token
4. **Start the server** with `npm run dev`

## 🔑 Getting Your Bot User OAuth Token

### Step 1: Go to Your Slack App Settings

1. Visit [api.slack.com/apps](https://api.slack.com/apps)
2. Click on your app: **A09ARAWCV1C**

### Step 2: Install the App to Your Workspace

1. In the left sidebar, click **"OAuth & Permissions"**
2. Click **"Install to Workspace"** button
3. Authorize the app with the required permissions

### Step 3: Copy the Bot User OAuth Token

1. After installation, you'll see **"Bot User OAuth Token"**
2. It starts with `xoxb-`
3. Copy this token

### Step 4: Update Your .env File

1. Open `backend/.env`
2. Replace `xoxb-your-bot-token-here` with your actual bot token
3. Save the file

## 📋 Required Slack App Permissions

Your Slack app needs these scopes:

- `channels:history` - Read message history
- `channels:read` - View basic channel info
- `channels:join` - Join public channels
- `groups:history` - Read private channel history
- `groups:read` - View private channels
- `groups:join` - Join private channels (if needed)
- `users:read` - View users in workspace
- `team:read` - View workspace info

## 🔧 How to Add Permissions

1. Go to your Slack app settings
2. Click **"OAuth & Permissions"** in the left sidebar
3. Scroll to **"Scopes"** section
4. Add the required scopes under **"Bot Token Scopes"**
5. Click **"Install to Workspace"** again

## 🎯 Your Configuration

Your app is already configured with:

- **App ID**: A09ARAWCV1C
- **Client ID**: 8802479792208.9365370437046
- **Default Channel**: aifund-buildathon-081625

## 🚀 Running the Application

1. **Start the backend:**

   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend:**

   ```bash
   # In a new terminal
   cd ../
   npm start
   ```

3. **Connect to Slack:**
   - Go to http://localhost:3000
   - Navigate to Employee Engagement
   - Enter your workspace name
   - Click "Connect Workspace"
   - Click "Fetch Messages" to pull messages from #aifund-buildathon-081625

## 🔍 Troubleshooting

### "Invalid Slack bot token" error

- Make sure you copied the **Bot User OAuth Token** (starts with `xoxb-`)
- Not the Client Secret or Signing Secret
- Ensure the app is installed to your workspace

### "Channel not found" error

- Make sure the channel `aifund-buildathon-081625` exists in your workspace
- The bot needs to be added to the channel
- Check that the channel name is exactly correct (no extra spaces)

### "Permission denied" error

- Make sure you added all required scopes
- Reinstall the app to your workspace after adding scopes

## 📊 What the App Does

1. **Connects to your Slack workspace** using your bot token
2. **Fetches messages** from the specified channels
3. **Analyzes sentiment** of messages using OpenAI (if API key provided)
4. **Generates insights** for managers about team engagement
5. **Tracks trends** over time
6. **Provides alerts** for potential burnout or engagement issues

## 🔐 Security Notes

- ✅ Your bot token is stored securely in the `.env` file
- ✅ The frontend never sees your bot token
- ✅ All Slack API calls happen on the backend
- ⚠️ Never commit your `.env` file to version control
- ⚠️ Keep your bot token private and secure

## 📞 Support

If you encounter issues:

1. Check the browser console for errors
2. Check the backend terminal for error messages
3. Verify your Slack app permissions
4. Ensure your bot token is correct
