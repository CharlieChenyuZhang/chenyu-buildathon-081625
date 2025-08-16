# Visual Memory Upload Functionality

## Overview

The Visual Memory feature now supports enhanced upload functionality with comprehensive validation and folder handling.

## Features

### 1. Image Validation

- **File Type Validation**: Only accepts image files (JPEG, PNG, GIF, BMP, WebP)
- **MIME Type Checking**: Validates both file extension and MIME type
- **Size Limits**: Maximum 10MB per file, up to 100 files per upload

### 2. Folder Upload Support

- **Single-Level Folders**: Supports uploading folders with images
- **Nested Folder Prevention**: Automatically detects and rejects nested folder structures
- **Folder Structure Preservation**: Maintains folder organization in storage

### 3. Enhanced Error Handling

- **Detailed Error Messages**: Provides specific error information for failed uploads
- **Processing Error Tracking**: Separates upload errors from AI processing errors
- **Graceful Degradation**: Continues processing other files if some fail

### 4. Upload Summary

- **Real-time Feedback**: Shows upload progress and results
- **Processing Statistics**: Displays success/failure counts
- **Folder Information**: Lists detected folders and file counts

## File Storage

### Current Implementation

- **Local Storage**: Images are saved to `backend/uploads/screenshots/`
- **Folder Structure**: Preserves original folder organization
- **Unique Naming**: Uses UUID + timestamp to prevent conflicts
- **Metadata Storage**: File information stored in memory (can be replaced with database)

### Future Enhancements

- **AWS S3 Integration**: For scalable cloud storage
- **Database Storage**: For persistent metadata storage
- **Image Optimization**: Automatic resizing and compression
- **CDN Integration**: For faster image delivery

## API Endpoints

### POST `/api/visual-memory/upload-screenshots`

Upload images with validation and processing.

**Request:**

- Content-Type: `multipart/form-data`
- Body: Form data with `screenshots` field containing image files

**Response:**

```json
{
  "message": "Upload completed successfully",
  "summary": {
    "totalFiles": 5,
    "successfullyProcessed": 4,
    "processingErrors": 1,
    "folderStructure": {
      "hasFolders": true,
      "folderCount": 2,
      "fileCount": 5,
      "folders": ["screenshots", "errors"]
    }
  },
  "files": [...],
  "errors": [...]
}
```

### GET `/api/visual-memory/screenshots`

Retrieve all uploaded screenshots.

## Usage Examples

### Upload Individual Images

1. Select multiple image files using the file picker
2. Click "Upload Screenshots"
3. View upload summary and processing results

### Upload Folder

1. Select a folder containing images
2. System validates folder structure and file types
3. Images are processed and organized by folder

### Error Handling

- Invalid file types are rejected with clear error messages
- Nested folders are detected and rejected
- Processing errors are tracked separately from upload errors

## Technical Implementation

### Backend Validation

```javascript
// Image validation
const isValidImage = (file) => {
  const allowedTypes = /jpeg|jpg|png|gif|bmp|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);
  return mimetype && extname;
};

// Folder validation
const validateFolderStructure = (files) => {
  // Check for nested folders
  // Validate all files are images
  // Return folder structure information
};
```

### Frontend Features

- Real-time file validation
- Upload progress indication
- Detailed error display
- Upload summary with statistics
- File type icons and size information

## Security Considerations

1. **File Type Validation**: Strict validation prevents malicious file uploads
2. **Size Limits**: Prevents DoS attacks through large file uploads
3. **Path Traversal Protection**: Multer handles path sanitization
4. **Unique File Names**: Prevents file overwrite attacks

## Performance Optimizations

1. **Streaming Uploads**: Multer handles large files efficiently
2. **Parallel Processing**: Multiple files processed concurrently
3. **Memory Management**: Files streamed to disk, not held in memory
4. **Error Isolation**: Individual file failures don't affect others

## Future Roadmap

1. **AWS S3 Integration**: Move to cloud storage for scalability
2. **Database Integration**: Persistent metadata storage
3. **Image Processing**: Automatic optimization and thumbnail generation
4. **Search Enhancement**: Improved AI-powered image search
5. **Batch Operations**: Bulk delete and organization features
