import React, { useState } from "react";
import axios from "axios";
import "./VisualMemory.css";

function VisualMemory() {
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [uploadedScreenshots, setUploadedScreenshots] = useState([]);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [searchFilters, setSearchFilters] = useState({
    minConfidence: 0.1,
    folder: "",
    limit: 5, // Changed from 20 to 5 to return top 5 matches
  });
  const [searchStats, setSearchStats] = useState(null);
  const [sortBy, setSortBy] = useState("confidence"); // confidence, date, name
  const [activeTab, setActiveTab] = useState("upload"); // upload, search, allImages

  const triggerFileInput = () => {
    const fileInput = document.getElementById("file-upload");
    if (fileInput) {
      // Ensure the input is properly configured for directory selection
      fileInput.setAttribute("webkitdirectory", "");
      fileInput.setAttribute("directory", "");
      fileInput.setAttribute("multiple", "true");
      fileInput.click();
    }
  };

  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files);

    console.log("Selected files:", selectedFiles);
    console.log("File input attributes:", {
      webkitdirectory: event.target.webkitdirectory,
      directory: event.target.directory,
      multiple: event.target.multiple,
    });

    if (selectedFiles.length === 0) {
      return;
    }

    // Check if this is a folder upload (files will have path separators)
    const isFolderUpload = selectedFiles.some(
      (file) =>
        (file.webkitRelativePath && file.webkitRelativePath.includes("/")) ||
        (file._customPath && file._customPath.includes("/"))
    );

    console.log("Is folder upload:", isFolderUpload);
    console.log(
      "Sample file paths:",
      selectedFiles
        .slice(0, 3)
        .map((f) => f.webkitRelativePath || f._customPath || f.name)
    );

    if (!isFolderUpload) {
      alert(
        "Please select a folder, not individual files. Use the folder picker to select an entire folder.\n\n" +
          "If you're having trouble selecting a folder:\n" +
          "1. Click the folder picker button\n" +
          "2. Navigate to your desired folder\n" +
          "3. Click 'Open' on the folder (not inside it)\n" +
          "4. The folder should be selected for upload"
      );
      // Reset the file input
      event.target.value = "";
      return;
    }

    // Show success message for folder selection
    const firstFile = selectedFiles[0];
    const folderName = (
      firstFile.webkitRelativePath ||
      firstFile._customPath ||
      ""
    ).split("/")[0];
    console.log("Selected folder:", folderName);
    console.log("Number of files in folder:", selectedFiles.length);

    // Show a brief success message
    const successMessage = `✅ Folder "${folderName}" selected with ${selectedFiles.length} files`;
    console.log(successMessage);

    // Validate files before setting state
    const validFiles = [];
    const invalidFiles = [];

    selectedFiles.forEach((file) => {
      const allowedTypes = /jpeg|jpg|png|gif|bmp|webp/;
      const isValidImage =
        allowedTypes.test(file.type) ||
        allowedTypes.test(file.name.toLowerCase());

      if (isValidImage) {
        validFiles.push(file);
      } else {
        invalidFiles.push(
          file.webkitRelativePath || file._customPath || file.name
        );
      }
    });

    if (invalidFiles.length > 0) {
      alert(
        `Invalid file types detected in folder:\n${invalidFiles.join(
          "\n"
        )}\n\nOnly image files (JPEG, PNG, GIF, BMP, WebP) are allowed.`
      );
    }

    if (validFiles.length === 0) {
      alert("No valid image files found in the selected folder.");
      event.target.value = "";
      return;
    }

    setFiles(validFiles);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert("Please select files to upload");
      return;
    }

    setIsUploading(true);
    setUploadSummary(null);
    setUploadErrors([]);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("screenshots", file);
    });

    try {
      const response = await axios.post(
        "/api/visual-memory/upload-screenshots",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setUploadedScreenshots((prev) => [...prev, ...response.data.files]);
      setUploadSummary(response.data.summary);
      setUploadErrors(response.data.errors || []);
      setFiles([]);

      // Show success message with details
      const summary = response.data.summary;
      const message =
        `Upload completed successfully!\n\n` +
        `📁 Total files: ${summary.totalFiles}\n` +
        `✅ Successfully processed: ${summary.successfullyProcessed}\n` +
        `❌ Processing errors: ${summary.processingErrors}\n` +
        (summary.folderStructure.hasFolders
          ? `📂 Folders detected: ${summary.folderStructure.folders.join(", ")}`
          : "📁 No folders detected");

      alert(message);
    } catch (error) {
      console.error("Upload error:", error);
      const errorMessage =
        error.response?.data?.details ||
        error.response?.data?.error ||
        "Failed to upload files";
      alert(`Upload failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      alert("Please enter a search query");
      return;
    }

    setIsSearching(true);
    try {
      const response = await axios.post("/api/visual-memory/search", {
        query: searchQuery,
        filters: searchFilters,
      });

      setSearchResults(response.data.results);
      setSearchStats(response.data.searchStats);
    } catch (error) {
      console.error("Search error:", error);
      alert("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleFilterChange = (filterName, value) => {
    setSearchFilters((prev) => ({
      ...prev,
      [filterName]: value,
    }));
  };

  const sortResults = (results) => {
    switch (sortBy) {
      case "date":
        return [...results].sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );
      case "name":
        return [...results].sort((a, b) =>
          (a.originalName || a.filename).localeCompare(
            b.originalName || b.filename
          )
        );
      case "confidence":
      default:
        return [...results].sort((a, b) => b.confidence - a.confidence);
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return "#34c759";
    if (confidence >= 0.6) return "#ff9500";
    if (confidence >= 0.4) return "#ff3b30";
    return "#8e8e93";
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const loadScreenshots = async () => {
    try {
      const response = await axios.get("/api/visual-memory/screenshots");
      setUploadedScreenshots(response.data.screenshots);
    } catch (error) {
      console.error("Error loading screenshots:", error);
    }
  };

  React.useEffect(() => {
    loadScreenshots();
  }, []);

  const getFileTypeIcon = (filename) => {
    const ext = filename.split(".").pop().toLowerCase();
    switch (ext) {
      case "png":
        return "🖼️";
      case "jpg":
      case "jpeg":
        return "📷";
      case "gif":
        return "🎬";
      case "bmp":
        return "🖼️";
      case "webp":
        return "🌐";
      default:
        return "📄";
    }
  };

  return (
    <div className="visual-memory project-component">
      <h1>Visual Memory Search</h1>
      <p>
        Search your screenshot history using natural language queries for both
        text content AND visual elements. Upload entire folders of images to
        build your searchable database.
      </p>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === "upload" ? "active" : ""}`}
          onClick={() => setActiveTab("upload")}
        >
          📤 Upload
        </button>
        <button
          className={`tab-button ${activeTab === "search" ? "active" : ""}`}
          onClick={() => setActiveTab("search")}
        >
          🔍 Search
        </button>
        <button
          className={`tab-button ${activeTab === "allImages" ? "active" : ""}`}
          onClick={() => setActiveTab("allImages")}
        >
          🖼️ All Images ({uploadedScreenshots.length})
        </button>
      </div>

      {activeTab === "upload" && (
        <div className="section upload-section">
          <h2>Upload Screenshots</h2>

          <div className="upload-area">
            <input
              type="file"
              multiple={true}
              accept="image/*"
              onChange={handleFileSelect}
              className="file-input"
              id="file-upload"
              webkitdirectory=""
              directory=""
              style={{ display: "none" }}
            />
            <div className="upload-area-click" onClick={triggerFileInput}>
              <div className="upload-content">
                <div className="upload-icon">📁</div>
                <p className="upload-text">
                  Click to select a folder of images
                </p>
                <p className="upload-hint">
                  Supported formats: JPEG, PNG, GIF, BMP, WebP
                </p>
              </div>
            </div>
            {files.length > 0 && (
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className={`upload-btn ${isUploading ? "loading" : ""}`}
              >
                {isUploading
                  ? "Uploading..."
                  : `Upload ${files.length} File${files.length > 1 ? "s" : ""}`}
              </button>
            )}
          </div>

          {files.length > 0 && (
            <div className="selected-files">
              <h3>Selected Files ({files.length})</h3>
              <div className="file-list">
                {files.map((file, index) => (
                  <div key={index} className="file-item">
                    <span className="file-icon">
                      {getFileTypeIcon(file.name)}
                    </span>
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadSummary && (
            <div className="upload-summary">
              <h3>Upload Summary</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">Total Files:</span>
                  <span className="summary-value">
                    {uploadSummary.totalFiles}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Successfully Processed:</span>
                  <span className="summary-value success">
                    {uploadSummary.successfullyProcessed}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Processing Errors:</span>
                  <span className="summary-value error">
                    {uploadSummary.processingErrors}
                  </span>
                </div>
                {uploadSummary.folderStructure.hasFolders && (
                  <div className="summary-item">
                    <span className="summary-label">Folders:</span>
                    <span className="summary-value">
                      {uploadSummary.folderStructure.folders.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {uploadErrors.length > 0 && (
            <div className="upload-errors">
              <h3>Processing Errors ({uploadErrors.length})</h3>
              <div className="error-list">
                {uploadErrors.map((error, index) => (
                  <div key={index} className="error-item">
                    <span className="error-file">{error.filename}</span>
                    <span className="error-message">{error.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "search" && (
        <div className="section search-section">
          <h2>Search Screenshots</h2>

          <div className="search-area">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g., 'error message about auth' OR 'screenshot with blue button' OR 'neon sign'"
              className="search-input"
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className={`search-btn ${isSearching ? "loading" : ""}`}
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>

          {/* Search Stats */}
          {searchStats && (
            <div className="search-stats">
              <div className="stat-item">
                <span className="stat-label">Total Entities:</span>
                <span className="stat-value">{searchStats.totalEntities}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Processed:</span>
                <span className="stat-value">
                  {searchStats.processedEntities}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Query Words:</span>
                <span className="stat-value">
                  {searchStats.queryWords.join(", ")}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Avg Confidence:</span>
                <span className="stat-value">
                  {(searchStats.averageConfidence * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {searchResults.length > 0 && activeTab === "search" && (
        <div className="section results-section">
          <div className="results-header">
            <h2>Top {searchResults.length} Matches (Sorted by Confidence)</h2>
            <div className="sort-controls">
              <label>Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="confidence">Confidence (Default)</option>
                <option value="date">Date</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          <div className="results-grid">
            {sortResults(searchResults).map((result, index) => (
              <div key={result.id} className="result-card">
                <div className="result-header">
                  <div className="result-title">
                    <h3>{result.originalName || result.filename}</h3>
                    <span className="file-info">
                      {formatFileSize(result.fileSize)} •{" "}
                      {new Date(result.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <span
                    className="confidence"
                    style={{
                      backgroundColor:
                        getConfidenceColor(result.confidence) + "20",
                      color: getConfidenceColor(result.confidence),
                    }}
                  >
                    {(result.confidence * 100).toFixed(1)}% match
                  </span>
                </div>

                {/* Thumbnail */}
                <div className="result-thumbnail">
                  <img
                    src={`/api/visual-memory/thumbnail/${result.id}`}
                    alt={result.originalName || result.filename}
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "block";
                    }}
                  />
                  <div
                    className="thumbnail-placeholder"
                    style={{ display: "none" }}
                  >
                    <span>🖼️</span>
                    <p>Image not available</p>
                  </div>
                </div>

                <div className="result-content">
                  {/* Match Details */}
                  <div className="match-details">
                    {result.textMatches.length > 0 && (
                      <div className="match-section text-matches">
                        <strong>📝 Text Matches:</strong>
                        <ul>
                          {result.textMatches.map((match, i) => (
                            <li key={i}>{match}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.visualMatches.length > 0 && (
                      <div className="match-section visual-matches">
                        <strong>🎨 Visual Matches:</strong>
                        <ul>
                          {result.visualMatches.map((match, i) => (
                            <li key={i}>{match}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.entityMatches.length > 0 && (
                      <div className="match-section entity-matches">
                        <strong>🔍 Entity Matches:</strong>
                        <ul>
                          {result.entityMatches.map((match, i) => (
                            <li key={i}>{match}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.tagMatches.length > 0 && (
                      <div className="match-section tag-matches">
                        <strong>🏷️ Tag Matches:</strong>
                        <ul>
                          {result.tagMatches.map((match, i) => (
                            <li key={i}>{match}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="result-metadata">
                    <div className="metadata-row">
                      <span className="metadata-label">📊 Entities:</span>
                      <span className="metadata-value">
                        {result.entityCount}
                      </span>
                    </div>
                    {result.folder && (
                      <div className="metadata-row">
                        <span className="metadata-label">📁 Folder:</span>
                        <span className="metadata-value">{result.folder}</span>
                      </div>
                    )}
                    {result.dominantColors.length > 0 && (
                      <div className="metadata-row">
                        <span className="metadata-label">🎨 Colors:</span>
                        <span className="metadata-value">
                          {result.dominantColors.slice(0, 3).join(", ")}
                        </span>
                      </div>
                    )}
                    {result.primaryObjects.length > 0 && (
                      <div className="metadata-row">
                        <span className="metadata-label">🔍 Objects:</span>
                        <span className="metadata-value">
                          {result.primaryObjects.slice(0, 3).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {result.tags && result.tags.length > 0 && (
                    <div className="result-tags">
                      <strong>🏷️ Tags:</strong>
                      <div className="tags-list">
                        {result.tags.slice(0, 8).map((tag, i) => (
                          <span key={i} className="tag">
                            {tag}
                          </span>
                        ))}
                        {result.tags.length > 8 && (
                          <span className="tag">
                            +{result.tags.length - 8} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="result-footer">
                  <details>
                    <summary>📄 Full Content</summary>
                    <div className="full-content">
                      {result.textContent &&
                        result.textContent !== "No text found." && (
                          <div className="content-section">
                            <strong>Text Content:</strong>
                            <p>{result.textContent}</p>
                          </div>
                        )}
                      {result.visualDescription && (
                        <div className="content-section">
                          <strong>Visual Description:</strong>
                          <p>{result.visualDescription}</p>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "allImages" && (
        <div className="section all-images-section">
          <h2>All Uploaded Images ({uploadedScreenshots.length})</h2>

          {uploadedScreenshots.length === 0 ? (
            <div className="no-images-message">
              <div className="no-images-icon">🖼️</div>
              <h3>No images uploaded yet</h3>
              <p>
                Upload some images using the upload section above to see them
                here.
              </p>
            </div>
          ) : (
            <div className="all-images-grid">
              {uploadedScreenshots.map((screenshot, index) => (
                <div key={screenshot.id || index} className="image-card">
                  <div className="image-thumbnail">
                    <img
                      src={`/api/visual-memory/thumbnail/${screenshot.id}`}
                      alt={screenshot.originalName || screenshot.filename}
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.nextSibling.style.display = "block";
                      }}
                    />
                    <div
                      className="thumbnail-placeholder"
                      style={{ display: "none" }}
                    >
                      <span>🖼️</span>
                    </div>
                  </div>

                  <div className="image-info">
                    <h4>{screenshot.originalName || screenshot.filename}</h4>
                    <p className="upload-date">
                      Uploaded:{" "}
                      {new Date(screenshot.uploadedAt).toLocaleDateString()}
                    </p>
                    <p className="file-size">
                      Size: {formatFileSize(screenshot.size)}
                    </p>
                    {screenshot.folder && (
                      <p className="folder-info">📁 {screenshot.folder}</p>
                    )}

                    <div className="image-status">
                      {screenshot.processed ? (
                        <span className="status processed">✅ Processed</span>
                      ) : (
                        <span className="status error">
                          ❌ Processing Failed
                        </span>
                      )}
                    </div>

                    {screenshot.processed && screenshot.metadata && (
                      <div className="image-metadata">
                        <div className="metadata-item">
                          <span className="metadata-label">Entities:</span>
                          <span className="metadata-value">
                            {screenshot.metadata.totalEntities}
                          </span>
                        </div>
                        {screenshot.metadata.dominantColors.length > 0 && (
                          <div className="metadata-item">
                            <span className="metadata-label">Colors:</span>
                            <span className="metadata-value">
                              {screenshot.metadata.dominantColors
                                .slice(0, 2)
                                .join(", ")}
                            </span>
                          </div>
                        )}
                        {screenshot.metadata.primaryObjects.length > 0 && (
                          <div className="metadata-item">
                            <span className="metadata-label">Objects:</span>
                            <span className="metadata-value">
                              {screenshot.metadata.primaryObjects
                                .slice(0, 2)
                                .join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {screenshot.tags && screenshot.tags.length > 0 && (
                      <div className="image-tags">
                        {screenshot.tags.slice(0, 4).map((tag, idx) => (
                          <span key={idx} className="tag">
                            {tag}
                          </span>
                        ))}
                        {screenshot.tags.length > 4 && (
                          <span className="tag">
                            +{screenshot.tags.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Removed the uploaded screenshots section since we now have the All Images tab */}
    </div>
  );
}

export default VisualMemory;
