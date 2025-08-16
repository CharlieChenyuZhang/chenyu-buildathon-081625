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
        filters: {},
      });

      setSearchResults(response.data.results);
    } catch (error) {
      console.error("Search error:", error);
      alert("Search failed");
    } finally {
      setIsSearching(false);
    }
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
              <p className="upload-text">Click to select a folder of images</p>
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

      <div className="section search-section">
        <h2>Search Screenshots</h2>
        <div className="search-area">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="e.g., 'error message about auth' OR 'screenshot with blue button'"
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
      </div>

      {searchResults.length > 0 && (
        <div className="section results-section">
          <h2>Search Results ({searchResults.length})</h2>
          <div className="results-grid">
            {searchResults.map((result, index) => (
              <div key={index} className="result-card">
                <div className="result-header">
                  <h3>{result.filename || result.originalName}</h3>
                  <span className="confidence">
                    {(result.confidence * 100).toFixed(1)}% match
                  </span>
                </div>

                <div className="result-content">
                  {result.textMatches.length > 0 && (
                    <div className="text-matches">
                      <strong>📝 Text Matches:</strong>
                      <ul>
                        {result.textMatches.map((match, i) => (
                          <li key={i}>{match}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.visualMatches.length > 0 && (
                    <div className="visual-matches">
                      <strong>🎨 Visual Matches:</strong>
                      <ul>
                        {result.visualMatches.map((match, i) => (
                          <li key={i}>{match}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.entityMatches.length > 0 && (
                    <div className="entity-matches">
                      <strong>🔍 Entity Matches:</strong>
                      <ul>
                        {result.entityMatches.map((match, i) => (
                          <li key={i}>{match}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.tags && result.tags.length > 0 && (
                    <div className="result-tags">
                      <strong>🏷️ Tags:</strong>
                      <div className="tags-list">
                        {result.tags.slice(0, 6).map((tag, i) => (
                          <span key={i} className="tag">
                            {tag}
                          </span>
                        ))}
                        {result.tags.length > 6 && (
                          <span className="tag">
                            +{result.tags.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="result-metadata">
                    <small>
                      📊 {result.entityCount} entities • 📁{" "}
                      {result.folder || "No folder"} • 📅{" "}
                      {new Date(result.timestamp).toLocaleDateString()}
                    </small>
                  </div>
                </div>

                <div className="result-footer">
                  <details>
                    <summary>📄 Full Content</summary>
                    <div className="full-content">
                      {result.textContent && (
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

      {uploadedScreenshots.length > 0 && (
        <div className="section screenshots-section">
          <h2>Uploaded Screenshots ({uploadedScreenshots.length})</h2>
          <div className="screenshots-grid">
            {uploadedScreenshots.map((screenshot, index) => (
              <div key={index} className="screenshot-card">
                <div className="screenshot-header">
                  <span className="file-icon">
                    {getFileTypeIcon(
                      screenshot.filename || screenshot.originalName
                    )}
                  </span>
                  <h4>{screenshot.filename || screenshot.originalName}</h4>
                </div>
                <p>
                  Uploaded:{" "}
                  {new Date(screenshot.uploadedAt).toLocaleDateString()}
                </p>
                {screenshot.folder && (
                  <p className="folder-info">📁 Folder: {screenshot.folder}</p>
                )}
                {screenshot.processed ? (
                  <div className="status processed">
                    <span>✅ Processed</span>
                    {screenshot.metadata && (
                      <div className="metadata-summary">
                        <small>
                          📝 {screenshot.metadata.totalEntities} entities • 🎨{" "}
                          {screenshot.metadata.dominantColors
                            .slice(0, 2)
                            .join(", ")}{" "}
                          • 🏷️ {screenshot.tags?.slice(0, 3).join(", ")}
                        </small>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="status error">❌ Processing Failed</span>
                )}

                {/* Show analysis preview if available */}
                {screenshot.analysis && (
                  <div className="analysis-preview">
                    <details>
                      <summary>📊 Analysis Details</summary>
                      <div className="analysis-content">
                        <div className="analysis-section">
                          <strong>📝 Text Content:</strong>
                          <p className="text-content">
                            {screenshot.analysis.textContent?.substring(0, 100)}
                            {screenshot.analysis.textContent?.length > 100 &&
                              "..."}
                          </p>
                        </div>

                        <div className="analysis-section">
                          <strong>🎨 Visual Description:</strong>
                          <p className="visual-description">
                            {screenshot.analysis.visualDescription?.substring(
                              0,
                              150
                            )}
                            {screenshot.analysis.visualDescription?.length >
                              150 && "..."}
                          </p>
                        </div>

                        {screenshot.analysis.entityAnalysis && (
                          <div className="analysis-section">
                            <strong>
                              🔍 Detected Entities (
                              {screenshot.analysis.entityAnalysis.entities
                                ?.length || 0}
                              ):
                            </strong>
                            <div className="entities-list">
                              {screenshot.analysis.entityAnalysis.entities
                                ?.slice(0, 5)
                                .map((entity, idx) => (
                                  <span key={idx} className="entity-tag">
                                    {entity.label} ({entity.type})
                                  </span>
                                ))}
                              {screenshot.analysis.entityAnalysis.entities
                                ?.length > 5 && (
                                <span className="entity-tag">
                                  +
                                  {screenshot.analysis.entityAnalysis.entities
                                    .length - 5}{" "}
                                  more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {screenshot.tags && screenshot.tags.length > 0 && (
                          <div className="analysis-section">
                            <strong>🏷️ Tags:</strong>
                            <div className="tags-list">
                              {screenshot.tags.slice(0, 8).map((tag, idx) => (
                                <span key={idx} className="tag">
                                  {tag}
                                </span>
                              ))}
                              {screenshot.tags.length > 8 && (
                                <span className="tag">
                                  +{screenshot.tags.length - 8} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default VisualMemory;
