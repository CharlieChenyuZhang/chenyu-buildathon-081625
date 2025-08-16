# Deployment Guide for AWS App Runner

## Quick Fixes Applied

✅ **Server Binding**: Updated to bind on `0.0.0.0` instead of localhost  
✅ **Health Check**: Added `/health` endpoint for App Runner  
✅ **Start Script**: Already correctly configured as `npm start`  
✅ **App Runner Config**: Created `apprunner.yaml`  
✅ **Docker Option**: Created `Dockerfile` for container deployment

## Deployment Options

### Option 1: Source Code Deployment (Recommended)

1. **Push your code** to your Git repository
2. **In AWS App Runner Console**:
   - Choose "Source code repository"
   - Connect your Git provider
   - Select your repository
   - Set **Source directory** to `/backend` (since your server code is in the backend folder)
   - App Runner will automatically use the `apprunner.yaml` file

### Option 2: Container Deployment

1. **Build and push your Docker image** to ECR or Docker Hub
2. **In AWS App Runner Console**:
   - Choose "Container registry"
   - Select your container image
   - Set port to `8080`

## Required Environment Variables

Set these in App Runner → Configuration → Environment variables:

```
OPENAI_API_KEY=your_actual_openai_api_key
NODE_ENV=production
PORT=8080
SLACK_APP_ID=A09ARAWCV1C
SLACK_CLIENT_ID=8802479792208.9365370437046
SLACK_CLIENT_SECRET=2c6a0e04c32a5ea4b7fc41774e8a028a
SLACK_SIGNING_SECRET=1c304d5329d5c3721b79927f2e3279b9
SLACK_VERIFICATION_TOKEN=anYoClk8ZeygaDUGqxtjdiXT
SLACK_BOT_TOKEN=xoxb-your-actual-bot-token
DEFAULT_SLACK_CHANNELS=aifund-buildathon-081625
```

## Testing Locally

Before deploying, test locally:

```bash
cd backend
npm ci
PORT=8080 node server.js
```

Then test the health check:

```bash
curl -i http://localhost:8080/health
```

Should return:

```json
{ "status": "OK", "message": "Buildathon API is running" }
```

## Troubleshooting

### If deployment fails:

1. **Check App Runner logs** in the AWS Console
2. **Verify environment variables** are set correctly
3. **Ensure your Slack bot token** is valid and has proper permissions
4. **Check that all required files** are in the `/backend` directory

### Common Issues:

- **Missing environment variables**: App will crash on startup
- **Invalid Slack tokens**: API calls will fail
- **Port binding issues**: Should be resolved with the `0.0.0.0` binding
- **Health check failures**: Verify `/health` endpoint returns 200

## Health Check Configuration

The `apprunner.yaml` includes:

- **Path**: `/health`
- **Interval**: 10 seconds
- **Timeout**: 5 seconds
- **Healthy threshold**: 1 success
- **Unhealthy threshold**: 3 failures

This ensures App Runner can properly monitor your application health.
