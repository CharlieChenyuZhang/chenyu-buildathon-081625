import React, { useState, useRef } from "react";
import axios from "axios";
import "./VoiceToSlide.css";

function VoiceToSlide() {
  const [currentStep, setCurrentStep] = useState(1);
  const [audioFile, setAudioFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [slideDeck, setSlideDeck] = useState(null);
  const [audioId, setAudioId] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [processingStatus, setProcessingStatus] = useState("");
  const [transcribedText, setTranscribedText] = useState("");
  const [showPresentation, setShowPresentation] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState("");

  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  const steps = [
    { id: 1, title: "Add Audio", description: "Upload or record your audio" },
    { id: 2, title: "Review", description: "Check transcription & preview" },
    { id: 3, title: "Generate", description: "Create your slide deck" },
    { id: 4, title: "Download", description: "Get your presentation" },
  ];

  const triggerFileInput = () => {
    const fileInput = document.getElementById("audio-file-upload");
    if (fileInput) {
      fileInput.click();
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    console.log("Selected file:", file);
    setAudioFile(file);
  };

  const handleUpload = async () => {
    if (!audioFile) {
      alert("Please select an audio file");
      return;
    }

    // Validate file type
    const allowedTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/wave",
      "audio/x-wav",
      "audio/mp4",
      "audio/aac",
      "audio/ogg",
      "audio/webm",
      "audio/flac",
      "audio/x-m4a",
    ];
    if (
      !allowedTypes.includes(audioFile.type) &&
      !audioFile.name.match(/\.(mp3|wav|m4a|aac|ogg|webm|flac)$/i)
    ) {
      alert(
        "Please select a valid audio file (MP3, WAV, M4A, AAC, OGG, WEBM, FLAC)"
      );
      return;
    }

    // Validate file size (50MB limit)
    if (audioFile.size > 50 * 1024 * 1024) {
      alert("File size must be less than 50MB");
      return;
    }

    setIsUploading(true);
    setProcessingStatus("Processing your audio...");
    const formData = new FormData();
    formData.append("audio", audioFile);

    console.log(
      "Uploading file:",
      audioFile.name,
      "Size:",
      audioFile.size,
      "Type:",
      audioFile.type
    );

    try {
      const response = await axios.post(
        "/api/voice-to-slide/upload-audio",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setAudioId(response.data.file.id);

      // Check if transcription is available immediately
      if (response.data.file.transcribedText) {
        setTranscribedText(response.data.file.transcribedText);
        setProcessingStatus("Audio processed successfully!");
        setCurrentStep(2);
      } else {
        // If transcription is not available, poll for it
        setTranscribedText("Processing transcription...");
        setProcessingStatus("Processing your audio...");
        setCurrentStep(2);
        pollForTranscription(response.data.file.id);
      }
    } catch (error) {
      console.error("Upload error:", error);
      const errorMessage =
        error.response?.data?.details ||
        error.response?.data?.error ||
        error.message ||
        "Failed to upload audio";
      setProcessingStatus(`Failed to upload audio: ${errorMessage}`);
      alert(`Failed to upload audio: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/wav" });
        await handleRecordedAudio(blob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Recording error:", error);
      alert("Failed to start recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
    }
  };

  const handleRecordedAudio = async (blob) => {
    try {
      setIsProcessing(true);
      setProcessingStatus("Processing your recording...");

      // Convert blob to file
      const audioFile = new File([blob], `recorded-audio-${Date.now()}.wav`, {
        type: "audio/wav",
      });

      const formData = new FormData();
      formData.append("audioBlob", audioFile);

      const response = await axios.post(
        "/api/voice-to-slide/record-audio",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setAudioId(response.data.audio.id);

      // Check if transcription is available immediately
      if (response.data.audio.transcribedText) {
        setTranscribedText(response.data.audio.transcribedText);
        setProcessingStatus("Recording processed successfully!");
        setCurrentStep(2);
      } else {
        // If transcription is not available, poll for it
        setTranscribedText("Processing transcription...");
        setProcessingStatus("Processing your recording...");
        setCurrentStep(2);
        pollForTranscription(response.data.audio.id);
      }
    } catch (error) {
      console.error("Recording upload error:", error);
      const errorMessage =
        error.response?.data?.details ||
        error.response?.data?.error ||
        error.message ||
        "Failed to save recorded audio";
      setProcessingStatus(`Failed to save recorded audio: ${errorMessage}`);
      alert(`Failed to save recorded audio: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateSlides = async () => {
    if (!audioId) {
      alert("Please upload or record audio first");
      return;
    }

    setIsGenerating(true);
    setProcessingStatus("Creating your slide deck...");
    try {
      const response = await axios.post("/api/voice-to-slide/generate-slides", {
        audioId: audioId,
        options: {
          format: "html",
          slideCount: 5,
        },
      });

      setSlideDeck(response.data.deck);
      setProcessingStatus("Slide deck created successfully!");
      setCurrentStep(4);
    } catch (error) {
      console.error("Generation error:", error);
      setProcessingStatus("Failed to generate slides");
      alert("Failed to generate slides");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadSlides = async (format = "html") => {
    if (!slideDeck) return;

    setIsDownloading(true);
    setDownloadFormat(format);

    try {
      console.log(`Downloading slides in ${format} format...`);

      const response = await axios.get(
        `/api/voice-to-slide/deck/${slideDeck.id}/download?format=${format}`,
        {
          responseType: "blob",
          timeout: 60000, // 60 second timeout for PDF generation
        }
      );

      console.log("Download response received:", response.headers);

      // Check if we got a PDF or HTML file
      const contentType = response.headers["content-type"];
      let actualFormat = format;

      if (contentType && contentType.includes("text/html")) {
        actualFormat = "html";
      } else if (contentType && contentType.includes("application/pdf")) {
        actualFormat = "pdf";
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `slides.${actualFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Clean up the URL object
      window.URL.revokeObjectURL(url);

      console.log(`Download completed: slides.${actualFormat}`);
    } catch (error) {
      console.error("Download error:", error);

      if (format === "pdf") {
        // If PDF fails, try to provide helpful error message
        alert(
          "PDF generation failed. The system will provide an HTML file that you can convert to PDF using your browser's print function (Ctrl+P / Cmd+P)."
        );
      } else {
        alert("Failed to download slides");
      }
    } finally {
      setIsDownloading(false);
      setDownloadFormat("");
    }
  };

  const downloadSpeakerNotes = async () => {
    if (!slideDeck) return;

    try {
      const response = await axios.get(
        `/api/voice-to-slide/deck/${slideDeck.id}/speaker-notes`,
        {
          responseType: "blob",
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `speaker-notes.txt`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Download speaker notes error:", error);
      alert("Failed to download speaker notes");
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const pollForTranscription = async (audioId) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    const poll = async () => {
      try {
        console.log(`Polling attempt ${attempts + 1} for audioId:`, audioId);
        const response = await axios.get(
          `/api/voice-to-slide/status/${audioId}`
        );

        console.log("Status response:", response.data);

        if (
          response.data.status.status === "completed" ||
          response.data.status.status === "partial"
        ) {
          // Check if transcription is available in the status response
          if (response.data.status.transcribedText) {
            console.log(
              "Found transcription in status response:",
              response.data.status.transcribedText.substring(0, 100) + "..."
            );
            setTranscribedText(response.data.status.transcribedText);
            setProcessingStatus("Audio processed successfully!");
            clearInterval(pollingIntervalRef.current);
            return;
          }

          // Fallback: Try to get the transcription from the separate endpoint
          try {
            const dataResponse = await axios.get(
              `/api/voice-to-slide/transcription/${audioId}`
            );
            if (dataResponse.data.transcribedText) {
              setTranscribedText(dataResponse.data.transcribedText);
              setProcessingStatus("Audio processed successfully!");
              clearInterval(pollingIntervalRef.current);
              return;
            }
          } catch (dataError) {
            console.log("Could not fetch transcription data:", dataError);
          }
        }

        attempts++;
        if (attempts >= maxAttempts) {
          setTranscribedText("Transcription failed. Please try again.");
          setProcessingStatus("Transcription failed");
          clearInterval(pollingIntervalRef.current);
        }
      } catch (error) {
        console.error("Polling error:", error);
        attempts++;
        if (attempts >= maxAttempts) {
          setTranscribedText("Transcription failed. Please try again.");
          setProcessingStatus("Transcription failed");
          clearInterval(pollingIntervalRef.current);
        }
      }
    };

    // Start polling every second
    pollingIntervalRef.current = setInterval(poll, 1000);
  };

  const nextSlide = () => {
    if (slideDeck && currentSlideIndex < slideDeck.slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  const goToSlide = (index) => {
    setCurrentSlideIndex(index);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const renderPresentation = () => {
    if (!slideDeck || !showPresentation) return null;

    const currentSlide = slideDeck.slides[currentSlideIndex];

    return (
      <div className="presentation-overlay">
        <div className="presentation-container">
          <div className="presentation-header">
            <div className="presentation-info">
              <span className="slide-counter">
                {currentSlideIndex + 1} of {slideDeck.slides.length}
              </span>
              <span className="presentation-title">
                Voice-to-Slide Presentation
              </span>
            </div>
            <div className="presentation-controls">
              <button
                onClick={() => setShowPresentation(false)}
                className="control-btn"
              >
                ✕
              </button>
              <button onClick={toggleFullscreen} className="control-btn">
                ⛶
              </button>
            </div>
          </div>

          <div className="slide-container">
            <div className="slide-content">
              <h1 className="slide-title">{currentSlide.title}</h1>
              <div className="slide-body">
                <p className="slide-text">{currentSlide.content}</p>
              </div>
            </div>
          </div>

          <div className="presentation-footer">
            <button
              onClick={prevSlide}
              disabled={currentSlideIndex === 0}
              className="nav-btn"
            >
              ← Previous
            </button>

            <div className="slide-thumbnails">
              {slideDeck.slides.map((slide, index) => (
                <button
                  key={slide.id}
                  onClick={() => goToSlide(index)}
                  className={`thumbnail ${
                    index === currentSlideIndex ? "active" : ""
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <button
              onClick={nextSlide}
              disabled={currentSlideIndex === slideDeck.slides.length - 1}
              className="nav-btn"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderStepIndicator = () => (
    <div className="step-indicator">
      {steps.map((step, index) => (
        <div key={step.id} className="step-item">
          <div
            className={`step-circle ${currentStep >= step.id ? "active" : ""} ${
              currentStep > step.id ? "completed" : ""
            }`}
          >
            {currentStep > step.id ? "✓" : step.id}
          </div>
          <div className="step-info">
            <h4
              className={`step-title ${currentStep >= step.id ? "active" : ""}`}
            >
              {step.title}
            </h4>
            <p
              className={`step-description ${
                currentStep >= step.id ? "active" : ""
              }`}
            >
              {step.description}
            </p>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`step-connector ${
                currentStep > step.id ? "active" : ""
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="step-content">
      <div className="step-header">
        <h2>Add Your Audio</h2>
        <p>Upload an audio file or record directly in your browser</p>
      </div>

      {processingStatus && (
        <div className="status-banner">
          <div className="status-content">
            {isProcessing || isUploading ? (
              <div className="loading-spinner">⏳</div>
            ) : (
              <div className="status-icon">✓</div>
            )}
            <span className="status-text">{processingStatus}</span>
          </div>
        </div>
      )}

      <div className="audio-input-grid">
        <div className="input-card">
          <div className="card-header">
            <div className="card-icon">📁</div>
            <h3>Upload Audio</h3>
          </div>
          <div className="upload-area">
            <input
              type="file"
              id="audio-file-upload"
              accept="audio/*"
              onChange={handleFileSelect}
              className="file-input"
              style={{ display: "none" }}
            />
            <div className="upload-zone" onClick={triggerFileInput}>
              <div className="upload-content">
                <div className="upload-icon">🎵</div>
                <p className="upload-text">Choose an audio file</p>
                <p className="upload-hint">
                  MP3, WAV, M4A, AAC, OGG, WEBM, FLAC
                </p>
              </div>
            </div>
            {audioFile && (
              <div className="file-preview">
                <div className="file-info">
                  <span className="file-name">{audioFile.name}</span>
                  <span className="file-size">
                    {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                {isUploading ? (
                  <div className="loading-container">
                    <div className="loading-spinner">⏳</div>
                  </div>
                ) : (
                  <button onClick={handleUpload} className="primary-button">
                    Process Audio
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="input-card">
          <div className="card-header">
            <div className="card-icon">🎤</div>
            <h3>Record Audio</h3>
          </div>
          <div className="record-area">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`record-button ${isRecording ? "recording" : ""}`}
            >
              <div className="record-icon">{isRecording ? "⏹️" : "🎤"}</div>
              <span>{isRecording ? "Stop Recording" : "Start Recording"}</span>
            </button>
            {isRecording && (
              <div className="recording-timer">
                <span className="timer-text">{formatTime(recordingTime)}</span>
                <div className="recording-indicator">
                  <div className="pulse-dot"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="step-content">
      <div className="step-header">
        <h2>Review Your Content</h2>
        <p>Check the transcription and make sure everything looks correct</p>
      </div>

      <div className="review-section">
        <div className="transcription-card">
          <div className="card-header">
            <div className="card-icon">📝</div>
            <h3>Transcription</h3>
          </div>
          <div className="transcription-content">
            <p className="transcription-text">
              {transcribedText || "Processing transcription..."}
            </p>
          </div>
        </div>

        <div className="action-buttons">
          <button
            onClick={() => setCurrentStep(1)}
            className="secondary-button"
          >
            ← Back to Audio
          </button>
          <button
            onClick={() => setCurrentStep(3)}
            className="primary-button"
            disabled={!transcribedText || transcribedText === "Processing..."}
          >
            Continue to Generate →
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="step-content">
      <div className="step-header">
        <h2>Generate Your Slides</h2>
        <p>AI will create a professional slide deck from your audio</p>
      </div>

      <div className="generate-section">
        <div className="generate-card">
          <div className="card-header">
            <div className="card-icon">✨</div>
            <h3>Ready to Generate</h3>
          </div>
          <div className="generate-content">
            <p>
              Your audio has been processed and is ready to be converted into
              slides.
            </p>
            <button
              onClick={generateSlides}
              disabled={isGenerating}
              className={`primary-button large ${
                isGenerating ? "loading" : ""
              }`}
            >
              {isGenerating ? "Creating Slides..." : "Generate Slide Deck"}
            </button>
          </div>
        </div>

        <div className="action-buttons">
          <button
            onClick={() => setCurrentStep(2)}
            className="secondary-button"
          >
            ← Back to Review
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="step-content">
      <div className="step-header">
        <h2>Your Slide Deck is Ready</h2>
        <p>View your presentation and download in your preferred format</p>
      </div>

      {slideDeck && (
        <div className="result-section">
          <div className="slides-display">
            <div className="slides-header">
              <h3>Your Generated Slides</h3>
              <div className="slides-info">
                <span className="slide-count">
                  {slideDeck.slides.length} slides
                </span>
                <span className="generation-date">
                  Generated{" "}
                  {new Date(slideDeck.generatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="slides-container">
              {slideDeck.slides.map((slide, index) => (
                <div key={slide.id} className="slide-preview-card">
                  <div className="slide-header">
                    <div className="slide-number-badge">Slide {index + 1}</div>
                    <h4 className="slide-preview-title">{slide.title}</h4>
                  </div>
                  <div className="slide-preview-content">
                    <p className="slide-preview-text">{slide.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="presentation-actions">
            <button
              onClick={() => setShowPresentation(true)}
              className="primary-button large"
            >
              🎭 View Presentation
            </button>
          </div>

          <div className="download-section">
            <h3>Download Options</h3>
            <div className="download-buttons">
              <button
                onClick={() => downloadSlides("html")}
                disabled={isDownloading}
                className={`download-button primary ${
                  isDownloading && downloadFormat === "html" ? "loading" : ""
                }`}
              >
                <span className="download-icon">
                  {isDownloading && downloadFormat === "html" ? "⏳" : "📄"}
                </span>
                {isDownloading && downloadFormat === "html"
                  ? "Generating..."
                  : "Download as HTML"}
              </button>
              <button
                onClick={() => downloadSlides("pdf")}
                disabled={isDownloading}
                className={`download-button secondary ${
                  isDownloading && downloadFormat === "pdf" ? "loading" : ""
                }`}
              >
                <span className="download-icon">
                  {isDownloading && downloadFormat === "pdf" ? "⏳" : "📋"}
                </span>
                {isDownloading && downloadFormat === "pdf"
                  ? "Generating PDF..."
                  : "Download as PDF"}
              </button>
              <button
                onClick={() => downloadSpeakerNotes()}
                disabled={isDownloading}
                className="download-button tertiary"
              >
                <span className="download-icon">📝</span>
                Download Speaker Notes
              </button>
            </div>
            {isDownloading && (
              <div className="download-status">
                <p>
                  Generating {downloadFormat.toUpperCase()} file... This may
                  take a moment.
                </p>
              </div>
            )}

            <div className="download-help">
              <p>
                <strong>💡 Tip:</strong> PDFs are now generated using a
                lightweight library. If you prefer more formatting options, you
                can also convert the HTML file to PDF using your browser's print
                function (Ctrl+P / Cmd+P) and selecting "Save as PDF".
              </p>
            </div>
          </div>

          <div className="action-buttons">
            <button
              onClick={() => {
                setCurrentStep(1);
                setAudioFile(null);
                setSlideDeck(null);
                setAudioId(null);
                setTranscribedText("");
                setProcessingStatus("");
              }}
              className="primary-button"
            >
              Create New Presentation
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return renderStep1();
    }
  };

  return (
    <div className="voice-to-slide">
      <div className="container">
        <div className="header">
          <h1>Voice-to-Slide Generator</h1>
          <p>Transform your spoken ideas into professional presentations</p>
        </div>

        {renderStepIndicator()}

        <div className="main-content">{renderCurrentStep()}</div>
      </div>

      {renderPresentation()}
    </div>
  );
}

export default VoiceToSlide;
