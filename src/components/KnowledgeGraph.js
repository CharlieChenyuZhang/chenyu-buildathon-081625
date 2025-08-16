import React, { useState, useEffect } from "react";
import axios from "axios";
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
      const response = await axios.get("/api/knowledge-graph/projects");
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
      const response = await axios.post(
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
      const response = await axios.post(
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
    }
  };

  const handleAddUrl = async (e) => {
    e.preventDefault();
    if (!urlForm.url.trim()) {
      alert("Please enter a URL");
      return;
    }

    try {
      const response = await axios.post(
        `/api/knowledge-graph/project/${selectedProject.id}/add-url`,
        urlForm
      );
      setUrlForm({ url: "", title: "" });
      alert("URL added successfully!");
    } catch (error) {
      console.error("URL addition error:", error);
      alert("Failed to add URL");
    }
  };

  const handleBuildGraph = async () => {
    if (!selectedProject) return;

    setIsBuilding(true);
    try {
      const response = await axios.post(
        `/api/knowledge-graph/project/${selectedProject.id}/build-graph`
      );
      alert("Knowledge graph build started! This may take a few minutes.");
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
      const response = await axios.post(
        `/api/knowledge-graph/project/${selectedProject.id}/query`,
        {
          question: queryForm.question,
          options: {},
        }
      );

      setQueryResult(response.data.queryResult);
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
        axios.get(`/api/knowledge-graph/project/${projectId}/graph`),
        axios.get(`/api/knowledge-graph/project/${projectId}/visualization`),
        axios.get(`/api/knowledge-graph/project/${projectId}/documents`),
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
    if (confidence >= 0.8) return "#4CAF50";
    if (confidence >= 0.6) return "#FF9800";
    return "#F44336";
  };

  return (
    <div className="knowledge-graph">
      <h1>Universal Knowledge-Graph Builder</h1>
      <p>
        Convert a document archive into an interactive knowledge graph with NL
        Q&A.
      </p>

      <div className="projects-section">
        <h2>Knowledge Graph Projects</h2>

        <form onSubmit={handleCreateProject} className="project-form">
          <div className="form-group">
            <label>Project Name:</label>
            <input
              type="text"
              value={projectForm.name}
              onChange={(e) =>
                setProjectForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g., AI Research Knowledge Graph"
              required
            />
          </div>
          <div className="form-group">
            <label>Description:</label>
            <textarea
              value={projectForm.description}
              onChange={(e) =>
                setProjectForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Brief description of your knowledge graph"
            />
          </div>
          <button type="submit" disabled={isCreating} className="create-btn">
            {isCreating ? "Creating..." : "Create Project"}
          </button>
        </form>

        {projects.length > 0 && (
          <div className="projects-list">
            <h3>Your Projects</h3>
            <select
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

      {selectedProject && (
        <>
          <div className="project-overview">
            <h2>Project: {selectedProject.name}</h2>
            <p>{selectedProject.description}</p>

            <div className="stats-grid">
              <div className="stat-card">
                <h3>Nodes</h3>
                <span>{selectedProject.graphStats.nodes}</span>
              </div>
              <div className="stat-card">
                <h3>Edges</h3>
                <span>{selectedProject.graphStats.edges}</span>
              </div>
              <div className="stat-card">
                <h3>Concepts</h3>
                <span>{selectedProject.graphStats.concepts}</span>
              </div>
            </div>
          </div>

          <div className="content-section">
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
                  <label>URL:</label>
                  <input
                    type="url"
                    value={urlForm.url}
                    onChange={(e) =>
                      setUrlForm((prev) => ({ ...prev, url: e.target.value }))
                    }
                    placeholder="https://example.com/article"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Title (optional):</label>
                  <input
                    type="text"
                    value={urlForm.title}
                    onChange={(e) =>
                      setUrlForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="Article title"
                  />
                </div>
                <button type="submit" className="add-url-btn">
                  Add URL
                </button>
              </form>
            </div>

            <div className="build-section">
              <h3>Build Knowledge Graph</h3>
              <button
                onClick={handleBuildGraph}
                disabled={isBuilding}
                className="build-btn"
              >
                {isBuilding ? "Building..." : "Build Graph"}
              </button>
            </div>
          </div>

          {documents.length > 0 && (
            <div className="documents-section">
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
            <div className="graph-section">
              <h2>Knowledge Graph</h2>
              <div className="graph-stats">
                <p>
                  <strong>Total Nodes:</strong> {graph.stats.totalNodes}
                </p>
                <p>
                  <strong>Total Edges:</strong> {graph.stats.totalEdges}
                </p>
                <p>
                  <strong>Concepts:</strong> {graph.stats.concepts}
                </p>
                <p>
                  <strong>Entities:</strong> {graph.stats.entities}
                </p>
              </div>

              <div className="graph-preview">
                <h3>Sample Nodes</h3>
                <div className="nodes-list">
                  {graph.nodes.slice(0, 5).map((node, index) => (
                    <div key={index} className="node-item">
                      <h4>{node.label}</h4>
                      <p className="type">{node.type}</p>
                      <p className="description">
                        {node.properties.description}
                      </p>
                      <div className="node-stats">
                        <span>Frequency: {node.properties.frequency}</span>
                        <span>
                          Documents: {node.properties.documents.length}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="query-section">
            <h2>Natural Language Q&A</h2>
            <form onSubmit={handleQuery} className="query-form">
              <div className="form-group">
                <label>Ask a question about your knowledge base:</label>
                <input
                  type="text"
                  value={queryForm.question}
                  onChange={(e) =>
                    setQueryForm((prev) => ({
                      ...prev,
                      question: e.target.value,
                    }))
                  }
                  placeholder="e.g., 'What is machine learning?' or 'How do neural networks work?'"
                  className="query-input"
                  required
                />
              </div>
              <button type="submit" disabled={isQuerying} className="query-btn">
                {isQuerying ? "Processing..." : "Ask Question"}
              </button>
            </form>

            {queryResult && (
              <div className="query-result">
                <h3>Answer</h3>
                <p className="answer">{queryResult.answer}</p>

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

                <div className="sources">
                  <h4>Sources</h4>
                  <div className="sources-list">
                    {queryResult.sources?.map((source, index) => (
                      <div key={index} className="source-item">
                        <span className="document">{source.document}</span>
                        <span className="page">Page {source.page}</span>
                        <span className="relevance">
                          {(source.relevance * 100).toFixed(0)}% relevant
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="related-concepts">
                  <h4>Related Concepts</h4>
                  <div className="concepts-list">
                    {queryResult.relatedConcepts?.map((concept, index) => (
                      <div key={index} className="concept-item">
                        <span className="concept-name">{concept.label}</span>
                        <span className="relevance">
                          {(concept.relevance * 100).toFixed(0)}% relevant
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {visualization && (
            <div className="visualization-section">
              <h2>Graph Visualization</h2>
              <div className="visualization-controls">
                <select defaultValue="force">
                  <option value="force">Force Layout</option>
                  <option value="hierarchical">Hierarchical</option>
                  <option value="circular">Circular</option>
                </select>
              </div>

              <div className="visualization-preview">
                <p>
                  Graph visualization would be rendered here with{" "}
                  {visualization.nodes.length} nodes and{" "}
                  {visualization.edges.length} edges.
                </p>
                <div className="groups-info">
                  <h4>Node Groups</h4>
                  {visualization.groups?.map((group, index) => (
                    <div key={index} className="group-item">
                      <span
                        className="group-color"
                        style={{ backgroundColor: group.color }}
                      ></span>
                      <span className="group-name">{group.label}</span>
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

export default KnowledgeGraph;
