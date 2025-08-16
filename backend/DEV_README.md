# Backend Development Setup

## Hot Reload Development

This backend is configured with hot reload using `nodemon` for a smooth development experience.

## Quick Start

### Option 1: Simple Development Mode

```bash
npm run dev
```

### Option 2: Enhanced Development Mode (Recommended)

```bash
npm run dev:start
```

### Option 3: Debug Mode

```bash
npm run dev:debug
```

## Available Scripts

| Script                | Description                           |
| --------------------- | ------------------------------------- |
| `npm run dev`         | Basic nodemon with hot reload         |
| `npm run dev:start`   | Enhanced development with auto-setup  |
| `npm run dev:debug`   | Development with Node.js inspector    |
| `npm run dev:verbose` | Development with verbose logging      |
| `npm run dev:legacy`  | Development with legacy file watching |

## Hot Reload Features

### ✅ What Triggers Reload

- Changes to `server.js`
- Changes to any file in `routes/` directory
- Changes to any file in `utils/` directory
- Changes to any file in `scripts/` directory
- Changes to JSON files in `data/` directory

### ❌ What Doesn't Trigger Reload

- Changes to `node_modules/`
- Changes to `uploads/` directory
- Log files and backup files
- Environment files (`.env`)

### 🔧 Configuration

The hot reload is configured in `nodemon.json`:

```json
{
  "watch": ["server.js", "routes/", "utils/", "scripts/", "data/"],
  "ext": "js,json",
  "ignore": ["node_modules/", "uploads/", "*.log", "*.backup.*"],
  "delay": "1000",
  "verbose": true
}
```

## Development Features

### 🚀 Auto-Setup

The enhanced development mode (`npm run dev:start`) automatically:

- Creates `.env` file from `env.example` if missing
- Creates `data/` directory if missing
- Creates `uploads/` directory if missing
- Provides detailed startup feedback

### 📊 Request Logging

In development mode, all API requests are logged with:

- HTTP method and URL
- Response status code
- Request duration
- Color-coded status (green=success, yellow=redirect, red=error)

### 🐛 Enhanced Error Handling

- Detailed error messages in development
- Stack traces when enabled
- Graceful error responses

### 🔍 Debug Mode

Run with `npm run dev:debug` to enable:

- Node.js inspector on port 9229
- Source maps for better debugging
- Chrome DevTools integration

## Development Configuration

Customize development settings in `dev.config.js`:

```javascript
module.exports = {
  server: {
    port: 5001,
    cors: {
      origin: ["http://localhost:3000"],
    },
  },
  hotReload: {
    delay: 1000,
    verbose: true,
  },
  features: {
    detailedLogging: true,
    requestLogging: true,
    stackTraces: true,
  },
};
```

## Troubleshooting

### Hot Reload Not Working

1. **Check file permissions**: Ensure files are writable
2. **Try legacy mode**: `npm run dev:legacy`
3. **Check file paths**: Ensure files are in watched directories
4. **Restart nodemon**: Kill and restart the process

### Port Already in Use

```bash
# Find process using port 5001
lsof -i :5001

# Kill the process
kill -9 <PID>
```

### Permission Issues

```bash
# Make scripts executable
chmod +x dev-start.js
chmod +x scripts/manageStorage.js
```

### Environment Issues

1. Check if `.env` file exists
2. Verify API keys are set
3. Run `npm run dev:start` for auto-setup

## Development Workflow

### 1. Start Development Server

```bash
npm run dev:start
```

### 2. Make Changes

Edit any file in the watched directories:

- `routes/` - API endpoints
- `utils/` - Utility functions
- `server.js` - Main server file

### 3. Automatic Reload

The server will automatically restart when you save changes.

### 4. Monitor Logs

Watch the console for:

- Request logs
- Error messages
- Reload notifications

### 5. Test Changes

Use the API endpoints or frontend to test your changes.

## API Testing

### Health Check

```bash
curl http://localhost:5001/api/health
```

### Storage Info

```bash
curl http://localhost:5001/api/visual-memory/storage-info
```

### Upload Test

```bash
curl -X POST -F "screenshots=@test-image.jpg" \
  http://localhost:5001/api/visual-memory/upload-screenshots
```

## Performance Tips

### Fast Reload

- Keep changes small and focused
- Avoid changing multiple files simultaneously
- Use the 1-second delay to batch changes

### Memory Management

- Monitor memory usage during development
- Restart server periodically for long sessions
- Use `npm run dev:debug` for memory profiling

### File Watching

- Limit watched directories to essential files
- Exclude large directories like `uploads/`
- Use `.gitignore` patterns for ignored files

## Production vs Development

| Feature         | Development   | Production    |
| --------------- | ------------- | ------------- |
| Hot Reload      | ✅ Enabled    | ❌ Disabled   |
| Request Logging | ✅ Verbose    | ❌ Minimal    |
| Error Details   | ✅ Full       | ❌ Limited    |
| CORS            | ✅ Permissive | ⚠️ Restricted |
| Debug Info      | ✅ Enabled    | ❌ Disabled   |

## Next Steps

1. **Start developing**: `npm run dev:start`
2. **Configure environment**: Update `.env` with your API keys
3. **Test endpoints**: Use the provided API examples
4. **Monitor logs**: Watch console output for feedback
5. **Debug issues**: Use debug mode when needed

Happy coding! 🚀
