import React, { useState, useEffect, useRef } from "react";
import { api } from "../config/api";
import "./CodebaseTimeMachine.css";

function CodebaseTimeMachine() {
  const [analyses, setAnalyses] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [evolution, setEvolution] = useState(null);
  const [ownership, setOwnership] = useState(null);
  const [features, setFeatures] = useState(null);
  const [commits, setCommits] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [isScrolling, setIsScrolling] = useState(false);

  // Repository analysis form
  const [repoForm, setRepoForm] = useState({
    repoUrl: "",
    branch: "main",
  });

  // Query form
  const [queryForm, setQueryForm] = useState({
    question: "",
    filters: {},
  });

  // Refs for smooth scrolling
  const overviewRef = useRef(null);
  const evolutionRef = useRef(null);
  const ownershipRef = useRef(null);
  const featuresRef = useRef(null);

  useEffect(() => {
    loadAnalyses();
  }, []);

  // Poll for analysis status updates
  useEffect(() => {
    if (selectedAnalysis && selectedAnalysis.status === "processing") {
      const interval = setInterval(() => {
        loadAnalysisStatus(selectedAnalysis.id);
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [selectedAnalysis]);

  // Smooth scroll to section
  const scrollToSection = (sectionRef) => {
    if (sectionRef.current) {
      setIsScrolling(true);
      sectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setTimeout(() => setIsScrolling(false), 1000);
    }
  };

  const loadAnalyses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/api/codebase-time-machine/analyses");
      setAnalyses(response.data.analyses);
      if (response.data.analyses.length > 0 && !selectedAnalysis) {
        setSelectedAnalysis(response.data.analyses[0]);
      }
    } catch (error) {
      console.error("Error loading analyses:", error);
      setError("Failed to load analyses. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadAnalysisStatus = async (analysisId) => {
    try {
      const response = await api.get(
        `/api/codebase-time-machine/analysis/${analysisId}`
      );
      const updatedAnalysis = response.data.analysis;

      setAnalyses((prev) =>
        prev.map((a) => (a.id === analysisId ? updatedAnalysis : a))
      );

      if (selectedAnalysis?.id === analysisId) {
        setSelectedAnalysis(updatedAnalysis);

        // If analysis completed, load details
        if (updatedAnalysis.status === "completed") {
          loadAnalysisDetails(analysisId);
        }
      }
    } catch (error) {
      console.error("Error loading analysis status:", error);
    }
  };

  const handleAnalyzeRepo = async (e) => {
    e.preventDefault();
    if (!repoForm.repoUrl) {
      setError("Please enter a repository URL");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await api.post(
        "/api/codebase-time-machine/analyze-repo",
        repoForm
      );
      setAnalyses((prev) => [...prev, response.data.analysis]);
      setSelectedAnalysis(response.data.analysis);
      setRepoForm({ repoUrl: "", branch: "main" });
      setError(null);
    } catch (error) {
      console.error("Analysis error:", error);
      setError(
        error.response?.data?.error || "Failed to start repository analysis"
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleQuery = async (e) => {
    e.preventDefault();
    if (!selectedAnalysis || !queryForm.question.trim()) {
      setError("Please select an analysis and enter a question");
      return;
    }

    if (selectedAnalysis.status !== "completed") {
      setError(
        "Please wait for the analysis to complete before asking questions"
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.post("/api/codebase-time-machine/query", {
        analysisId: selectedAnalysis.id,
        question: queryForm.question,
        filters: queryForm.filters,
      });

      setQueryResult(response.data.queryResult);
      setError(null);
    } catch (error) {
      console.error("Query error:", error);
      setError(error.response?.data?.error || "Failed to process query");
    } finally {
      setLoading(false);
    }
  };

  const loadAnalysisDetails = async (analysisId) => {
    if (!analysisId) return;

    setLoading(true);
    try {
      const [analysisRes, evolutionRes, ownershipRes, featuresRes, commitsRes] =
        await Promise.all([
          api.get(`/api/codebase-time-machine/analysis/${analysisId}`),
          api.get(`/api/codebase-time-machine/evolution/${analysisId}`),
          api.get(`/api/codebase-time-machine/ownership/${analysisId}`),
          api.get(`/api/codebase-time-machine/features/${analysisId}`),
          api.get(`/api/codebase-time-machine/commits/${analysisId}`),
        ]);

      setSelectedAnalysis(analysisRes.data.analysis);
      setEvolution(evolutionRes.data.evolution);
      setOwnership(ownershipRes.data.ownership);
      setFeatures(featuresRes.data.features);
      setCommits(commitsRes.data.commits);
      setError(null);
    } catch (error) {
      console.error("Error loading analysis details:", error);
      setError("Failed to load analysis details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAnalysis && selectedAnalysis.status === "completed") {
      loadAnalysisDetails(selectedAnalysis.id);
    }
  }, [selectedAnalysis]);

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "#34c759";
      case "processing":
        return "#ff9500";
      case "failed":
        return "#ff3b30";
      default:
        return "#86868b";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleString();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return "✅";
      case "processing":
        return "⏳";
      case "failed":
        return "❌";
      default:
        return "⏸️";
    }
  };

  return (
    <div className="codebase-time-machine">
      <header className="app-header">
        <h1>Codebase Time Machine</h1>
        <p>
          Navigate any codebase through time, understanding evolution of
          features and architectural decisions with AI-powered insights.
        </p>
      </header>

      {error && (
        <div className="error-message" role="alert">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="error-dismiss"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <div className="repository-section card">
        <h2>Repository Analysis</h2>

        <form onSubmit={handleAnalyzeRepo} className="repo-form">
          <div className="form-group">
            <label htmlFor="repoUrl">Repository URL</label>
            <input
              id="repoUrl"
              type="url"
              value={repoForm.repoUrl}
              onChange={(e) =>
                setRepoForm((prev) => ({ ...prev, repoUrl: e.target.value }))
              }
              placeholder="https://github.com/username/repository"
              required
              disabled={isAnalyzing}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="branch">Branch</label>
            <input
              id="branch"
              type="text"
              value={repoForm.branch}
              onChange={(e) =>
                setRepoForm((prev) => ({ ...prev, branch: e.target.value }))
              }
              placeholder="main"
              disabled={isAnalyzing}
              className="form-input"
            />
          </div>
          <button
            type="submit"
            disabled={isAnalyzing}
            className="analyze-btn btn"
            aria-label={
              isAnalyzing ? "Analyzing repository..." : "Analyze repository"
            }
          >
            {isAnalyzing ? (
              <>
                <span className="btn-spinner"></span>
                Analyzing...
              </>
            ) : (
              "Analyze Repository"
            )}
          </button>
        </form>

        {analyses.length > 0 && (
          <div className="analyses-list">
            <h3>Repository Analyses</h3>
            <select
              value={selectedAnalysis?.id || ""}
              onChange={(e) => {
                const analysis = analyses.find((a) => a.id === e.target.value);
                setSelectedAnalysis(analysis);
              }}
              disabled={loading}
              className="analysis-select"
            >
              {analyses.map((analysis) => (
                <option key={analysis.id} value={analysis.id}>
                  {analysis.repoUrl} ({analysis.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedAnalysis && (
        <>
          <div className="analysis-overview card" ref={overviewRef}>
            <div className="section-header">
              <h2>Analysis Overview</h2>
              <div className="status-badge">
                <span className="status-icon">
                  {getStatusIcon(selectedAnalysis.status)}
                </span>
                <span
                  className="status-text"
                  style={{ color: getStatusColor(selectedAnalysis.status) }}
                >
                  {selectedAnalysis.status}
                </span>
              </div>
            </div>

            {selectedAnalysis.status === "processing" && (
              <div className="processing-indicator">
                <div className="spinner"></div>
                <span>Processing your repository...</span>
              </div>
            )}

            <div className="overview-grid">
              <div className="overview-card">
                <h3>Total Commits</h3>
                <span>{selectedAnalysis.metrics?.totalCommits || 0}</span>
              </div>
              <div className="overview-card">
                <h3>Total Files</h3>
                <span>{selectedAnalysis.metrics?.totalFiles || 0}</span>
              </div>
              <div className="overview-card">
                <h3>Contributors</h3>
                <span>{selectedAnalysis.metrics?.contributors || 0}</span>
              </div>
              <div className="overview-card">
                <h3>Lines of Code</h3>
                <span>
                  {selectedAnalysis.metrics?.linesOfCode?.toLocaleString() || 0}
                </span>
              </div>
            </div>

            {selectedAnalysis.startedAt && (
              <div className="timing-info">
                <p>
                  <strong>Started:</strong>{" "}
                  {formatDateTime(selectedAnalysis.startedAt)}
                </p>
                {selectedAnalysis.completedAt && (
                  <p>
                    <strong>Completed:</strong>{" "}
                    {formatDateTime(selectedAnalysis.completedAt)}
                  </p>
                )}
              </div>
            )}

            {selectedAnalysis.summary && (
              <div className="summary-section">
                <h3>Quick Insights</h3>
                <div className="summary-grid">
                  <div className="summary-item">
                    <strong>Most Active Files</strong>
                    <ul>
                      {selectedAnalysis.summary.mostActiveFiles
                        ?.slice(0, 5)
                        .map((file, index) => (
                          <li key={index}>{file}</li>
                        ))}
                    </ul>
                  </div>
                  <div className="summary-item">
                    <strong>Top Contributors</strong>
                    <ul>
                      {selectedAnalysis.summary.topContributors
                        ?.slice(0, 5)
                        .map((contributor, index) => (
                          <li key={index}>{contributor}</li>
                        ))}
                    </ul>
                  </div>
                  <div className="summary-item">
                    <strong>Major Features</strong>
                    <ul>
                      {selectedAnalysis.summary.majorFeatures
                        ?.slice(0, 5)
                        .map((feature, index) => (
                          <li key={index}>{feature}</li>
                        ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {selectedAnalysis.status === "completed" && (
            <>
              <div className="query-section card">
                <h2>Natural Language Queries</h2>
                <form onSubmit={handleQuery} className="query-form">
                  <div className="form-group">
                    <label htmlFor="queryInput">Ask about your codebase</label>
                    <input
                      id="queryInput"
                      type="text"
                      value={queryForm.question}
                      onChange={(e) =>
                        setQueryForm((prev) => ({
                          ...prev,
                          question: e.target.value,
                        }))
                      }
                      placeholder="e.g., 'Why was this pattern introduced?', 'How did the authentication system evolve?'"
                      className="query-input form-input"
                      required
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="submit"
                    className="query-btn btn"
                    disabled={loading}
                    aria-label={
                      loading ? "Processing query..." : "Ask question"
                    }
                  >
                    {loading ? (
                      <>
                        <span className="btn-spinner"></span>
                        Processing...
                      </>
                    ) : (
                      "Ask Question"
                    )}
                  </button>
                </form>

                {queryResult && (
                  <div className="query-result">
                    <h3>🔍 Analysis Results</h3>
                    <div className="answer-card">
                      <div className="answer-header">
                        <h4>Answer</h4>
                        <span className="confidence-score">
                          High Confidence
                        </span>
                      </div>
                      <div className="answer-content">{queryResult.answer}</div>
                    </div>

                    <div className="evidence-section">
                      <h4>📚 Supporting Evidence</h4>
                      <div className="commits-grid">
                        {queryResult.relatedCommits
                          ?.slice(0, 6)
                          .map((commit, index) => {
                            const relevanceColor =
                              commit.relevance > 0.7
                                ? "#34c759"
                                : commit.relevance > 0.4
                                ? "#ff9500"
                                : "#ff3b30";

                            return (
                              <div key={index} className="commit-evidence-card">
                                <div className="commit-header">
                                  <span className="hash">
                                    {commit.hash.substring(0, 8)}
                                  </span>
                                  <div
                                    className="relevance-indicator"
                                    style={{ backgroundColor: relevanceColor }}
                                    title={`${(commit.relevance * 100).toFixed(
                                      0
                                    )}% relevant`}
                                  >
                                    {(commit.relevance * 100).toFixed(0)}%
                                  </div>
                                </div>
                                <div className="commit-meta">
                                  <span className="author">
                                    👤 {commit.author}
                                  </span>
                                  <span className="date">
                                    📅 {formatDate(commit.date)}
                                  </span>
                                </div>
                                <p className="commit-message">
                                  {commit.message}
                                </p>
                                <div className="commit-impact">
                                  {commit.analysis && (
                                    <span
                                      className={`impact-badge ${commit.analysis.impact}`}
                                    >
                                      {commit.analysis.type} •{" "}
                                      {commit.analysis.impact} impact
                                    </span>
                                  )}
                                </div>
                                <div className="files-changed">
                                  <span>📁 {commit.files.length} files</span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    <div className="evolution-timeline">
                      <h4>🕒 Historical Timeline</h4>
                      <div className="timeline-container">
                        {queryResult.timeline?.map((event, index) => (
                          <div key={index} className="timeline-event">
                            <div className="timeline-marker"></div>
                            <div className="timeline-content">
                              <div className="timeline-date">
                                {formatDate(event.date)}
                              </div>
                              <div className="timeline-event-text">
                                {event.event}
                              </div>
                              <div className="timeline-commit">
                                <span className="commit-hash">
                                  {event.commit.substring(0, 8)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="navigation-tabs">
                <button
                  className={`nav-tab ${
                    activeSection === "evolution" ? "active" : ""
                  }`}
                  onClick={() => {
                    setActiveSection("evolution");
                    scrollToSection(evolutionRef);
                  }}
                >
                  📈 Evolution
                </button>
                <button
                  className={`nav-tab ${
                    activeSection === "ownership" ? "active" : ""
                  }`}
                  onClick={() => {
                    setActiveSection("ownership");
                    scrollToSection(ownershipRef);
                  }}
                >
                  👥 Ownership
                </button>
                <button
                  className={`nav-tab ${
                    activeSection === "features" ? "active" : ""
                  }`}
                  onClick={() => {
                    setActiveSection("features");
                    scrollToSection(featuresRef);
                  }}
                >
                  🏗️ Features
                </button>
              </div>

              {evolution && (
                <div className="evolution-section card" ref={evolutionRef}>
                  <h2>Code Evolution</h2>

                  <div className="evolution-chart">
                    <h3>Activity Timeline</h3>
                    <div className="timeline-chart">
                      {evolution.data?.map((point, index) => {
                        const maxCommits = Math.max(
                          ...evolution.data.map((p) => p.commitCount)
                        );
                        const commitHeight =
                          (point.commitCount / maxCommits) * 100;
                        const complexityColor =
                          point.complexity > 0.7
                            ? "#ff3b30"
                            : point.complexity > 0.4
                            ? "#ff9500"
                            : "#34c759";

                        return (
                          <div
                            key={index}
                            className="timeline-bar"
                            title={`${formatDate(point.date)}: ${
                              point.commitCount
                            } commits`}
                          >
                            <div
                              className="commit-bar"
                              style={{
                                height: `${commitHeight}px`,
                                backgroundColor: complexityColor,
                                minHeight: "10px",
                              }}
                            ></div>
                            <div className="bar-label">
                              {point.date.split("-")[1]}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="evolution-metrics">
                      <div className="metric-card">
                        <h4>Peak Activity</h4>
                        <p>
                          {
                            evolution.data?.reduce(
                              (max, curr) =>
                                curr.commitCount > max.commitCount ? curr : max,
                              { commitCount: 0, date: "N/A" }
                            )?.date
                          }
                        </p>
                      </div>
                      <div className="metric-card">
                        <h4>Most Complex Period</h4>
                        <p>
                          {
                            evolution.data?.reduce(
                              (max, curr) =>
                                curr.complexity > max.complexity ? curr : max,
                              { complexity: 0, date: "N/A" }
                            )?.date
                          }
                        </p>
                      </div>
                      <div className="metric-card">
                        <h4>Team Size Peak</h4>
                        <p>
                          {Math.max(
                            ...(evolution.data?.map((p) => p.contributors) || [
                              0,
                            ])
                          )}{" "}
                          contributors
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="insights">
                    <h4>AI-Generated Insights</h4>
                    <div className="insights-grid">
                      {evolution.insights?.map((insight, index) => (
                        <div key={index} className="insight-card">
                          <div className="insight-icon">💡</div>
                          <div className="insight-text">{insight}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {ownership && (
                <div className="ownership-section card" ref={ownershipRef}>
                  <h2>Code Ownership & Team Dynamics</h2>

                  <div className="ownership-overview">
                    <div className="ownership-stats">
                      <div className="stat-card">
                        <h4>Bus Factor</h4>
                        <div className="stat-value">
                          {ownership.contributors?.filter((c) => c.commits > 10)
                            .length || 0}
                        </div>
                        <p>Key contributors</p>
                      </div>
                      <div className="stat-card">
                        <h4>Knowledge Distribution</h4>
                        <div className="stat-value">
                          {ownership.contributors?.length > 0
                            ? Math.round(
                                (ownership.contributors.filter(
                                  (c) => c.commits > 5
                                ).length /
                                  ownership.contributors.length) *
                                  100
                              )
                            : 0}
                          %
                        </div>
                        <p>Active contributors</p>
                      </div>
                      <div className="stat-card">
                        <h4>File Concentration</h4>
                        <div className="stat-value">
                          {ownership.fileOwnership?.filter(
                            (f) => f.ownershipPercentage > 80
                          ).length || 0}
                        </div>
                        <p>Single-owner files</p>
                      </div>
                    </div>
                  </div>

                  <div className="ownership-grid">
                    <div className="contributors">
                      <h3>Contributors Impact</h3>
                      <div className="contributors-list">
                        {ownership.contributors
                          ?.slice(0, 8)
                          .map((contributor, index) => {
                            const totalLines =
                              contributor.linesAdded + contributor.linesRemoved;
                            const maxLines = Math.max(
                              ...ownership.contributors.map(
                                (c) => c.linesAdded + c.linesRemoved
                              )
                            );
                            const impactWidth = (totalLines / maxLines) * 100;

                            return (
                              <div key={index} className="contributor-card">
                                <div className="contributor-header">
                                  <h4>{contributor.name}</h4>
                                  <span className="commit-count">
                                    {contributor.commits} commits
                                  </span>
                                </div>
                                <div className="impact-bar">
                                  <div
                                    className="impact-fill"
                                    style={{ width: `${impactWidth}%` }}
                                  ></div>
                                </div>
                                <div className="contributor-stats">
                                  <span>
                                    +{contributor.linesAdded.toLocaleString()}
                                  </span>
                                  <span>
                                    -{contributor.linesRemoved.toLocaleString()}
                                  </span>
                                  <span>{contributor.filesOwned} files</span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    <div className="file-ownership">
                      <h3>File Ownership Risk</h3>
                      <div className="files-list">
                        {ownership.fileOwnership
                          ?.slice(0, 15)
                          .map((file, index) => {
                            const riskLevel =
                              file.ownershipPercentage > 80
                                ? "high"
                                : file.ownershipPercentage > 60
                                ? "medium"
                                : "low";

                            return (
                              <div
                                key={index}
                                className={`file-item risk-${riskLevel}`}
                              >
                                <span className="filename">{file.file}</span>
                                <span className="owner">
                                  {file.primaryOwner}
                                </span>
                                <span className="ownership-percent">
                                  {file.ownershipPercentage}%
                                </span>
                                <span className={`risk-indicator ${riskLevel}`}>
                                  {riskLevel} risk
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {features && (
                <div className="features-section card" ref={featuresRef}>
                  <h2>Business Features & Architecture Evolution</h2>

                  <div className="features-overview">
                    <div className="feature-stats">
                      <div className="stat-item">
                        <span className="stat-number">
                          {features.features?.length || 0}
                        </span>
                        <span className="stat-label">Features Identified</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-number">
                          {features.decisions?.length || 0}
                        </span>
                        <span className="stat-label">
                          Architectural Decisions
                        </span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-number">
                          {features.features?.filter(
                            (f) => f.complexity === "high"
                          ).length || 0}
                        </span>
                        <span className="stat-label">High Complexity</span>
                      </div>
                    </div>
                  </div>

                  <div className="features-timeline">
                    <h3>Feature Development Timeline</h3>
                    <div className="timeline-container">
                      {features.features
                        ?.sort(
                          (a, b) =>
                            new Date(a.timeRange.start) -
                            new Date(b.timeRange.start)
                        )
                        .map((feature, index) => {
                          const startDate = new Date(feature.timeRange.start);
                          const endDate = new Date(feature.timeRange.end);
                          const duration = Math.max(
                            1,
                            Math.ceil(
                              (endDate - startDate) / (1000 * 60 * 60 * 24)
                            )
                          );

                          return (
                            <div key={index} className="timeline-feature">
                              <div className="feature-timeline-header">
                                <h4>{feature.name}</h4>
                                <span
                                  className={`complexity-badge ${feature.complexity}`}
                                >
                                  {feature.complexity}
                                </span>
                              </div>
                              <div className="feature-timeline-bar">
                                <div
                                  className="timeline-duration"
                                  style={{
                                    width: `${Math.min(100, duration * 2)}px`,
                                  }}
                                ></div>
                                <span className="duration-text">
                                  {duration} days
                                </span>
                              </div>
                              <p className="feature-description">
                                {feature.description}
                              </p>
                              <div className="feature-meta">
                                <span>
                                  👥 {feature.contributors?.join(", ")}
                                </span>
                                <span>💼 {feature.businessValue}</span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className="decisions">
                    <h3>Key Architectural Decisions</h3>
                    <div className="decisions-timeline">
                      {features.decisions
                        ?.sort((a, b) => new Date(b.date) - new Date(a.date))
                        .slice(0, 8)
                        .map((decision, index) => (
                          <div key={index} className="decision-card">
                            <div className="decision-header">
                              <div className="decision-date">
                                {formatDate(decision.date)}
                              </div>
                              <span
                                className={`impact-badge ${decision.impact}`}
                              >
                                {decision.impact} impact
                              </span>
                            </div>
                            <h4>{decision.decision}</h4>
                            <p className="rationale">{decision.rationale}</p>
                            <div className="decision-commits">
                              <span>
                                🔗 {decision.relatedCommits?.length || 0}{" "}
                                related commits
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      )}
    </div>
  );
}

export default CodebaseTimeMachine;
