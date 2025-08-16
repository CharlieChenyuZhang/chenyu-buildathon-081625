import React, { useState, useRef } from "react";
import axios from "axios";
import "./VoiceToSlide.css";

function VoiceToSlide() {
  const [audioFile, setAudioFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [slideDeck, setSlideDeck] = useState(null);
  const [audioId, setAudioId] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [generationHistory, setGenerationHistory] = useState([]);

  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setAudioFile(file);
  };

  const handleUpload = async () => {
    if (!audioFile) {
      alert("Please select an audio file");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("audio", audioFile);

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
      alert("Audio uploaded successfully! Processing will begin shortly.");
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload audio");
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
      const formData = new FormData();
      formData.append("audioBlob", blob);
      formData.append("duration", recordingTime);

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
      alert("Audio recorded successfully! Processing will begin shortly.");
    } catch (error) {
      console.error("Recording upload error:", error);
      alert("Failed to save recorded audio");
    }
  };

  const generateSlides = async () => {
    if (!audioId) {
      alert("Please upload or record audio first");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await axios.post("/api/voice-to-slide/generate-slides", {
        audioId: audioId,
        options: {
          format: "html",
          slideCount: 5,
        },
      });

      setSlideDeck(response.data.deck);
      setGenerationHistory((prev) => [response.data.deck, ...prev]);
      alert("Slide deck generated successfully!");
    } catch (error) {
      console.error("Generation error:", error);
      alert("Failed to generate slides");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadSlides = async (format = "html") => {
    if (!slideDeck) return;

    try {
      const response = await axios.get(
        `/api/voice-to-slide/deck/${slideDeck.id}/download?format=${format}`,
        {
          responseType: "blob",
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `slides.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download slides");
    }
  };

  const loadHistory = async () => {
    try {
      const response = await axios.get("/api/voice-to-slide/history");
      setGenerationHistory(response.data.history);
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  React.useEffect(() => {
    loadHistory();
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="voice-to-slide project-component">
      <h1>Voice-to-Slide Generator</h1>
      <p>Generate a polished slide deck from a 3-minute spoken prompt.</p>

      <div className="section audio-input-section">
        <h2>Audio Input</h2>

        <div className="upload-section">
          <h3>Upload Audio File</h3>
          <div className="upload-area">
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="file-input"
            />
            <button
              onClick={handleUpload}
              disabled={isUploading || !audioFile}
              className={`upload-btn ${isUploading ? 'loading' : ''}`}
            >
              {isUploading ? "Uploading..." : "Upload Audio"}
            </button>
          </div>
          {audioFile && (
            <div className="selected-files">
              <h3>Selected File</h3>
              <ul>
                <li>{audioFile.name}</li>
              </ul>
            </div>
          )}
        </div>

        <div className="record-section">
          <h3>Record Audio</h3>
          <div className="record-area">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`record-btn ${isRecording ? "recording" : ""}`}
            >
              {isRecording ? "Stop Recording" : "Start Recording"}
            </button>
            {isRecording && (
              <div className="recording-time">
                Recording: {formatTime(recordingTime)}
              </div>
            )}
          </div>
        </div>
      </div>

      {audioId && (
        <div className="section generate-section">
          <h2>Generate Slides</h2>
          <button
            onClick={generateSlides}
            disabled={isGenerating}
            className={`generate-btn ${isGenerating ? 'loading' : ''}`}
          >
            {isGenerating ? "Generating..." : "Generate Slide Deck"}
          </button>
        </div>
      )}

      {slideDeck && (
        <div className="section slides-section">
          <h2>Generated Slide Deck</h2>
          <div className="slide-deck-info card">
            <p>
              <strong>Total Slides:</strong> {slideDeck.totalSlides}
            </p>
            <p>
              <strong>Generated:</strong>{" "}
              {new Date(slideDeck.generatedAt).toLocaleString()}
            </p>
            <p>
              <strong>Format:</strong> {slideDeck.format}
            </p>
          </div>

          <div className="slides-preview">
            <h3>Slides Preview</h3>
            <div className="slides-list grid grid-2">
              {slideDeck.slides.map((slide, index) => (
                <div key={slide.id} className="slide-preview card">
                  <h4>
                    Slide {slide.order}: {slide.title}
                  </h4>
                  <p>
                    <strong>Content:</strong> {slide.content}
                  </p>
                  <p>
                    <strong>Speaker Notes:</strong> {slide.speakerNotes}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="download-section">
            <h3>Download Options</h3>
            <div className="download-buttons">
              <button
                onClick={() => downloadSlides("html")}
                className="download-btn btn"
              >
                Download as HTML
              </button>
              <button
                onClick={() => downloadSlides("pdf")}
                className="download-btn btn"
              >
                Download as PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {generationHistory.length > 0 && (
        <div className="section history-section">
          <h2>Generation History ({generationHistory.length})</h2>
          <div className="history-list grid grid-3">
            {generationHistory.map((item, index) => (
              <div key={index} className="history-item card">
                <h4>{item.audioName || `Deck ${item.id}`}</h4>
                <p>Generated: {new Date(item.generatedAt).toLocaleString()}</p>
                <p>Slides: {item.slideCount}</p>
                <span className={`status-badge ${item.status}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceToSlide;
