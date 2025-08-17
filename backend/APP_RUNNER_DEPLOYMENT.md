# App Runner Deployment Guide

## ⚠️ Current Limitations

The current codebase time machine implementation has several limitations that will cause issues in AWS App Runner:

### 1. **In-Memory Storage**

- Analysis results stored in `Map()` objects
- Data lost on container restarts
- No sharing between multiple instances

### 2. **File System Dependencies**

- Creates temporary directories for git cloning
- App Runner has limited write access
- Files lost on container restarts

### 3. **Long-Running Processes**

- Background analysis can take minutes
- App Runner has request timeout limits
- No persistent job management

## 🔧 Production Solutions

### Option 1: Database + S3 Architecture

```javascript
// Replace in-memory storage with DynamoDB
const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Store analysis metadata in DynamoDB
await dynamodb
  .put({
    TableName: "codebase-analyses",
    Item: {
      id: analysisId,
      repoUrl,
      status: "processing",
      createdAt: new Date().toISOString(),
    },
  })
  .promise();

// Store large results in S3
const s3 = new AWS.S3();
await s3
  .putObject({
    Bucket: "codebase-analysis-results",
    Key: `${analysisId}/results.json`,
    Body: JSON.stringify(analysisResults),
  })
  .promise();
```

### Option 2: Step Functions + Lambda

```yaml
# serverless.yml
functions:
  startAnalysis:
    handler: handlers/startAnalysis.handler
    events:
      - http:
          path: /api/codebase-time-machine/analyze-repo
          method: post

  performAnalysis:
    handler: handlers/performAnalysis.handler
    timeout: 900 # 15 minutes
    memorySize: 3008 # Max Lambda memory

  storeResults:
    handler: handlers/storeResults.handler
    events:
      - s3:
          bucket: codebase-analysis-results
          event: s3:ObjectCreated:*
```

### Option 3: ECS with Persistent Storage

```yaml
# docker-compose.yml
version: "3.8"
services:
  codebase-analyzer:
    image: your-app:latest
    environment:
      - DATABASE_URL=postgresql://...
      - S3_BUCKET=codebase-analysis-results
    volumes:
      - analysis-data:/app/data
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G

volumes:
  analysis-data:
    driver: local
```

## 🚀 Immediate App Runner Fixes

### 1. Add Health Checks

```javascript
// Add to your App Runner configuration
{
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/api/codebase-time-machine/health",
    "Interval": 5,
    "Timeout": 2,
    "HealthyThreshold": 2,
    "UnhealthyThreshold": 3
  }
}
```

### 2. Increase Timeout Limits

```javascript
// App Runner configuration
{
  "InstanceConfiguration": {
    "Cpu": "1 vCPU",
    "Memory": "2 GB",
    "InstanceRoleArn": "arn:aws:iam::..."
  },
  "NetworkConfiguration": {
    "EgressConfiguration": {
      "EgressType": "VPC",
      "VpcConnectorArn": "arn:aws:apprunner:..."
    }
  }
}
```

### 3. Environment Variables

```bash
# Required environment variables for App Runner
NODE_ENV=production
OPENAI_API_KEY=your-openai-key
AWS_REGION=us-east-1
ANALYSIS_TIMEOUT=300000  # 5 minutes
MAX_CONCURRENT_ANALYSES=3
```

## 📊 Monitoring & Debugging

### CloudWatch Metrics to Monitor

1. **Container Health**

   - Container restart count
   - Memory utilization
   - CPU utilization

2. **Application Metrics**

   - Analysis success/failure rates
   - Processing time
   - Error rates

3. **Custom Metrics**

   ```javascript
   const AWS = require("aws-sdk");
   const cloudwatch = new AWS.CloudWatch();

   await cloudwatch
     .putMetricData({
       Namespace: "CodebaseTimeMachine",
       MetricData: [
         {
           MetricName: "AnalysisDuration",
           Value: duration,
           Unit: "Milliseconds",
         },
       ],
     })
     .promise();
   ```

## 🔍 Testing App Runner Deployment

### 1. Test Health Endpoint

```bash
curl https://your-app-runner-url/api/codebase-time-machine/health
```

### 2. Test Repository Access

```bash
curl "https://your-app-runner-url/api/codebase-time-machine/test-repo-access?repoUrl=https://github.com/facebook/react"
```

### 3. Monitor Logs

```bash
aws logs tail /aws/apprunner/your-service-name --follow
```

## 🎯 Recommended Production Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Lambda        │
│   (React)       │───▶│   + Route 53    │───▶│   (Start Job)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   S3 Storage    │◀───│   Step Functions │◀───│   ECS/Fargate   │
│   (Results)     │    │   (Orchestration)│    │   (Analysis)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   DynamoDB      │◀───│   Lambda        │◀───│   SQS           │
│   (Metadata)    │    │   (Store Results)│    │   (Job Queue)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## ⚡ Quick Wins for App Runner

1. **Add proper error handling** for container restarts
2. **Implement health checks** for App Runner monitoring
3. **Add timeout handling** for long-running operations
4. **Use environment variables** for configuration
5. **Add comprehensive logging** for debugging

## 🚨 Current Status

**DO NOT DEPLOY TO PRODUCTION** with current implementation. The in-memory storage and file system dependencies will cause data loss and failures in App Runner.

**Recommended next steps:**

1. Implement database storage (DynamoDB)
2. Move file operations to S3
3. Add proper job queue management
4. Test thoroughly in staging environment
