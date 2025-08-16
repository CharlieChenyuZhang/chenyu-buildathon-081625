FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create uploads directory if it doesn't exist
RUN mkdir -p uploads/audio uploads/screenshots

# Expose port
EXPOSE 8080

# Set environment
ENV NODE_ENV=production

# Start the application
CMD ["node", "server.js"]
