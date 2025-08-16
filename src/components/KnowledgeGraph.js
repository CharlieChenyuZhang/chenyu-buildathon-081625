import React, { useState, useEffect } from "react";
import { api } from "../config/api";
import "./KnowledgeGraph.css";

function KnowledgeGraph() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [graph, setGraph] = useState(null);
  const [visualization, setVisualization] = useState(null);
  const [queryResult, setQueryResult] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);

  // Project creation form
  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
  });

  // Query form
  const [queryForm, setQueryForm] = useState({
    question: "",
  });

  // URL form
  const [urlForm, setUrlForm] = useState({
    url: "",
    title: "",
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await api.get("/api/knowledge-graph/projects");
      setProjects(response.data.projects);
      if (response.data.projects.length > 0) {
        setSelectedProject(response.data.projects[0]);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectForm.name.trim()) {
      alert("Please enter a project name");
      return;
    }

    setIsCreating(true);
    try {
      const response = await api.post(
        "/api/knowledge-graph/create-project",
        projectForm
      );
      setProjects((prev) => [...prev, response.data.project]);
      setSelectedProject(response.data.project);
      setProjectForm({ name: "", description: "" });
      alert("Knowledge graph project created successfully!");
    } catch (error) {
      console.error("Project creation error:", error);
      alert("Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("documents", file);
    });

    try {
      const response = await api.post(
        `/api/knowledge-graph/project/${selectedProject.id}/upload-documents`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setDocuments((prev) => [...prev, ...response.data.files]);
      alert("Documents uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload documents");
    } finally {
      // Clear the file input
      event.target.value = "";
    }
  };

  const handleAddUrl = async (e) => {
    e.preventDefault();
    if (!urlForm.url.trim()) {
      alert("Please enter a URL");
      return;
    }

    try {
      const response = await api.post(
        `/api/knowledge-graph/project/${selectedProject.id}/add-url`,
        urlForm
      );
      setUrlForm({ url: "", title: "" });
      alert("URL added successfully!");
      // Refresh documents list to show the new URL
      loadProjectDetails(selectedProject.id);
    } catch (error) {
      console.error("URL addition error:", error);
      alert("Failed to add URL");
    }
  };

  const handleBuildGraph = async () => {
    if (!selectedProject) return;

    setIsBuilding(true);
    try {
      const response = await api.post(
        `/api/knowledge-graph/project/${selectedProject.id}/build-graph`
      );
      alert("Knowledge graph built successfully!");
      // Refresh project data to show updated stats
      loadProjectDetails(selectedProject.id);
      loadProjects(); // Refresh project stats in dropdown
    } catch (error) {
      console.error("Graph build error:", error);
      alert("Failed to build knowledge graph");
    } finally {
      setIsBuilding(false);
    }
  };

  const handleQuery = async (e) => {
    e.preventDefault();
    if (!selectedProject || !queryForm.question.trim()) {
      alert("Please select a project and enter a question");
      return;
    }

    setIsQuerying(true);
    try {
      const response = await api.post(
        `/api/knowledge-graph/project/${selectedProject.id}/query`,
        {
          question: queryForm.question,
          options: {},
        }
      );

      setQueryResult(response.data.queryResult);
      setQueryForm({ question: "" }); // Clear the input after successful query
    } catch (error) {
      console.error("Query error:", error);
      alert("Failed to process query");
    } finally {
      setIsQuerying(false);
    }
  };

  const loadProjectDetails = async (projectId) => {
    if (!projectId) return;

    try {
      const [graphRes, visualizationRes, documentsRes] = await Promise.all([
        api.get(`/api/knowledge-graph/project/${projectId}/graph`),
        api.get(`/api/knowledge-graph/project/${projectId}/visualization`),
        api.get(`/api/knowledge-graph/project/${projectId}/documents`),
      ]);

      setGraph(graphRes.data.graph);
      setVisualization(visualizationRes.data.visualization);
      setDocuments(documentsRes.data.documents);
    } catch (error) {
      console.error("Error loading project details:", error);
    }
  };

  useEffect(() => {
    if (selectedProject) {
      loadProjectDetails(selectedProject.id);
    }
  }, [selectedProject]);

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return "#34c759";
    if (confidence >= 0.6) return "#ff9500";
    return "#ff3b30";
  };

  return (
    <div className="knowledge-graph">
      <h1>Universal Knowledge-Graph Builder</h1>
      <p>
        Convert a document archive into an interactive knowledge graph with NL
        Q&A.
      </p>

      <div className="projects-section glass-card">
        <h2>Knowledge Graph Projects</h2>

        <form onSubmit={handleCreateProject} className="project-form">
          <div className="form-group">
            <label>Project Name</label>
            <input
              type="text"
              className="form-input"
              value={projectForm.name}
              onChange={(e) =>
                setProjectForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g., AI Research Knowledge Graph"
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              className="form-input"
              value={projectForm.description}
              onChange={(e) =>
                setProjectForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Brief description of your knowledge graph"
              rows="3"
            />
          </div>
          <button type="submit" disabled={isCreating} className="btn">
            {isCreating ? "Creating..." : "Create Project"}
          </button>
        </form>

        {projects.length > 0 && (
          <div className="projects-list">
            <h3>Your Projects</h3>
            <select
              className="project-select"
              value={selectedProject?.id || ""}
              onChange={(e) => {
                const project = projects.find((p) => p.id === e.target.value);
                setSelectedProject(project);
              }}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.graphStats.nodes} nodes)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedProject ? (
        <>
          <div className="project-overview glass-card">
            <h2>Project: {selectedProject.name}</h2>
            <p>{selectedProject.description || "No description provided"}</p>

            <div className="stats-grid">
              <div className="stat-card">
                <h3>Nodes</h3>
                <span>{selectedProject.graphStats?.nodes || 0}</span>
              </div>
              <div className="stat-card">
                <h3>Edges</h3>
                <span>{selectedProject.graphStats?.edges || 0}</span>
              </div>
              <div className="stat-card">
                <h3>Concepts</h3>
                <span>{selectedProject.graphStats?.concepts || 0}</span>
              </div>
            </div>
          </div>

          <div className="content-section glass-card">
            <h2>Add Content</h2>

            <div className="upload-section">
              <h3>Upload Documents</h3>
              <input
                type="file"
                multiple
                accept=".txt,.pdf,.doc,.docx,.md,.html"
                onChange={handleFileUpload}
                className="file-input"
              />
              <p>
                Supported formats: TXT, PDF, DOC, DOCX, MD, HTML (≤ 100 MB
                total)
              </p>
            </div>

            <div className="url-section">
              <h3>Add URL</h3>
              <form onSubmit={handleAddUrl} className="url-form">
                <div className="form-group">
                  <label>URL</label>
                  <input
                    type="url"
                    className="form-input"
                    value={urlForm.url}
                    onChange={(e) =>
                      setUrlForm((prev) => ({ ...prev, url: e.target.value }))
                    }
                    placeholder="https://example.com/article"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Title (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={urlForm.title}
                    onChange={(e) =>
                      setUrlForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="Article title"
                  />
                </div>
                <button type="submit" className="btn btn-secondary">
                  Add URL
                </button>
              </form>
            </div>

            <div className="build-section">
              <h3>Build Knowledge Graph</h3>
              <p>
                Process all uploaded documents and URLs to create the knowledge
                graph.
              </p>
              <button
                onClick={handleBuildGraph}
                disabled={isBuilding || !selectedProject}
                className="btn btn-danger"
              >
                {isBuilding ? "Building..." : "Build Graph"}
              </button>
              {selectedProject && (
                <div className="build-info">
                  <small>
                    Total content: {selectedProject.documents?.length || 0}{" "}
                    items
                  </small>
                </div>
              )}
            </div>
          </div>

          {documents.length > 0 && (
            <div className="documents-section glass-card">
              <h2>Documents ({documents.length})</h2>
              <div className="documents-list">
                {documents.map((doc, index) => (
                  <div key={index} className="document-card">
                    <h4>{doc.name}</h4>
                    <div className="document-info">
                      <span className="type">{doc.type}</span>
                      <span className="size">
                        {(doc.size / 1024).toFixed(1)} KB
                      </span>
                      <span className="concepts">{doc.concepts} concepts</span>
                      <span className={`status ${doc.status}`}>
                        {doc.status}
                      </span>
                    </div>
                    <p>
                      Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {graph && (
            <div className="graph-section glass-card">
              <h2>Knowledge Graph</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Total Nodes</h3>
                  <span>{graph.stats.totalNodes}</span>
                </div>
                <div className="stat-card">
                  <h3>Total Edges</h3>
                  <span>{graph.stats.totalEdges}</span>
                </div>
                <div className="stat-card">
                  <h3>Concepts</h3>
                  <span>{graph.stats.concepts}</span>
                </div>
                <div className="stat-card">
                  <h3>Entities</h3>
                  <span>{graph.stats.entities}</span>
                </div>
              </div>

              <div className="graph-preview">
                <h3>Sample Nodes</h3>
                <div className="documents-list">
                  {graph.nodes.slice(0, 5).map((node, index) => (
                    <div key={index} className="document-card">
                      <h4>{node.label}</h4>
                      <div className="document-info">
                        <span className="type">{node.type}</span>
                        <span className="size">
                          Frequency: {node.properties.frequency}
                        </span>
                        <span className="concepts">
                          Documents: {node.properties.documents.length}
                        </span>
                      </div>
                      <p>{node.properties.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="query-section glass-card">
            <h2>Natural Language Q&A</h2>
            <form onSubmit={handleQuery} className="query-form">
              <div className="form-group">
                <label>Ask a question about your knowledge base</label>
                <input
                  type="text"
                  className="query-input"
                  value={queryForm.question}
                  onChange={(e) =>
                    setQueryForm((prev) => ({
                      ...prev,
                      question: e.target.value,
                    }))
                  }
                  placeholder="e.g., 'What is machine learning?' or 'How do neural networks work?'"
                  required
                />
              </div>
              <button type="submit" disabled={isQuerying} className="btn">
                {isQuerying ? "Processing..." : "Ask Question"}
              </button>
            </form>

            {queryResult && (
              <div className="query-result">
                <h3>Answer</h3>
                <p className="answer">{queryResult.answer}</p>

                <div className="query-meta">
                  <div className="confidence">
                    <span className="confidence-label">Confidence:</span>
                    <span
                      className="confidence-value"
                      style={{
                        color: getConfidenceColor(queryResult.confidence),
                      }}
                    >
                      {(queryResult.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  {queryResult.contextUsed && (
                    <div className="context-info">
                      <span>
                        Used {queryResult.contextUsed} knowledge sources
                      </span>
                    </div>
                  )}
                </div>

                {queryResult.sources && queryResult.sources.length > 0 && (
                  <div className="sources">
                    <h4>Sources</h4>
                    <div className="sources-list">
                      {queryResult.sources.map((source, index) => (
                        <div key={index} className="source-item">
                          <span className="document">{source.document}</span>
                          {source.page && (
                            <span className="page">Page {source.page}</span>
                          )}
                          <span className="relevance">
                            {(source.relevance * 100).toFixed(0)}% relevant
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {queryResult.relatedConcepts &&
                  queryResult.relatedConcepts.length > 0 && (
                    <div className="related-concepts">
                      <h4>Related Concepts</h4>
                      <div className="concepts-list">
                        {queryResult.relatedConcepts.map((concept, index) => (
                          <div key={index} className="concept-item">
                            <span className="concept-name">
                              {concept.label}
                            </span>
                            <span className="relevance">
                              {(concept.relevance * 100).toFixed(0)}% relevant
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {queryResult.error && (
                  <div className="query-error">
                    <p>⚠️ {queryResult.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {visualization && (
            <div className="visualization-section glass-card">
              <h2>Graph Visualization</h2>
              <div className="visualization-controls">
                <select defaultValue="force">
                  <option value="force">Force Layout</option>
                  <option value="hierarchical">Hierarchical</option>
                  <option value="circular">Circular</option>
                </select>
                <div className="graph-stats">
                  <span>{visualization.nodes.length} nodes</span>
                  <span>{visualization.edges.length} edges</span>
                </div>
              </div>

              {visualization.nodes.length > 0 ? (
                <div className="graph-container">
                  <svg width="800" height="600" className="graph-svg">
                    <defs>
                      <marker
                        id="arrowhead"
                        markerWidth="10"
                        markerHeight="7"
                        refX="9"
                        refY="3.5"
                        orient="auto"
                      >
                        <polygon points="0 0, 10 3.5, 0 7" fill="#007aff" />
                      </marker>
                    </defs>

                    {/* Render edges first (behind nodes) */}
                    {visualization.edges.map((edge, index) => {
                      const sourceNode = visualization.nodes.find(
                        (n) => n.id === edge.source
                      );
                      const targetNode = visualization.nodes.find(
                        (n) => n.id === edge.target
                      );
                      if (!sourceNode || !targetNode) return null;

                      return (
                        <g key={`edge-${index}`}>
                          <line
                            x1={sourceNode.x}
                            y1={sourceNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            stroke={edge.color || "#007aff"}
                            strokeWidth={edge.width || 2}
                            markerEnd="url(#arrowhead)"
                          />
                          <text
                            x={(sourceNode.x + targetNode.x) / 2}
                            y={(sourceNode.y + targetNode.y) / 2}
                            textAnchor="middle"
                            fontSize="12"
                            fill="#86868b"
                            className="edge-label"
                          >
                            {edge.label}
                          </text>
                        </g>
                      );
                    })}

                    {/* Render nodes */}
                    {visualization.nodes.map((node, index) => (
                      <g key={`node-${index}`} className="graph-node">
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={node.size}
                          fill={node.color}
                          stroke="#fff"
                          strokeWidth="2"
                          className="node-circle"
                          title={`${node.label} (${node.frequency} occurrences)`}
                        />
                        <text
                          x={node.x}
                          y={node.y + node.size + 15}
                          textAnchor="middle"
                          fontSize="12"
                          fill="#1d1d1f"
                          className="node-label"
                        >
                          {node.label.length > 15
                            ? node.label.substring(0, 15) + "..."
                            : node.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              ) : (
                <div className="no-graph">
                  <p>
                    No graph data available. Build the graph first to see
                    visualization.
                  </p>
                </div>
              )}

              <div className="groups-info">
                <h4>Node Groups</h4>
                {visualization.groups?.map((group, index) => (
                  <div key={index} className="group-item">
                    <span
                      className="group-color"
                      style={{ backgroundColor: group.color }}
                    ></span>
                    <span className="group-name">
                      {group.label} ({group.count || 0})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="no-project-selected">
          <div className="empty-state">
            <h2>Welcome to Knowledge Graph Builder</h2>
            <p>
              Create a project above to start building your interactive
              knowledge graph from documents and URLs.
            </p>
            <div className="features-list">
              <div className="feature-item">
                <span className="feature-icon">📄</span>
                <span>Upload TXT, PDF, HTML, MD files</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🌐</span>
                <span>Add web URLs for content extraction</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🕸️</span>
                <span>Interactive graph visualization</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">💬</span>
                <span>Natural language Q&A</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KnowledgeGraph;
