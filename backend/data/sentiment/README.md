# Sentiment Analysis Data

This directory contains JSON files with sentiment analysis results for each Slack workspace.

## File Naming Convention

Files are named in the format: `sentiment_{workspaceId}_{timestamp}.json`

Example: `sentiment_abc123_1703123456789.json`

## Data Structure

Each JSON file contains the following structure:

```json
{
  "workspaceId": "string",
  "timestamp": "ISO-8601 timestamp",
  "totalMessages": "number",
  "sentimentDistribution": {
    "positive": "number",
    "neutral": "number",
    "negative": "number"
  },
  "averageSentiment": "number (0.0-1.0)",
  "messages": [
    {
      "id": "string",
      "userId": "string",
      "text": "string",
      "timestamp": "ISO-8601 timestamp",
      "channel": "string",
      "sentiment": "positive|neutral|negative",
      "sentimentConfidence": "number (0.0-1.0)",
      "emotions": ["array of emotions"],
      "intensity": "low|medium|high",
      "context": "string"
    }
  ],
  "summary": {
    "totalMessages": "number",
    "uniqueUsers": "number",
    "uniqueChannels": "number",
    "dateRange": {
      "start": "ISO-8601 timestamp",
      "end": "ISO-8601 timestamp"
    }
  }
}
```

## Usage

- Files are automatically created when sentiment analysis is performed
- The most recent file for each workspace is used for analysis
- Files are used to populate charts and generate insights
- Historical data can be analyzed for trend analysis

## API Endpoints

- `GET /api/employee-engagement/sentiment-data/:workspaceId` - Retrieve saved sentiment data
- Data is automatically saved after message fetching and sentiment analysis
