import React, { useState, useEffect } from "react";
import { api } from "../config/api";
import "./InboxTriage.css";

function InboxTriage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isFetchingEmails, setIsFetchingEmails] = useState(false);
  const [isClustering, setIsClustering] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [emails, setEmails] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [activeTab, setActiveTab] = useState("auth"); // auth, emails, clusters
  const [authMessage, setAuthMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Test API connection on component mount
  useEffect(() => {
    const testApiConnection = async () => {
      try {
        console.log("🧪 Testing Inbox Triage API connection...");
        const response = await api.get("/api/inbox-triage/test");
        console.log(
          "✅ Inbox Triage API connection successful:",
          response.data
        );
      } catch (error) {
        console.error("❌ Inbox Triage API connection failed:", error);
        console.error("API URL:", api.defaults.baseURL);
      }
    };

    testApiConnection();
  }, []);

  const handleAuthentication = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setErrorMessage("Please enter both email and password");
      return;
    }

    setIsAuthenticating(true);
    setErrorMessage("");
    setAuthMessage("");

    try {
      const response = await api.post("/api/inbox-triage/authenticate", {
        email,
        password,
      });

      if (response.data.success) {
        setIsAuthenticated(true);
        setAuthMessage(response.data.message);
        setActiveTab("emails");
      } else {
        setErrorMessage("Authentication failed");
      }
    } catch (error) {
      console.error("Authentication error:", error);
      setErrorMessage(
        error.response?.data?.details ||
          error.response?.data?.error ||
          "Authentication failed"
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleFetchEmails = async () => {
    if (!email) {
      setErrorMessage("Please enter an email address");
      return;
    }

    setIsFetchingEmails(true);
    setErrorMessage("");

    try {
      const response = await api.post("/api/inbox-triage/fetch-emails", {
        email,
      });

      if (response.data.success) {
        setEmails(response.data.emails);
        setActiveTab("emails");
      } else {
        setErrorMessage("Failed to fetch emails");
      }
    } catch (error) {
      console.error("Email fetching error:", error);
      setErrorMessage(
        error.response?.data?.details ||
          error.response?.data?.error ||
          "Failed to fetch emails"
      );
    } finally {
      setIsFetchingEmails(false);
    }
  };

  const handleClusterEmails = async () => {
    if (emails.length === 0) {
      setErrorMessage("No emails to cluster");
      return;
    }

    setIsClustering(true);
    setErrorMessage("");

    try {
      const response = await api.post("/api/inbox-triage/cluster-emails", {
        emails,
      });

      if (response.data.success) {
        setClusters(response.data.clusters);
        setActiveTab("clusters");
      } else {
        setErrorMessage("Failed to cluster emails");
      }
    } catch (error) {
      console.error("Email clustering error:", error);
      setErrorMessage(
        error.response?.data?.details ||
          error.response?.data?.error ||
          "Failed to cluster emails"
      );
    } finally {
      setIsClustering(false);
    }
  };

  const handleArchiveCluster = async (clusterId) => {
    setIsArchiving(true);
    setErrorMessage("");

    try {
      const response = await api.post(
        `/api/inbox-triage/archive-cluster/${clusterId}`
      );

      if (response.data.success) {
        // Update the cluster status in the local state
        setClusters((prevClusters) =>
          prevClusters.map((cluster) =>
            cluster.id === clusterId
              ? {
                  ...cluster,
                  archived: true,
                  archivedAt: new Date().toISOString(),
                }
              : cluster
          )
        );

        alert(
          `Successfully archived ${response.data.archivedEmails.length} emails from cluster "${response.data.clusterName}"`
        );
      } else {
        setErrorMessage("Failed to archive cluster");
      }
    } catch (error) {
      console.error("Archive error:", error);
      setErrorMessage(
        error.response?.data?.details ||
          error.response?.data?.error ||
          "Failed to archive cluster"
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "#ff3b30";
      case "medium":
        return "#ff9500";
      case "low":
        return "#34c759";
      default:
        return "#8e8e93";
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case "high":
        return "🔴";
      case "medium":
        return "🟡";
      case "low":
        return "🟢";
      default:
        return "⚪";
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const loadClusters = async () => {
    try {
      const response = await api.get("/api/inbox-triage/clusters");
      setClusters(response.data.clusters);
    } catch (error) {
      console.error("Error loading clusters:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "clusters") {
      loadClusters();
    }
  }, [activeTab]);

  return (
    <div className="inbox-triage project-component">
      <h1>Inbox Triage Assistant</h1>
      <p>
        Cluster your last 200 emails into actionable groups and archive them
        with one click. Get your inbox organized with AI-powered email
        management.
      </p>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === "auth" ? "active" : ""}`}
          onClick={() => setActiveTab("auth")}
        >
          🔐 Authentication
        </button>
        <button
          className={`tab-button ${activeTab === "emails" ? "active" : ""}`}
          onClick={() => setActiveTab("emails")}
          disabled={!isAuthenticated}
        >
          📧 Emails ({emails.length})
        </button>
        <button
          className={`tab-button ${activeTab === "clusters" ? "active" : ""}`}
          onClick={() => setActiveTab("clusters")}
          disabled={clusters.length === 0}
        >
          📊 Clusters ({clusters.length})
        </button>
      </div>

      {activeTab === "auth" && (
        <div className="section auth-section">
          <h2>Gmail Authentication</h2>

          {authMessage && (
            <div className="success-message">
              <span className="success-icon">✅</span>
              {authMessage}
            </div>
          )}

          {errorMessage && (
            <div className="error-message">
              <span className="error-icon">❌</span>
              {errorMessage}
            </div>
          )}

          <div className="auth-form">
            <form onSubmit={handleAuthentication}>
              <div className="form-group">
                <label htmlFor="email">Gmail Address:</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@gmail.com"
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password:</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="form-input"
                />
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className={`auth-btn ${isAuthenticating ? "loading" : ""}`}
              >
                {isAuthenticating ? "Authenticating..." : "Connect to Gmail"}
              </button>
            </form>
          </div>

          <div className="auth-info">
            <h3>How it works:</h3>
            <ul>
              <li>🔐 Securely authenticate with your Gmail account</li>
              <li>📧 Fetch your last 200 emails for analysis</li>
              <li>🤖 AI clusters emails into actionable groups</li>
              <li>📁 One-click archive entire clusters</li>
              <li>⚡ Save hours of manual email organization</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === "emails" && (
        <div className="section emails-section">
          <h2>Email Management</h2>

          {errorMessage && (
            <div className="error-message">
              <span className="error-icon">❌</span>
              {errorMessage}
            </div>
          )}

          <div className="email-actions">
            <button
              onClick={handleFetchEmails}
              disabled={isFetchingEmails}
              className={`fetch-btn ${isFetchingEmails ? "loading" : ""}`}
            >
              {isFetchingEmails ? "Fetching..." : "Fetch Last 200 Emails"}
            </button>

            {emails.length > 0 && (
              <button
                onClick={handleClusterEmails}
                disabled={isClustering}
                className={`cluster-btn ${isClustering ? "loading" : ""}`}
              >
                {isClustering
                  ? "Clustering..."
                  : `Cluster ${emails.length} Emails`}
              </button>
            )}
          </div>

          {emails.length > 0 && (
            <div className="emails-list">
              <h3>Fetched Emails ({emails.length})</h3>
              <div className="emails-grid">
                {emails.map((email) => (
                  <div key={email.id} className="email-card">
                    <div className="email-header">
                      <div className="email-priority">
                        <span
                          className="priority-indicator"
                          style={{
                            backgroundColor:
                              getPriorityColor(email.priority) + "20",
                          }}
                        >
                          {getPriorityIcon(email.priority)} {email.priority}
                        </span>
                      </div>
                      <div className="email-category">
                        <span className="category-tag">{email.category}</span>
                      </div>
                    </div>

                    <div className="email-content">
                      <h4 className="email-subject">{email.subject}</h4>
                      <p className="email-sender">From: {email.sender}</p>
                      <p className="email-date">{formatDate(email.date)}</p>
                      <p className="email-body">{email.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "clusters" && (
        <div className="section clusters-section">
          <h2>Email Clusters</h2>

          {errorMessage && (
            <div className="error-message">
              <span className="error-icon">❌</span>
              {errorMessage}
            </div>
          )}

          {clusters.length === 0 ? (
            <div className="no-clusters-message">
              <div className="no-clusters-icon">📊</div>
              <h3>No clusters yet</h3>
              <p>
                Fetch emails and run clustering to see your organized inbox
                groups.
              </p>
            </div>
          ) : (
            <div className="clusters-grid">
              {clusters.map((cluster) => (
                <div
                  key={cluster.id}
                  className={`cluster-card ${
                    cluster.archived ? "archived" : ""
                  }`}
                >
                  <div className="cluster-header">
                    <div className="cluster-title">
                      <h3>{cluster.name}</h3>
                      <span className="cluster-count">
                        {cluster.count} emails
                      </span>
                    </div>
                    <div className="cluster-priority">
                      <span
                        className="priority-indicator"
                        style={{
                          backgroundColor:
                            getPriorityColor(cluster.priority) + "20",
                        }}
                      >
                        {getPriorityIcon(cluster.priority)} {cluster.priority}
                      </span>
                    </div>
                  </div>

                  <div className="cluster-content">
                    <p className="cluster-description">{cluster.description}</p>
                    <div className="cluster-action">
                      <strong>Recommended Action:</strong> {cluster.action}
                    </div>
                  </div>

                  <div className="cluster-emails">
                    <h4>Emails in this cluster:</h4>
                    <div className="cluster-email-list">
                      {cluster.emails.slice(0, 3).map((email) => (
                        <div key={email.id} className="cluster-email-item">
                          <span className="email-subject">{email.subject}</span>
                          <span className="email-sender">{email.sender}</span>
                        </div>
                      ))}
                      {cluster.emails.length > 3 && (
                        <div className="more-emails">
                          +{cluster.emails.length - 3} more emails
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="cluster-footer">
                    {cluster.archived ? (
                      <div className="archived-status">
                        <span className="archived-icon">✅</span>
                        Archived on {formatDate(cluster.archivedAt)}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleArchiveCluster(cluster.id)}
                        disabled={isArchiving}
                        className={`archive-btn ${
                          isArchiving ? "loading" : ""
                        }`}
                      >
                        {isArchiving
                          ? "Archiving..."
                          : `Archive ${cluster.count} Emails`}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default InboxTriage;
