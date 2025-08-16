import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Pie, Doughnut, Radar } from "react-chartjs-2";
import "./EmployeeEngagement.css";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

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
  const [activeTab, setActiveTab] = useState("overview");

  // Slack connection form state
  const [slackForm, setSlackForm] = useState({
    workspaceName: "AI Fund Buildathon", // Pre-filled with a meaningful name
    channels: "aifund-buildathon-081625", // Pre-populated with the specific channel
  });

  const [isFetchingMessages, setIsFetchingMessages] = useState(false);
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [maxRetries] = useState(3);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isLoadingSentiment, setIsLoadingSentiment] = useState(false);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Auto-reconnect logic
  const autoReconnect = async () => {
    if (connectionRetries >= maxRetries) {
      alert(
        "Failed to reconnect after multiple attempts. Please reconnect manually."
      );
      return false;
    }

    try {
      console.log(
        `Attempting to reconnect (attempt ${
          connectionRetries + 1
        }/${maxRetries})`
      );
      const response = await axios.get("/api/employee-engagement/workspaces");

      if (response.data.workspaces.length === 0) {
        // No workspaces found, try to reconnect with stored credentials
        const storedCredentials = localStorage.getItem(
          "slackWorkspaceCredentials"
        );
        if (storedCredentials) {
          const credentials = JSON.parse(storedCredentials);
          const channels = credentials.channels
            .split(",")
            .map((ch) => ch.trim());

          const reconnectResponse = await axios.post(
            "/api/employee-engagement/connect-slack",
            {
              workspaceName: credentials.workspaceName,
              channels: channels,
            }
          );

          setWorkspaces([reconnectResponse.data.workspace]);
          setSelectedWorkspace(reconnectResponse.data.workspace);
          setConnectionRetries(0);
          console.log("Successfully auto-reconnected to workspace");
          return true;
        }
      } else {
        // Workspace exists, just select it
        setWorkspaces(response.data.workspaces);
        setSelectedWorkspace(response.data.workspaces[0]);
        setConnectionRetries(0);
        return true;
      }
    } catch (error) {
      console.error("Auto-reconnect failed:", error);
      setConnectionRetries((prev) => prev + 1);
    }

    return false;
  };

  // Store credentials for auto-reconnect
  const storeCredentials = (workspaceName, channels) => {
    localStorage.setItem(
      "slackWorkspaceCredentials",
      JSON.stringify({
        workspaceName,
        channels,
      })
    );
  };

  useEffect(() => {
    const initializeWorkspace = async () => {
      try {
        await loadWorkspaces();

        // If no workspaces found, try to auto-reconnect
        if (workspaces.length === 0) {
          const storedCredentials = localStorage.getItem(
            "slackWorkspaceCredentials"
          );
          if (storedCredentials) {
            console.log("No workspaces found, attempting auto-reconnect...");
            await autoReconnect();
          }
        }
      } catch (error) {
        console.error("Error initializing workspace:", error);
      }
    };

    initializeWorkspace();
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
    if (!slackForm.workspaceName) {
      alert("Please enter a workspace name");
      return;
    }

    setIsConnecting(true);
    try {
      const channels = slackForm.channels.split(",").map((ch) => ch.trim());
      const response = await axios.post(
        "/api/employee-engagement/connect-slack",
        {
          workspaceName: slackForm.workspaceName,
          channels: channels,
        }
      );

      setWorkspaces((prev) => [...prev, response.data.workspace]);
      setSelectedWorkspace(response.data.workspace);

      // Store credentials for auto-reconnect
      storeCredentials(slackForm.workspaceName, slackForm.channels);

      setSlackForm({
        workspaceName: "AI Fund Buildathon",
        channels: "aifund-buildathon-081625",
      });
      alert("Slack workspace connected successfully!");
    } catch (error) {
      console.error("Connection error:", error);
      alert("Failed to connect Slack workspace");
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchMessages = async (workspaceId) => {
    if (!workspaceId) return;

    setIsFetchingMessages(true);
    let retryCount = 0;
    const maxRetries = 2;

    const attemptFetch = async () => {
      try {
        const workspace = workspaces.find((w) => w.id === workspaceId);
        const response = await axios.post(
          `/api/employee-engagement/fetch-messages/${workspaceId}`,
          {
            channels: workspace.channels,
            limit: 200, // Fetch up to 200 messages
          }
        );

        alert(
          `Successfully fetched ${
            response.data.messageCount
          } messages from ${response.data.channels.join(", ")}`
        );

        // Reload dashboard data with new messages
        loadDashboard(workspaceId);
        loadSentimentData(workspaceId);
        loadTrends(workspaceId);
        return true;
      } catch (error) {
        console.error(
          `Error fetching messages (attempt ${retryCount + 1}):`,
          error
        );

        if (error.response && error.response.status === 404) {
          // Workspace not found, try to reconnect
          console.log("Workspace not found, attempting to reconnect...");
          const reconnected = await autoReconnect();
          if (reconnected && retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying fetch messages (attempt ${retryCount + 1})`);
            return await attemptFetch();
          }
        }

        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying fetch messages (attempt ${retryCount + 1})`);
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
          return await attemptFetch();
        }

        alert("Failed to fetch messages from Slack after multiple attempts");
        return false;
      }
    };

    await attemptFetch();
    setIsFetchingMessages(false);
  };

  const loadDashboard = async (workspaceId) => {
    if (!workspaceId) return;

    setIsLoadingDashboard(true);
    try {
      const response = await axios.get(
        `/api/employee-engagement/dashboard/${workspaceId}`
      );
      setDashboard(response.data.dashboard);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  const loadSentimentData = async (workspaceId) => {
    if (!workspaceId) return;

    setIsLoadingSentiment(true);
    try {
      const response = await axios.get(
        `/api/employee-engagement/sentiment/${workspaceId}`
      );
      setSentimentData(response.data.sentimentData);
    } catch (error) {
      console.error("Error loading sentiment data:", error);
    } finally {
      setIsLoadingSentiment(false);
    }
  };

  const loadTrends = async (workspaceId) => {
    if (!workspaceId) return;

    setIsLoadingTrends(true);
    try {
      const response = await axios.get(
        `/api/employee-engagement/trends/${workspaceId}`
      );
      setTrends(response.data.trends);
    } catch (error) {
      console.error("Error loading trends:", error);
    } finally {
      setIsLoadingTrends(false);
    }
  };

  const generateInsights = async (workspaceId) => {
    if (!workspaceId) return;

    setIsGeneratingInsights(true);
    setIsLoadingInsights(true);
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
      setIsLoadingInsights(false);
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

  // Chart configurations
  const getSentimentDistributionData = () => {
    // Use real data if available, otherwise use mock data for demonstration
    const data = sentimentData || {
      positive: 45,
      neutral: 35,
      negative: 20,
    };

    return {
      labels: ["Positive", "Neutral", "Negative"],
      datasets: [
        {
          data: [data.positive || 45, data.neutral || 35, data.negative || 20],
          backgroundColor: ["#4CAF50", "#FF9800", "#F44336"],
          borderColor: ["#45a049", "#e68900", "#d32f2f"],
          borderWidth: 2,
        },
      ],
    };
  };

  const getWeeklyTrendsData = () => {
    // Use real data if available, otherwise use mock data for demonstration
    const data = trends || {
      Monday: 0.75,
      Tuesday: 0.68,
      Wednesday: 0.82,
      Thursday: 0.71,
      Friday: 0.89,
      Saturday: 0.65,
      Sunday: 0.58,
    };

    const days = Object.keys(data);
    const sentimentValues = Object.values(data);

    return {
      labels: days,
      datasets: [
        {
          label: "Sentiment Score",
          data: sentimentValues.map((v) => v * 100),
          borderColor: "#007bff",
          backgroundColor: "rgba(0, 123, 255, 0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
    };
  };

  const getChannelComparisonData = () => {
    // Use real data if available, otherwise use mock data for demonstration
    const channels = dashboard?.topChannels || [
      {
        name: "general",
        sentiment: 0.75,
        messageCount: 1250,
        threadCount: 45,
        threadReplyCount: 180,
      },
      {
        name: "engineering",
        sentiment: 0.68,
        messageCount: 890,
        threadCount: 32,
        threadReplyCount: 120,
      },
      {
        name: "random",
        sentiment: 0.82,
        messageCount: 650,
        threadCount: 28,
        threadReplyCount: 95,
      },
      {
        name: "marketing",
        sentiment: 0.71,
        messageCount: 420,
        threadCount: 15,
        threadReplyCount: 60,
      },
      {
        name: "design",
        sentiment: 0.89,
        messageCount: 380,
        threadCount: 12,
        threadReplyCount: 45,
      },
    ];

    return {
      labels: channels.map((ch) => ch.name),
      datasets: [
        {
          label: "Total Messages",
          data: channels.map(
            (ch) => ch.messageCount + (ch.threadReplyCount || 0)
          ),
          backgroundColor: "rgba(0, 123, 255, 0.7)",
          borderColor: "#007bff",
          borderWidth: 1,
          yAxisID: "y",
        },
        {
          label: "Main Messages",
          data: channels.map((ch) => ch.messageCount),
          backgroundColor: "rgba(40, 167, 69, 0.7)",
          borderColor: "#28a745",
          borderWidth: 1,
          yAxisID: "y",
        },
        {
          label: "Thread Replies",
          data: channels.map((ch) => ch.threadReplyCount || 0),
          backgroundColor: "rgba(255, 193, 7, 0.7)",
          borderColor: "#ffc107",
          borderWidth: 1,
          yAxisID: "y",
        },
      ],
    };
  };

  const getEmojiSentimentData = () => {
    // Mock data for emoji sentiment analysis
    const emojiData = {
      "😊": 85,
      "👍": 80,
      "🎉": 90,
      "😔": 25,
      "😤": 30,
      "💪": 75,
      "🔥": 85,
      "😴": 40,
    };

    return {
      labels: Object.keys(emojiData),
      datasets: [
        {
          label: "Sentiment Score",
          data: Object.values(emojiData),
          backgroundColor: Object.values(emojiData).map((v) =>
            v >= 70 ? "#4CAF50" : v >= 50 ? "#FF9800" : "#F44336"
          ),
          borderColor: Object.values(emojiData).map((v) =>
            v >= 70 ? "#45a049" : v >= 50 ? "#e68900" : "#d32f2f"
          ),
          borderWidth: 1,
        },
      ],
    };
  };

  const getTeamEngagementRadarData = () => {
    // Use real data if available, otherwise use mock data for demonstration
    const metrics = insights?.metrics || {
      teamHappiness: 0.75,
      engagementRate: 0.68,
      stressLevel: 0.25,
    };

    return {
      labels: [
        "Team Happiness",
        "Engagement Rate",
        "Collaboration",
        "Innovation",
        "Stress Level",
        "Work-Life Balance",
      ],
      datasets: [
        {
          label: "Current Week",
          data: [
            metrics.teamHappiness * 100,
            metrics.engagementRate * 100,
            75, // Mock collaboration score
            68, // Mock innovation score
            (1 - metrics.stressLevel) * 100,
            72, // Mock work-life balance score
          ],
          backgroundColor: "rgba(0, 123, 255, 0.2)",
          borderColor: "#007bff",
          borderWidth: 2,
          pointBackgroundColor: "#007bff",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: "#007bff",
        },
      ],
    };
  };

  const getThreadEngagementData = () => {
    // Use real data if available, otherwise use mock data for demonstration
    const channels = dashboard?.topChannels || [
      {
        name: "general",
        threadCount: 45,
        threadReplyCount: 180,
        avgReplies: 4.0,
      },
      {
        name: "engineering",
        threadCount: 32,
        threadReplyCount: 120,
        avgReplies: 3.8,
      },
      {
        name: "random",
        threadCount: 28,
        threadReplyCount: 95,
        avgReplies: 3.4,
      },
      {
        name: "marketing",
        threadCount: 15,
        threadReplyCount: 60,
        avgReplies: 4.0,
      },
      {
        name: "design",
        threadCount: 12,
        threadReplyCount: 45,
        avgReplies: 3.8,
      },
    ];

    return {
      labels: channels.map((ch) => ch.name),
      datasets: [
        {
          label: "Thread Count",
          data: channels.map((ch) => ch.threadCount || 0),
          backgroundColor: "rgba(255, 193, 7, 0.7)",
          borderColor: "#ffc107",
          borderWidth: 1,
        },
        {
          label: "Avg Replies per Thread",
          data: channels.map((ch) => ch.avgReplies || 0),
          backgroundColor: "rgba(220, 53, 69, 0.7)",
          borderColor: "#dc3545",
          borderWidth: 1,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
    },
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
    },
    scales: {
      y: {
        type: "linear",
        display: true,
        position: "left",
        title: {
          display: true,
          text: "Message Count",
        },
      },
    },
  };

  const lineChartOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: function (value) {
            return value + "%";
          },
        },
      },
    },
  };

  const radarChartOptions = {
    ...chartOptions,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: function (value) {
            return value + "%";
          },
        },
      },
    },
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
            {selectedWorkspace && (
              <button
                onClick={() => fetchMessages(selectedWorkspace.id)}
                disabled={isFetchingMessages}
                className="fetch-messages-btn"
              >
                {isFetchingMessages
                  ? `Fetching Messages${
                      connectionRetries > 0
                        ? ` (Retry ${connectionRetries}/${maxRetries})`
                        : ""
                    }...`
                  : "Fetch Messages"}
              </button>
            )}
          </div>
        )}
      </div>

      {selectedWorkspace && (
        <div className="workspace-content">
          <div className="dashboard-tabs">
            <button
              className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button
              className={`tab-btn ${activeTab === "sentiment" ? "active" : ""}`}
              onClick={() => setActiveTab("sentiment")}
            >
              Sentiment Analysis
            </button>
            <button
              className={`tab-btn ${activeTab === "trends" ? "active" : ""}`}
              onClick={() => setActiveTab("trends")}
            >
              Trends & Patterns
            </button>
            <button
              className={`tab-btn ${activeTab === "insights" ? "active" : ""}`}
              onClick={() => setActiveTab("insights")}
            >
              Manager Insights
            </button>
            <button
              className={`tab-btn ${activeTab === "alerts" ? "active" : ""}`}
              onClick={() => setActiveTab("alerts")}
            >
              Alerts
            </button>
          </div>

          {activeTab === "overview" && (
            <div className="dashboard-section">
              <h2>Weekly Sentiment Dashboard</h2>
              <div className="dashboard-grid">
                <div className="metric-card">
                  <h3>Overall Sentiment</h3>
                  <div
                    className="metric-value"
                    style={{
                      color: getSentimentColor(
                        dashboard?.overallSentiment || 0.75
                      ),
                    }}
                  >
                    {isLoadingDashboard
                      ? "Loading..."
                      : ((dashboard?.overallSentiment || 0.75) * 100).toFixed(
                          1
                        )}
                    %
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Total Messages</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : (dashboard?.messageCount || 3590).toLocaleString()}
                  </div>
                  <div className="metric-subtitle">
                    {dashboard?.threadStats?.threadReplyCount
                      ? `(${(
                          dashboard?.messageCount -
                          dashboard?.threadStats?.threadReplyCount
                        ).toLocaleString()} main + ${dashboard?.threadStats?.threadReplyCount.toLocaleString()} replies)`
                      : "All messages"}
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Main Messages</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : (
                          dashboard?.messageCount -
                          (dashboard?.threadStats?.threadReplyCount || 0)
                        ).toLocaleString()}
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Thread Replies</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : (
                          dashboard?.threadStats?.threadReplyCount || 0
                        ).toLocaleString()}
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Active Users</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : dashboard?.activeUsers || 45}
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Engagement Rate</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : (
                          ((dashboard?.activeUsers || 45) /
                            (dashboard?.totalUsers || 60)) *
                          100
                        ).toFixed(1)}
                    %
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Thread Count</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : dashboard?.threadStats?.threadCount || 0}
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Avg Replies/Thread</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : dashboard?.threadStats?.avgRepliesPerThread || 0}
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Thread Engagement</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : `${dashboard?.threadStats?.threadEngagement || 0}%`}
                  </div>
                </div>
              </div>

              <div className="charts-grid">
                <div className="chart-container">
                  <h3>Sentiment Distribution</h3>
                  <div className="chart-wrapper">
                    {isLoadingSentiment ? (
                      <div className="chart-loading">
                        <div className="loading-spinner"></div>
                        <p>Analyzing sentiment...</p>
                      </div>
                    ) : (
                      <Pie
                        data={getSentimentDistributionData()}
                        options={chartOptions}
                      />
                    )}
                  </div>
                </div>

                <div className="chart-container">
                  <h3>Channel Activity & Thread Engagement</h3>
                  <div className="chart-wrapper">
                    {isLoadingDashboard ? (
                      <div className="chart-loading">
                        <div className="loading-spinner"></div>
                        <p>Loading channel data...</p>
                      </div>
                    ) : (
                      <Bar
                        data={getChannelComparisonData()}
                        options={barChartOptions}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "sentiment" && (
            <div className="dashboard-section">
              <h2>Detailed Sentiment Analysis</h2>

              <div className="charts-grid">
                <div className="chart-container">
                  <h3>Sentiment Distribution (Pie Chart)</h3>
                  <div className="chart-wrapper">
                    <Pie
                      data={getSentimentDistributionData()}
                      options={chartOptions}
                    />
                  </div>
                </div>

                <div className="chart-container">
                  <h3>Sentiment Distribution (Doughnut)</h3>
                  <div className="chart-wrapper">
                    <Doughnut
                      data={getSentimentDistributionData()}
                      options={chartOptions}
                    />
                  </div>
                </div>
              </div>

              <div className="chart-container full-width">
                <h3>Emoji Sentiment Analysis</h3>
                <div className="chart-wrapper">
                  <Bar data={getEmojiSentimentData()} options={chartOptions} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "trends" && (
            <div className="dashboard-section">
              <h2>Trends & Patterns</h2>

              <div className="chart-container full-width">
                <h3>Weekly Sentiment Trends</h3>
                <div className="chart-wrapper">
                  {isLoadingTrends ? (
                    <div className="chart-loading">
                      <div className="loading-spinner"></div>
                      <p>Calculating trends...</p>
                    </div>
                  ) : (
                    <Line
                      data={getWeeklyTrendsData()}
                      options={lineChartOptions}
                    />
                  )}
                </div>
              </div>

              <div className="chart-container full-width">
                <h3>Thread Engagement by Channel</h3>
                <div className="chart-wrapper">
                  {isLoadingDashboard ? (
                    <div className="chart-loading">
                      <div className="loading-spinner"></div>
                      <p>Analyzing thread patterns...</p>
                    </div>
                  ) : (
                    <Bar
                      data={getThreadEngagementData()}
                      options={barChartOptions}
                    />
                  )}
                </div>
              </div>

              <div className="chart-container full-width">
                <h3>Team Engagement Radar</h3>
                <div className="chart-wrapper">
                  {isLoadingInsights ? (
                    <div className="chart-loading">
                      <div className="loading-spinner"></div>
                      <p>Calculating engagement metrics...</p>
                    </div>
                  ) : (
                    <Radar
                      data={getTeamEngagementRadarData()}
                      options={radarChartOptions}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "insights" && (
            <div className="insights-section">
              <h2>Manager Insights</h2>
              <button
                onClick={() => generateInsights(selectedWorkspace.id)}
                disabled={isGeneratingInsights}
                className="generate-insights-btn"
              >
                {isGeneratingInsights ? "Generating..." : "Generate Insights"}
              </button>

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
                            insights?.metrics?.teamHappiness || 0.75
                          ),
                        }}
                      >
                        {isLoadingInsights
                          ? "Loading..."
                          : (
                              (insights?.metrics?.teamHappiness || 0.75) * 100
                            ).toFixed(0)}
                        %
                      </span>
                    </div>
                    <div className="metric">
                      <span className="label">Engagement Rate:</span>
                      <span
                        className="value"
                        style={{
                          color: getSentimentColor(
                            insights?.metrics?.engagementRate || 0.68
                          ),
                        }}
                      >
                        {isLoadingInsights
                          ? "Loading..."
                          : (
                              (insights?.metrics?.engagementRate || 0.68) * 100
                            ).toFixed(0)}
                        %
                      </span>
                    </div>
                    <div className="metric">
                      <span className="label">Stress Level:</span>
                      <span
                        className="value"
                        style={{
                          color: getSentimentColor(
                            1 - (insights?.metrics?.stressLevel || 0.25)
                          ),
                        }}
                      >
                        {isLoadingInsights
                          ? "Loading..."
                          : (
                              (insights?.metrics?.stressLevel || 0.25) * 100
                            ).toFixed(0)}
                        %
                      </span>
                    </div>
                  </div>
                </div>

                <div className="recommendations">
                  <h3>Actionable Recommendations</h3>
                  {isLoadingInsights ? (
                    <div className="chart-loading">
                      <div className="loading-spinner"></div>
                      <p>Generating recommendations...</p>
                    </div>
                  ) : (
                    <>
                      {(
                        insights?.recommendations || [
                          {
                            title: "Improve Team Communication",
                            priority: "medium",
                            description:
                              "Team sentiment shows room for improvement in communication patterns.",
                            actionItems: [
                              "Schedule weekly team check-ins",
                              "Encourage more positive feedback",
                              "Create dedicated channels for different topics",
                            ],
                          },
                          {
                            title: "Address Burnout Warning",
                            priority: "high",
                            description:
                              "Several team members show signs of stress and potential burnout.",
                            actionItems: [
                              "Review workload distribution",
                              "Implement flexible work hours",
                              "Schedule one-on-one meetings with affected team members",
                            ],
                          },
                        ]
                      ).map((rec, index) => (
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
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "alerts" && (
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
          )}
        </div>
      )}
    </div>
  );
}

export default EmployeeEngagement;
