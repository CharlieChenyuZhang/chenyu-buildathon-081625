module.exports = {
  // Development server configuration
  server: {
    port: process.env.PORT || 8080,
    host: "localhost",
    cors: {
      origin: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001", // Add any additional ports you need
        "https://main.dolpvcksb3r4b.amplifyapp.com",
      ],
      credentials: true,
    },
  },

  // Hot reload configuration
  hotReload: {
    // Files to watch for changes
    watch: [
      "server.js",
      "routes/**/*.js",
      "utils/**/*.js",
      "scripts/**/*.js",
      "data/**/*.json",
    ],

    // Files to ignore
    ignore: [
      "node_modules/**/*",
      "uploads/**/*",
      "*.log",
      "*.backup.*",
      "data/visual_entities.json.backup.*",
    ],

    // File extensions to watch
    extensions: ["js", "json"],

    // Delay before restart (ms)
    delay: 1000,

    // Verbose logging
    verbose: true,

    // Legacy file watching (for some systems)
    legacyWatch: false,
  },

  // Development features
  features: {
    // Enable detailed logging
    detailedLogging: true,

    // Enable request logging
    requestLogging: true,

    // Enable error stack traces
    stackTraces: true,

    // Enable file upload debugging
    uploadDebug: true,

    // Enable storage debugging
    storageDebug: true,
  },

  // Development tools
  tools: {
    // Auto-create missing directories
    autoCreateDirs: true,

    // Auto-copy env.example to .env
    autoSetupEnv: true,

    // Show startup information
    showStartupInfo: true,

    // Enable graceful shutdown
    gracefulShutdown: true,
  },

  // Debug configuration
  debug: {
    // Enable Node.js inspector
    inspector: false,

    // Inspector port
    inspectorPort: 9229,

    // Enable source maps
    sourceMaps: true,
  },
};
