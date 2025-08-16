# Backend Setup Guide

## Environment Variables Setup

### 1. Create Environment File

Copy the example environment file and rename it to `.env`:

```bash
cp env.example .env
```

### 2. Configure OpenAI API Key

1. Get your OpenAI API key from [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Open the `.env` file and replace `your_openai_api_key_here` with your actual API key:

```env
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Server

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

## Environment Variables Reference

| Variable         | Description         | Required | Default     |
| ---------------- | ------------------- | -------- | ----------- |
| `OPENAI_API_KEY` | Your OpenAI API key | Yes      | -           |
| `PORT`           | Server port         | No       | 8080        |
| `NODE_ENV`       | Environment mode    | No       | development |

## Troubleshooting

### OpenAI API Key Error

If you see this error:

```
OpenAIError: The OPENAI_API_KEY environment variable is missing or empty
```

1. Make sure you have created a `.env` file in the backend directory
2. Verify your API key is correctly set in the `.env` file
3. Restart the server after making changes

### Getting an OpenAI API Key

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key and paste it in your `.env` file

**Note:** Keep your API key secure and never commit it to version control!
