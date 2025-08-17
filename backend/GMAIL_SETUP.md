# Gmail API Setup Guide

This guide will help you set up Gmail API access for the Inbox Triage feature.

## Prerequisites

- A Google account with Gmail
- Access to Google Cloud Console

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable billing for your project (required for API access)

## Step 2: Enable Gmail API

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Gmail API"
3. Click on "Gmail API" and then click "Enable"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. If prompted, configure the OAuth consent screen:

   - Choose "External" user type
   - Fill in the required information (App name, User support email, Developer contact information)
   - Add scopes: `https://www.googleapis.com/auth/gmail.readonly` and `https://www.googleapis.com/auth/gmail.modify`
   - Add test users (your Gmail address)

4. Create the OAuth 2.0 Client ID:

   - Application type: "Web application"
   - Name: "Inbox Triage App"
   - Authorized redirect URIs:
     - `http://localhost:8080/api/inbox-triage/auth/callback` (for development)
     - `https://b2tutnx6u2.us-east-1.awsapprunner.com/api/inbox-triage/auth/callback` (for production)
   - Click "Create"

5. Download the credentials JSON file

## Step 4: Configure the Application

### Option A: Using Environment Variables (Recommended)

**For Development (localhost):**
Add the following to your `.env` file:

```env
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REDIRECT_URI=http://localhost:8080/api/inbox-triage/auth/callback
```

**For Production (deployed backend):**
Set these environment variables in your deployment platform:

```env
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REDIRECT_URI=https://b2tutnx6u2.us-east-1.awsapprunner.com/api/inbox-triage/auth/callback
```

### Option B: Using Credentials File

1. Place the downloaded credentials JSON file in `backend/data/gmail_credentials.json`
2. The application will automatically load credentials from this file

## Step 5: Test the Setup

1. Start the backend server: `npm run dev`
2. Open the frontend application
3. Navigate to the Inbox Triage section
4. Enter your Gmail address and click "Connect to Gmail"
5. If authentication is required, click the "Authorize Gmail Access" button
6. Complete the OAuth flow in the new window
7. Return to the application and try connecting again

## Troubleshooting

### Common Issues

1. **"Gmail credentials not found"**

   - Ensure you've set up the environment variables or placed the credentials file correctly
   - Check that the credentials file is valid JSON

2. **"Invalid redirect URI"**

   - Make sure the redirect URI in Google Cloud Console matches exactly: `http://localhost:8080/api/inbox-triage/auth/callback`
   - For production, update the redirect URI to your production domain
   - Ensure both development and production URLs are added to Google Cloud Console

3. **"Access blocked"**

   - Ensure your Gmail address is added as a test user in the OAuth consent screen
   - Check that the Gmail API is enabled in your Google Cloud project

4. **"Quota exceeded"**
   - Gmail API has daily quotas. Check your usage in Google Cloud Console
   - Consider implementing rate limiting in your application

### Security Notes

- Never commit credentials to version control
- Use environment variables for production deployments
- Regularly rotate your OAuth client secrets
- Monitor API usage and set up alerts for quota limits

## Production Deployment

For production deployment:

1. Update the redirect URI in Google Cloud Console to your production domain
2. Set up proper environment variables on your production server
3. Consider using a more secure token storage method (database instead of file)
4. Implement proper error handling and logging
5. Set up monitoring for API usage and errors

## API Scopes Used

- `https://www.googleapis.com/auth/gmail.readonly` - Read emails
- `https://www.googleapis.com/auth/gmail.modify` - Archive/move emails

These scopes allow the application to:

- Read your inbox emails
- Move emails to archive/trash
- Cannot send emails or access other Gmail features
