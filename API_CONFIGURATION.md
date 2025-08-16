# API Configuration Guide

This document explains how the React UI is configured to work with both local development and deployed backend environments.

## Overview

The application now supports automatic switching between:
- **Development**: `http://localhost:8080` (local backend)
- **Production**: `https://b2tutnx6u2.us-east-1.awsapprunner.com` (deployed backend)

## Configuration Files

### 1. `src/config/api.js`
Main API configuration that creates an axios instance with the correct base URL based on the environment.

### 2. `src/config/environment.js`
Environment-specific configuration and utilities.

### 3. `src/components/EnvironmentIndicator.js`
Visual indicator showing the current environment (only visible in development).

## How It Works

### Environment Detection
The system automatically detects the environment based on `process.env.NODE_ENV`:
- `development` → Uses local backend (`http://localhost:8080`)
- `production` → Uses deployed backend (`https://b2tutnx6u2.us-east-1.awsapprunner.com`)
- `test` → Uses empty base URL (for testing)

### API Usage
All components now use the configured API instance:

```javascript
// Before (old way)
import axios from 'axios';
const response = await axios.get('/api/endpoint');

// After (new way)
import { api } from '../config/api';
const response = await api.get('/api/endpoint');
```

## Development Workflow

### Local Development
1. Start your local backend: `cd backend && npm run dev`
2. Start the React app: `npm start`
3. The app will automatically connect to `http://localhost:8080`
4. You'll see an environment indicator in the top-right corner

### Production Deployment
1. Build the app: `npm run build`
2. Deploy the build folder
3. The app will automatically connect to the deployed backend

## Environment Variables

The system uses these environment variables:
- `NODE_ENV`: Determines the environment (`development`, `production`, `test`)

## Troubleshooting

### API Connection Issues
1. Check the environment indicator (development only)
2. Verify the backend URL in the browser's network tab
3. Ensure CORS is properly configured on the backend

### Switching Environments
To test production API locally:
```bash
NODE_ENV=production npm start
```

To test development API in production build:
```bash
NODE_ENV=development npm run build
```

## Backend Configuration

Make sure your backend CORS settings allow requests from both:
- `http://localhost:3000` (development)
- Your production frontend domain

## Updated Components

The following components have been updated to use the new API configuration:
- ✅ KnowledgeGraph
- ✅ VoiceToSlide
- ✅ CodebaseTimeMachine
- ✅ EmployeeEngagement
- ✅ VisualMemory

## Benefits

1. **Automatic Environment Switching**: No manual configuration needed
2. **Consistent API Calls**: All components use the same configured instance
3. **Development Debugging**: Visual indicator and console logging
4. **Production Ready**: Seamless deployment without code changes
5. **Error Handling**: Centralized error handling and logging
