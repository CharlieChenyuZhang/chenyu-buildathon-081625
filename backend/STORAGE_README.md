# Visual Memory JSON Storage System

## Overview

The visual memory system now uses a local JSON file for persistent storage of visual entities. This provides a simple, file-based solution that persists data between server restarts.

## Storage Location

- **File**: `backend/data/visual_entities.json`
- **Structure**: JSON object with entities array and metadata

## File Structure

```json
{
  "entities": [
    {
      "id": "unique-uuid",
      "filename": "stored-filename.jpg",
      "originalName": "original-filename.jpg",
      "path": "/path/to/file.jpg",
      "size": 12345,
      "uploadedAt": "2024-01-15T10:30:00Z",
      "processed": true,
      "folder": "login_flows",
      "analysis": {
        "textContent": "Extracted text from image",
        "visualDescription": "Detailed visual description",
        "entityAnalysis": {
          "entities": [...],
          "summary": {...}
        }
      },
      "metadata": {
        "extractedText": "text content",
        "visualElements": ["button", "form"],
        "dominantColors": ["blue", "white"],
        "primaryObjects": ["button", "text"],
        "totalEntities": 5,
        "entityTypes": ["button", "form", "text"]
      },
      "tags": ["login", "form", "button", "blue"]
    }
  ],
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

## API Endpoints

### Storage Management

- `GET /api/visual-memory/storage-info` - Get storage statistics
- `POST /api/visual-memory/clear-storage` - Clear all entities

### Entity Management

- `GET /api/visual-memory/screenshots` - List all entities
- `GET /api/visual-memory/screenshot/:id` - Get specific entity
- `GET /api/visual-memory/screenshot/:id/analysis` - Get entity analysis
- `DELETE /api/visual-memory/screenshot/:id` - Delete entity

### Search

- `POST /api/visual-memory/search` - Search entities with natural language

## CLI Management Tool

Use the included CLI tool to manage storage:

```bash
# Show storage statistics
node backend/scripts/manageStorage.js stats

# List all entities
node backend/scripts/manageStorage.js list

# Search entities
node backend/scripts/manageStorage.js search "login button"

# Get specific entity
node backend/scripts/manageStorage.js get <entity-id>

# Delete entity
node backend/scripts/manageStorage.js delete <entity-id>

# Clear all entities
node backend/scripts/manageStorage.js clear

# Create backup
node backend/scripts/manageStorage.js backup ./backup.json

# Restore from backup
node backend/scripts/manageStorage.js restore ./backup.json
```

## Storage Manager Class

The `StorageManager` class provides programmatic access:

```javascript
const StorageManager = require("./utils/storageManager");

const storage = new StorageManager();

// Add entity
storage.addEntity(entityData);

// Search entities
const results = storage.searchEntities("login button");

// Get statistics
const stats = storage.getStats();

// Create backup
const backupFile = storage.backupStorage("./backup.json");
```

## Search Capabilities

The system supports searching across:

1. **Text Content** - Extracted text from images
2. **Visual Description** - AI-generated descriptions
3. **Tags** - Automatically generated tags
4. **Entity Labels** - Detected UI elements and objects
5. **Metadata** - Colors, UI components, object types

Search results include confidence scores and match categories.

## Advantages

- ✅ **Simple setup** - No database required
- ✅ **Persistent storage** - Data survives server restarts
- ✅ **Easy backup** - Just copy the JSON file
- ✅ **Human readable** - Easy to inspect and debug
- ✅ **Version control friendly** - Can be tracked in git

## Limitations

- ❌ **No concurrent access** - Single file can cause conflicts
- ❌ **Limited scalability** - Not suitable for large datasets
- ❌ **No advanced queries** - Basic search only
- ❌ **No indexing** - Linear search performance

## Migration Path

When you're ready to scale, you can easily migrate to:

1. **PostgreSQL** - For complex queries and full-text search
2. **MongoDB** - For document-based storage
3. **Firebase** - For real-time updates
4. **DynamoDB** - For massive scalability

The JSON structure is designed to be easily migratable to any of these systems.

## Backup Strategy

- **Automatic backups** - Use the CLI tool to create regular backups
- **Version control** - Consider tracking the JSON file in git
- **External storage** - Copy backups to cloud storage

## Performance Tips

- **Regular cleanup** - Remove old/unused entities
- **Compression** - Consider gzipping the JSON file for large datasets
- **Splitting** - For very large datasets, consider splitting into multiple files

## Troubleshooting

### File Corruption

If the JSON file becomes corrupted:

1. Restore from backup
2. If no backup, the system will recreate an empty file

### Permission Issues

Ensure the `backend/data/` directory is writable:

```bash
chmod 755 backend/data/
chmod 644 backend/data/visual_entities.json
```

### Large File Size

If the JSON file becomes too large:

1. Create a backup
2. Clear old entities
3. Consider migrating to a database
