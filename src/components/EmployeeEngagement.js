import React, { useState, useEffect } from "react";
import axios from "axios";
import "./EmployeeEngagement.css";

function EmployeeEngagement() {
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [sentimentData, setSentimentData] = useState(null);
  const [trends, setTrends] = useState(null);
  const [insights, setInsights] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  // Slack connection form state
  const [slackForm, setSlackForm] = useState({
    workspaceName: "",
    botToken: "",
    channels: "",
  });

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const response = await axios.get("/api/employee-engagement/workspaces");
      setWorkspaces(response.data.workspaces);
      if (response.data.workspaces.length > 0) {
        setSelectedWorkspace(response.data.workspaces[0]);
      }
    } catch (error) {
      console.error("Error loading workspaces:", error);
    }
  };

  const handleSlackConnect = async (e) => {
    e.preventDefault();
    if (
      !slackForm.workspaceName ||
      !slackForm.botToken ||
      !slackForm.channels
    ) {
      alert("Please fill in all fields");
      return;
    }

    setIsConnecting(true);
    try {
      const channels = slackForm.channels.split(",").map((ch) => ch.trim());
      const response = await axios.post(
        "/api/employee-engagement/connect-slack",
        {
          workspaceName: slackForm.workspaceName,
          botToken: slackForm.botToken,
          channels: channels,
        }
      );

      setWorkspaces((prev) => [...prev, response.data.workspace]);
      setSelectedWorkspace(response.data.workspace);
      setSlackForm({ workspaceName: "", botToken: "", channels: "" });
      alert("Slack workspace connected successfully!");
    } catch (error) {
      console.error("Connection error:", error);
      alert("Failed to connect Slack workspace");
    } finally {
      setIsConnecting(false);
    }
  };

  const loadDashboard = async (workspaceId) => {
    if (!workspaceId) return;

    try {
      const response = await axios.get(
        `/api/employee-engagement/dashboard/${workspaceId}`
      );
      setDashboard(response.data.dashboard);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    }
  };

  const loadSentimentData = async (workspaceId) => {
    if (!workspaceId) return;

    try {
      const response = await axios.get(
        `/api/employee-engagement/sentiment/${workspaceId}`
      );
      setSentimentData(response.data.sentimentData);
    } catch (error) {
      console.error("Error loading sentiment data:", error);
    }
  };

  const loadTrends = async (workspaceId) => {
    if (!workspaceId) return;

    try {
      const response = await axios.get(
        `/api/employee-engagement/trends/${workspaceId}`
      );
      setTrends(response.data.trends);
    } catch (error) {
      console.error("Error loading trends:", error);
    }
  };

  const generateInsights = async (workspaceId) => {
    if (!workspaceId) return;

    setIsGeneratingInsights(true);
    try {
      const response = await axios.post(
        `/api/employee-engagement/insights/${workspaceId}`,
        {
          timeframe: "weekly",
        }
      );
      setInsights(response.data.insights);
    } catch (error) {
      console.error("Error generating insights:", error);
      alert("Failed to generate insights");
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const loadAlerts = async (workspaceId) => {
    if (!workspaceId) return;

    try {
      const response = await axios.get(
        `/api/employee-engagement/alerts/${workspaceId}`
      );
      setAlerts(response.data.alerts);
    } catch (error) {
      console.error("Error loading alerts:", error);
    }
  };

  useEffect(() => {
    if (selectedWorkspace) {
      loadDashboard(selectedWorkspace.id);
      loadSentimentData(selectedWorkspace.id);
      loadTrends(selectedWorkspace.id);
      loadAlerts(selectedWorkspace.id);
    }
  }, [selectedWorkspace]);

  const getSentimentColor = (sentiment) => {
    if (sentiment >= 0.7) return "#4CAF50";
    if (sentiment >= 0.5) return "#FF9800";
    return "#F44336";
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "high":
        return "#F44336";
      case "medium":
        return "#FF9800";
      case "low":
        return "#4CAF50";
      default:
        return "#757575";
    }
  };

  return (
    <div className="employee-engagement">
      <h1>Employee Engagement Pulse</h1>
      <p>
        Provide managers with a weekly sentiment dashboard built from all
        messages in configurable Slack channels.
      </p>

      <div className="workspace-section">
        <h2>Slack Workspaces</h2>

        {workspaces.length === 0 ? (
          <div className="connect-slack">
            <h3>Connect Your First Slack Workspace</h3>
            <form onSubmit={handleSlackConnect} className="slack-form">
              <div className="form-group">
                <label>Workspace Name:</label>
                <input
                  type="text"
                  value={slackForm.workspaceName}
                  onChange={(e) =>
                    setSlackForm((prev) => ({
                      ...prev,
                      workspaceName: e.target.value,
                    }))
                  }
                  placeholder="e.g., Acme Corp"
                  required
                />
              </div>
              <div className="form-group">
                <label>Bot Token:</label>
                <input
                  type="password"
                  value={slackForm.botToken}
                  onChange={(e) =>
                    setSlackForm((prev) => ({
                      ...prev,
                      botToken: e.target.value,
                    }))
                  }
                  placeholder="xoxb-your-bot-token"
                  required
                />
              </div>
              <div className="form-group">
                <label>Channels (comma-separated):</label>
                <input
                  type="text"
                  value={slackForm.channels}
                  onChange={(e) =>
                    setSlackForm((prev) => ({
                      ...prev,
                      channels: e.target.value,
                    }))
                  }
                  placeholder="general, random, engineering"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isConnecting}
                className="connect-btn"
              >
                {isConnecting ? "Connecting..." : "Connect Workspace"}
              </button>
            </form>
          </div>
        ) : (
          <div className="workspace-selector">
            <select
              value={selectedWorkspace?.id || ""}
              onChange={(e) => {
                const workspace = workspaces.find(
                  (w) => w.id === e.target.value
                );
                setSelectedWorkspace(workspace);
              }}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedWorkspace && (
        <div className="workspace-content">
          <div className="dashboard-section">
            <h2>Weekly Sentiment Dashboard</h2>
            {dashboard && (
              <div className="dashboard-grid">
                <div className="metric-card">
                  <h3>Overall Sentiment</h3>
                  <div
                    className="metric-value"
                    style={{
                      color: getSentimentColor(dashboard.overallSentiment),
                    }}
                  >
                    {(dashboard.overallSentiment * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Message Count</h3>
                  <div className="metric-value">
                    {dashboard.messageCount.toLocaleString()}
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Active Users</h3>
                  <div className="metric-value">{dashboard.activeUsers}</div>
                </div>
              </div>
            )}

            {dashboard && (
              <div className="trends-chart">
                <h3>Daily Sentiment Trends</h3>
                <div className="trends-grid">
                  {Object.entries(dashboard.trends).map(([day, sentiment]) => (
                    <div key={day} className="trend-item">
                      <div className="day">{day}</div>
                      <div className="sentiment-bar">
                        <div
                          className="sentiment-fill"
                          style={{
                            width: `${sentiment * 100}%`,
                            backgroundColor: getSentimentColor(sentiment),
                          }}
                        ></div>
                      </div>
                      <div className="sentiment-value">
                        {(sentiment * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dashboard && (
              <div className="top-channels">
                <h3>Top Channels by Sentiment</h3>
                <div className="channels-list">
                  {dashboard.topChannels.map((channel, index) => (
                    <div key={index} className="channel-item">
                      <div className="channel-name">#{channel.name}</div>
                      <div className="channel-stats">
                        <span
                          className="sentiment"
                          style={{
                            color: getSentimentColor(channel.sentiment),
                          }}
                        >
                          {(channel.sentiment * 100).toFixed(1)}%
                        </span>
                        <span className="messages">
                          {channel.messageCount} messages
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="insights-section">
            <h2>Manager Insights</h2>
            <button
              onClick={() => generateInsights(selectedWorkspace.id)}
              disabled={isGeneratingInsights}
              className="generate-insights-btn"
            >
              {isGeneratingInsights ? "Generating..." : "Generate Insights"}
            </button>

            {insights && (
              <div className="insights-content">
                <div className="metrics-overview">
                  <h3>Team Metrics</h3>
                  <div className="metrics-grid">
                    <div className="metric">
                      <span className="label">Team Happiness:</span>
                      <span
                        className="value"
                        style={{
                          color: getSentimentColor(
                            insights.metrics.teamHappiness
                          ),
                        }}
                      >
                        {(insights.metrics.teamHappiness * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="metric">
                      <span className="label">Engagement Rate:</span>
                      <span
                        className="value"
                        style={{
                          color: getSentimentColor(
                            insights.metrics.engagementRate
                          ),
                        }}
                      >
                        {(insights.metrics.engagementRate * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="metric">
                      <span className="label">Stress Level:</span>
                      <span
                        className="value"
                        style={{
                          color: getSentimentColor(
                            1 - insights.metrics.stressLevel
                          ),
                        }}
                      >
                        {(insights.metrics.stressLevel * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="recommendations">
                  <h3>Actionable Recommendations</h3>
                  {insights.recommendations.map((rec, index) => (
                    <div key={index} className="recommendation-card">
                      <div className="rec-header">
                        <h4>{rec.title}</h4>
                        <span
                          className="priority"
                          style={{
                            backgroundColor: getSeverityColor(rec.priority),
                          }}
                        >
                          {rec.priority}
                        </span>
                      </div>
                      <p>{rec.description}</p>
                      <div className="action-items">
                        <strong>Action Items:</strong>
                        <ul>
                          {rec.actionItems.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="alerts-section">
            <h2>Active Alerts</h2>
            {alerts.length > 0 ? (
              <div className="alerts-list">
                {alerts.map((alert) => (
                  <div key={alert.id} className="alert-card">
                    <div className="alert-header">
                      <span
                        className="severity"
                        style={{
                          backgroundColor: getSeverityColor(alert.severity),
                        }}
                      >
                        {alert.severity}
                      </span>
                      <span className="type">{alert.type}</span>
                      <span className="timestamp">
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="alert-message">{alert.message}</p>
                    {alert.username && (
                      <p className="alert-user">User: {alert.username}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p>No active alerts at this time.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EmployeeEngagement;
