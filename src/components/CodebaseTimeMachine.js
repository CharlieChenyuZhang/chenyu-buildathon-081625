import React, { useState, useEffect } from "react";
import axios from "axios";
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

  useEffect(() => {
    loadAnalyses();
  }, []);

  const loadAnalyses = async () => {
    try {
      const response = await axios.get("/api/codebase-time-machine/analyses");
      setAnalyses(response.data.analyses);
      if (response.data.analyses.length > 0) {
        setSelectedAnalysis(response.data.analyses[0]);
      }
    } catch (error) {
      console.error("Error loading analyses:", error);
    }
  };

  const handleAnalyzeRepo = async (e) => {
    e.preventDefault();
    if (!repoForm.repoUrl) {
      alert("Please enter a repository URL");
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await axios.post(
        "/api/codebase-time-machine/analyze-repo",
        repoForm
      );
      setAnalyses((prev) => [...prev, response.data.analysis]);
      setSelectedAnalysis(response.data.analysis);
      setRepoForm({ repoUrl: "", branch: "main" });
      alert("Repository analysis started! This may take a few minutes.");
    } catch (error) {
      console.error("Analysis error:", error);
      alert("Failed to start repository analysis");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleQuery = async (e) => {
    e.preventDefault();
    if (!selectedAnalysis || !queryForm.question.trim()) {
      alert("Please select an analysis and enter a question");
      return;
    }

    try {
      const response = await axios.post("/api/codebase-time-machine/query", {
        analysisId: selectedAnalysis.id,
        question: queryForm.question,
        filters: queryForm.filters,
      });

      setQueryResult(response.data.queryResult);
    } catch (error) {
      console.error("Query error:", error);
      alert("Failed to process query");
    }
  };

  const loadAnalysisDetails = async (analysisId) => {
    if (!analysisId) return;

    try {
      const [analysisRes, evolutionRes, ownershipRes, featuresRes, commitsRes] =
        await Promise.all([
          axios.get(`/api/codebase-time-machine/analysis/${analysisId}`),
          axios.get(`/api/codebase-time-machine/evolution/${analysisId}`),
          axios.get(`/api/codebase-time-machine/ownership/${analysisId}`),
          axios.get(`/api/codebase-time-machine/features/${analysisId}`),
          axios.get(`/api/codebase-time-machine/commits/${analysisId}`),
        ]);

      setSelectedAnalysis(analysisRes.data.analysis);
      setEvolution(evolutionRes.data.evolution);
      setOwnership(ownershipRes.data.ownership);
      setFeatures(featuresRes.data.features);
      setCommits(commitsRes.data.commits);
    } catch (error) {
      console.error("Error loading analysis details:", error);
    }
  };

  useEffect(() => {
    if (selectedAnalysis) {
      loadAnalysisDetails(selectedAnalysis.id);
    }
  }, [selectedAnalysis]);

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "#4CAF50";
      case "processing":
        return "#FF9800";
      case "failed":
        return "#F44336";
      default:
        return "#757575";
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="codebase-time-machine">
      <h1>Codebase Time Machine</h1>
      <p>
        Navigate any codebase through time, understanding evolution of features
        and architectural decisions.
      </p>

      <div className="repository-section">
        <h2>Repository Analysis</h2>

        <form onSubmit={handleAnalyzeRepo} className="repo-form">
          <div className="form-group">
            <label>Repository URL:</label>
            <input
              type="url"
              value={repoForm.repoUrl}
              onChange={(e) =>
                setRepoForm((prev) => ({ ...prev, repoUrl: e.target.value }))
              }
              placeholder="https://github.com/username/repository"
              required
            />
          </div>
          <div className="form-group">
            <label>Branch:</label>
            <input
              type="text"
              value={repoForm.branch}
              onChange={(e) =>
                setRepoForm((prev) => ({ ...prev, branch: e.target.value }))
              }
              placeholder="main"
            />
          </div>
          <button type="submit" disabled={isAnalyzing} className="analyze-btn">
            {isAnalyzing ? "Analyzing..." : "Analyze Repository"}
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
          <div className="analysis-overview">
            <h2>Analysis Overview</h2>
            <div className="overview-grid">
              <div className="overview-card">
                <h3>Status</h3>
                <span
                  className="status"
                  style={{ color: getStatusColor(selectedAnalysis.status) }}
                >
                  {selectedAnalysis.status}
                </span>
              </div>
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
            </div>

            {selectedAnalysis.summary && (
              <div className="summary-section">
                <h3>Summary</h3>
                <div className="summary-grid">
                  <div className="summary-item">
                    <strong>Most Active Files:</strong>
                    <ul>
                      {selectedAnalysis.summary.mostActiveFiles?.map(
                        (file, index) => (
                          <li key={index}>{file}</li>
                        )
                      )}
                    </ul>
                  </div>
                  <div className="summary-item">
                    <strong>Top Contributors:</strong>
                    <ul>
                      {selectedAnalysis.summary.topContributors?.map(
                        (contributor, index) => (
                          <li key={index}>{contributor}</li>
                        )
                      )}
                    </ul>
                  </div>
                  <div className="summary-item">
                    <strong>Major Features:</strong>
                    <ul>
                      {selectedAnalysis.summary.majorFeatures?.map(
                        (feature, index) => (
                          <li key={index}>{feature}</li>
                        )
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="query-section">
            <h2>Natural Language Queries</h2>
            <form onSubmit={handleQuery} className="query-form">
              <div className="form-group">
                <label>Ask about your codebase:</label>
                <input
                  type="text"
                  value={queryForm.question}
                  onChange={(e) =>
                    setQueryForm((prev) => ({
                      ...prev,
                      question: e.target.value,
                    }))
                  }
                  placeholder="e.g., 'Why was this pattern introduced?' or 'Show me how auth evolved'"
                  className="query-input"
                  required
                />
              </div>
              <button type="submit" className="query-btn">
                Ask Question
              </button>
            </form>

            {queryResult && (
              <div className="query-result">
                <h3>Answer</h3>
                <p className="answer">{queryResult.answer}</p>

                <div className="related-commits">
                  <h4>Related Commits</h4>
                  <div className="commits-list">
                    {queryResult.relatedCommits?.map((commit, index) => (
                      <div key={index} className="commit-item">
                        <div className="commit-header">
                          <span className="hash">{commit.hash}</span>
                          <span className="author">{commit.author}</span>
                          <span className="date">
                            {formatDate(commit.date)}
                          </span>
                          <span className="relevance">
                            {(commit.relevance * 100).toFixed(0)}% relevant
                          </span>
                        </div>
                        <p className="message">{commit.message}</p>
                        <div className="files">
                          <strong>Files:</strong> {commit.files.join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="timeline">
                  <h4>Timeline</h4>
                  <div className="timeline-list">
                    {queryResult.timeline?.map((event, index) => (
                      <div key={index} className="timeline-item">
                        <span className="date">{formatDate(event.date)}</span>
                        <span className="event">{event.event}</span>
                        <span className="commit">{event.commit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {evolution && (
            <div className="evolution-section">
              <h2>Code Evolution</h2>
              <div className="evolution-chart">
                <h3>Complexity and Activity Over Time</h3>
                <div className="evolution-data">
                  {evolution.data?.map((point, index) => (
                    <div key={index} className="evolution-point">
                      <div className="date">{formatDate(point.date)}</div>
                      <div className="metrics">
                        <span>Commits: {point.commitCount}</span>
                        <span>Files: {point.filesChanged}</span>
                        <span>
                          Complexity: {(point.complexity * 100).toFixed(0)}%
                        </span>
                        <span>Contributors: {point.contributors}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="insights">
                  <h4>Insights</h4>
                  <ul>
                    {evolution.insights?.map((insight, index) => (
                      <li key={index}>{insight}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {ownership && (
            <div className="ownership-section">
              <h2>Code Ownership</h2>
              <div className="ownership-grid">
                <div className="contributors">
                  <h3>Top Contributors</h3>
                  <div className="contributors-list">
                    {ownership.contributors?.map((contributor, index) => (
                      <div key={index} className="contributor-card">
                        <h4>{contributor.name}</h4>
                        <div className="contributor-stats">
                          <span>Commits: {contributor.commits}</span>
                          <span>Lines Added: {contributor.linesAdded}</span>
                          <span>Files Owned: {contributor.filesOwned}</span>
                        </div>
                        <div className="primary-areas">
                          <strong>Primary Areas:</strong>{" "}
                          {contributor.primaryAreas.join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="file-ownership">
                  <h3>File Ownership</h3>
                  <div className="files-list">
                    {ownership.fileOwnership?.map((file, index) => (
                      <div key={index} className="file-item">
                        <span className="filename">{file.file}</span>
                        <span className="owner">{file.primaryOwner}</span>
                        <span className="ownership-percent">
                          {file.ownershipPercentage}%
                        </span>
                        <span className="last-modified">
                          {formatDate(file.lastModified)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {features && (
            <div className="features-section">
              <h2>Business Features</h2>
              <div className="features-list">
                {features.features?.map((feature, index) => (
                  <div key={index} className="feature-card">
                    <div className="feature-header">
                      <h3>{feature.name}</h3>
                      <span className="complexity">{feature.complexity}</span>
                    </div>
                    <p className="description">{feature.description}</p>
                    <div className="feature-details">
                      <div className="time-range">
                        <strong>Time Range:</strong>{" "}
                        {formatDate(feature.timeRange.start)} -{" "}
                        {formatDate(feature.timeRange.end)}
                      </div>
                      <div className="contributors">
                        <strong>Contributors:</strong>{" "}
                        {feature.contributors.join(", ")}
                      </div>
                      <div className="business-value">
                        <strong>Business Value:</strong> {feature.businessValue}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="decisions">
                <h3>Architectural Decisions</h3>
                <div className="decisions-list">
                  {features.decisions?.map((decision, index) => (
                    <div key={index} className="decision-card">
                      <div className="decision-header">
                        <span className="date">
                          {formatDate(decision.date)}
                        </span>
                        <span className={`impact ${decision.impact}`}>
                          {decision.impact}
                        </span>
                      </div>
                      <h4>{decision.decision}</h4>
                      <p className="rationale">{decision.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CodebaseTimeMachine;
