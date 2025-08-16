import React, { useState, useEffect, useRef } from "react";
import { api } from "../config/api";
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

  const [trends, setTrends] = useState(null);
  const [insights, setInsights] = useState(null);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [connectionFailed, setConnectionFailed] = useState(false);

  // Slack connection form state
  const [slackForm, setSlackForm] = useState({
    workspaceName: "AI Fund Buildathon", // Pre-filled with a meaningful name
    channels: "aifund-buildathon-081625", // Pre-populated with the specific channel
  });

  const [isFetchingMessages, setIsFetchingMessages] = useState(false);
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [maxRetries] = useState(3);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [sentimentProgress, setSentimentProgress] = useState({
    current: 0,
    total: 0,
    message: "",
  });

  // Auto-reconnect logic
  const autoReconnect = async () => {
    if (connectionRetries >= maxRetries) {
      setConnectionFailed(true);
      setWorkspaces([]);
      setSelectedWorkspace(null);
      setDashboard(null);

      setTrends(null);
      setInsights(null);
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
      const response = await api.get("/api/employee-engagement/workspaces");

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

          const reconnectResponse = await api.post(
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
      const response = await api.get("/api/employee-engagement/workspaces");
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
    setConnectionFailed(false);
    try {
      const channels = slackForm.channels.split(",").map((ch) => ch.trim());
      const response = await api.post(
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
      setConnectionFailed(true);
      alert("Failed to connect Slack workspace");
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchMessages = async (workspaceId) => {
    if (!workspaceId) return;

    setIsFetchingMessages(true);
    setSentimentProgress({
      current: 0,
      total: 0,
      message: "Starting message fetch...",
    });
    let retryCount = 0;
    const maxRetries = 2;

    // Start progress polling
    const progressInterval = setInterval(async () => {
      try {
        const response = await api.get(
          `/api/employee-engagement/progress/${workspaceId}`
        );
        setSentimentProgress(response.data.progress);

        // Check if sentiment analysis is complete
        if (
          response.data.progress?.message === "Sentiment analysis complete!"
        ) {
          clearInterval(progressInterval);
          console.log("Sentiment analysis complete, refreshing all data...");
          await refreshAllData(workspaceId);
        }
      } catch (error) {
        console.error("Error fetching progress:", error);
      }
    }, 1000);

    const attemptFetch = async () => {
      try {
        const workspace = workspaces.find((w) => w.id === workspaceId);
        const response = await api.post(
          `/api/employee-engagement/fetch-messages/${workspaceId}`,
          {
            channels: workspace.channels,
            limit: 200, // Fetch up to 200 messages
          }
        );

        setSentimentProgress({
          current: 0,
          total: 0,
          message: "Messages fetched successfully!",
        });

        alert(
          `Successfully fetched ${
            response.data.messageCount
          } messages from ${response.data.channels.join(", ")}`
        );

        // Reload dashboard data with new messages
        await loadDashboard(workspaceId);
        await loadTrends(workspaceId);
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
    clearInterval(progressInterval);
    setIsFetchingMessages(false);
    setSentimentProgress({ current: 0, total: 0, message: "" });
  };

  // Function to validate data quality
  const validateDataQuality = (data, dataType) => {
    console.log(`=== ${dataType} Data Validation ===`);
    console.log("Data:", data);

    if (!data) {
      console.warn(`${dataType}: No data available`);
      return false;
    }

    if (dataType === "Sentiment Distribution") {
      const { positive, neutral, negative } = data;
      const total = (positive || 0) + (neutral || 0) + (negative || 0);
      console.log(
        `${dataType}: Positive=${positive}, Neutral=${neutral}, Negative=${negative}, Total=${total}`
      );
      return total > 0;
    }

    if (dataType === "Channel Data") {
      console.log(`${dataType}: ${data.length} channels`);
      data.forEach((channel, index) => {
        console.log(
          `  Channel ${index + 1}: ${channel.name} - ${
            channel.messageCount
          } messages, ${channel.threadReplyCount} replies`
        );
      });
      return data.length > 0 && data.some((ch) => ch.messageCount > 0);
    }

    return true;
  };

  // Function to refresh all data after sentiment analysis
  const refreshAllData = async (workspaceId) => {
    console.log("Refreshing all data for workspace:", workspaceId);

    // Clear existing data to force fresh load
    setDashboard(null);
    setTrends(null);
    setInsights(null);

    // Add a small delay to ensure state is cleared
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Load fresh data
    await loadDashboard(workspaceId);
    await loadTrends(workspaceId);
    console.log("All data refreshed successfully");
  };

  const loadDashboard = async (workspaceId) => {
    if (!workspaceId) return;

    setIsLoadingDashboard(true);
    try {
      const response = await api.get(
        `/api/employee-engagement/dashboard/${workspaceId}`
      );

      console.log("Dashboard response:", response.data);
      console.log("Dashboard data:", response.data.dashboard);
      console.log(
        "Sentiment distribution:",
        response.data.dashboard?.sentimentDistribution
      );
      console.log("Top channels:", response.data.dashboard?.topChannels);

      setDashboard(response.data.dashboard);

      // Also try to load saved sentiment data for more detailed analysis
      try {
        const sentimentResponse = await api.get(
          `/api/employee-engagement/sentiment-data/${workspaceId}`
        );
        if (sentimentResponse.data.success) {
          // Merge sentiment data with dashboard data
          setDashboard((prev) => ({
            ...prev,
            detailedSentiment: sentimentResponse.data.data,
          }));
        }
      } catch (sentimentError) {
        console.log(
          "No saved sentiment data available:",
          sentimentError.message
        );
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  const loadTrends = async (workspaceId) => {
    if (!workspaceId) return;

    setIsLoadingTrends(true);
    try {
      const response = await api.get(
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
      const response = await api.post(
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

  useEffect(() => {
    if (selectedWorkspace) {
      loadDashboard(selectedWorkspace.id);
      loadTrends(selectedWorkspace.id);
    }
  }, [selectedWorkspace]);

  const getSentimentColor = (sentiment) => {
    if (sentiment >= 0.7) return "#4CAF50";
    if (sentiment >= 0.5) return "#FF9800";
    return "#F44336";
  };

  // Chart configurations
  const getSentimentDistributionData = () => {
    console.log("Dashboard data for sentiment chart:", dashboard);

    // Validate sentiment distribution data
    const isValidData = validateDataQuality(
      dashboard?.sentimentDistribution,
      "Sentiment Distribution"
    );

    // Use real sentiment data from saved analysis
    if (!dashboard || !dashboard.sentimentDistribution) {
      console.log("No sentiment distribution data available");
      return {
        labels: ["Positive", "Neutral", "Negative"],
        datasets: [
          {
            data: [0, 0, 0], // No data available
            backgroundColor: ["#4CAF50", "#FF9800", "#F44336"],
            borderColor: ["#45a049", "#e68900", "#d32f2f"],
            borderWidth: 2,
          },
        ],
      };
    }

    // Even if validation fails, try to show the data if it exists
    if (!isValidData) {
      console.log("Data validation failed, but showing available data");
    }

    // Use real sentiment distribution data
    const { positive, neutral, negative } = dashboard.sentimentDistribution;
    console.log("Sentiment distribution:", { positive, neutral, negative });

    // Ensure we have valid numbers
    const pos = positive || 0;
    const neu = neutral || 0;
    const neg = negative || 0;

    const total = pos + neu + neg;
    console.log("Total messages for sentiment:", total);

    // Ensure all values are valid numbers
    const chartData = [pos, neu, neg].map((val) => {
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    });

    console.log("Final chart data:", chartData);

    return {
      labels: ["Positive", "Neutral", "Negative"],
      datasets: [
        {
          data: chartData,
          backgroundColor: ["#4CAF50", "#FF9800", "#F44336"],
          borderColor: ["#45a049", "#e68900", "#d32f2f"],
          borderWidth: 2,
        },
      ],
    };
  };

  const getWeeklyTrendsData = () => {
    // Only use real data, no mock data
    if (!trends?.weeklyTrends) {
      return {
        labels: [],
        datasets: [
          {
            label: "Sentiment Score",
            data: [],
            borderColor: "#007bff",
            backgroundColor: "rgba(0, 123, 255, 0.1)",
            fill: true,
            tension: 0.4,
          },
        ],
      };
    }

    const days = Object.keys(trends.weeklyTrends);
    const sentimentValues = Object.values(trends.weeklyTrends);

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
    console.log("Channel comparison data - dashboard:", dashboard);
    console.log(
      "Channel comparison data - topChannels:",
      dashboard?.topChannels
    );

    // Validate channel data
    const isValidData = validateDataQuality(
      dashboard?.topChannels,
      "Channel Data"
    );

    // Debug channel data if available
    if (dashboard?.topChannels && dashboard.topChannels.length > 0) {
      console.log("Channel data for chart:");
      dashboard.topChannels.forEach((ch, index) => {
        const mainMessages = ch.messageCount - (ch.threadReplyCount || 0);
        console.log(`  Channel ${index + 1}: ${ch.name}`);
        console.log(`    - Total messages: ${ch.messageCount}`);
        console.log(`    - Thread replies: ${ch.threadReplyCount || 0}`);
        console.log(`    - Main messages: ${mainMessages}`);
      });
    }

    // Only use real data, no mock data
    if (
      !dashboard?.topChannels ||
      dashboard.topChannels.length === 0 ||
      !isValidData
    ) {
      console.log("No valid channel data available");
      return {
        labels: [],
        datasets: [
          {
            label: "Total Messages",
            data: [],
            backgroundColor: "rgba(0, 123, 255, 0.7)",
            borderColor: "#007bff",
            borderWidth: 1,
            yAxisID: "y",
          },
          {
            label: "Main Messages",
            data: [],
            backgroundColor: "rgba(40, 167, 69, 0.7)",
            borderColor: "#28a745",
            borderWidth: 1,
            yAxisID: "y",
          },
          {
            label: "Thread Replies",
            data: [],
            backgroundColor: "rgba(255, 193, 7, 0.7)",
            borderColor: "#ffc107",
            borderWidth: 1,
            yAxisID: "y",
          },
        ],
      };
    }

    const channels = dashboard.topChannels;

    return {
      labels: channels.map((ch) => ch.name),
      datasets: [
        {
          label: "Total Messages",
          data: channels.map((ch) => ch.messageCount),
          backgroundColor: "rgba(0, 123, 255, 0.7)",
          borderColor: "#007bff",
          borderWidth: 1,
          yAxisID: "y",
        },
        {
          label: "Main Messages",
          data: channels.map(
            (ch) => ch.messageCount - (ch.threadReplyCount || 0)
          ),
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

  const getTeamEngagementRadarData = () => {
    // Only use real data, no mock data
    if (!insights?.metrics) {
      return {
        labels: [
          "Team Happiness",
          // "Engagement Rate",
          "Collaboration",
          "Innovation",
          "Stress Level",
          "Work-Life Balance",
        ],
        datasets: [
          {
            label: "Current Week",
            data: [0, 0, 0, 0, 0, 0],
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
    }

    const metrics = insights.metrics;

    return {
      labels: [
        "Team Happiness",
        // "Engagement Rate",
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
    // Only use real data, no mock data
    if (!dashboard?.topChannels || dashboard.topChannels.length === 0) {
      return {
        labels: [],
        datasets: [
          {
            label: "Thread Count",
            data: [],
            backgroundColor: "rgba(255, 193, 7, 0.7)",
            borderColor: "#ffc107",
            borderWidth: 1,
          },
          {
            label: "Avg Replies per Thread",
            data: [],
            backgroundColor: "rgba(220, 53, 69, 0.7)",
            borderColor: "#dc3545",
            borderWidth: 1,
          },
        ],
      };
    }

    const channels = dashboard.topChannels;

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

        {workspaces.length === 0 || connectionFailed ? (
          <div className="connect-slack">
            <h3>
              {connectionFailed
                ? "Reconnect Slack Workspace"
                : "Connect Your First Slack Workspace"}
            </h3>
            {connectionFailed && (
              <div className="connection-error">
                <p>
                  Previous connection failed. Please reconnect your workspace.
                </p>
              </div>
            )}
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
              <div className="fetch-messages-section">
                <div className="fetch-buttons">
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
                  <button
                    onClick={() => refreshAllData(selectedWorkspace.id)}
                    disabled={isLoadingDashboard || isLoadingTrends}
                    className="refresh-data-btn"
                  >
                    {isLoadingDashboard || isLoadingTrends
                      ? "Refreshing..."
                      : "Refresh Data"}
                  </button>
                </div>
                {sentimentProgress.message && (
                  <div className="sentiment-progress">
                    <p>{sentimentProgress.message}</p>
                    {sentimentProgress.total > 0 && (
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${
                              (sentimentProgress.current /
                                sentimentProgress.total) *
                              100
                            }%`,
                          }}
                        ></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
          </div>

          {activeTab === "overview" && (
            <div className="dashboard-section">
              <h2>Weekly Sentiment Dashboard</h2>

              {/* Data Status Indicator */}
              <div className="data-status">
                <div
                  className={`status-indicator ${
                    dashboard?.messageCount > 0 ? "has-data" : "no-data"
                  }`}
                >
                  <span className="status-dot"></span>
                  <span className="status-text">
                    {dashboard?.messageCount > 0
                      ? `Real data available (${dashboard.messageCount} messages)`
                      : "No data available - Fetch messages to see real statistics"}
                  </span>
                </div>
              </div>
              <div className="dashboard-grid">
                <div className="metric-card">
                  <h3>Overall Sentiment</h3>
                  <div
                    className="metric-value"
                    style={{
                      color: getSentimentColor(
                        dashboard?.overallSentiment || 0
                      ),
                    }}
                  >
                    {isLoadingDashboard
                      ? "Loading..."
                      : dashboard?.overallSentiment
                      ? (dashboard.overallSentiment * 100).toFixed(1)
                      : "No data"}
                    {dashboard?.overallSentiment ? "%" : ""}
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Total Messages</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : dashboard?.messageCount
                      ? dashboard.messageCount.toLocaleString()
                      : "No data"}
                  </div>
                  <div className="metric-subtitle">
                    {dashboard?.threadStats?.threadReplyCount
                      ? `(${(
                          dashboard?.messageCount -
                          dashboard?.threadStats?.threadReplyCount
                        ).toLocaleString()} main + ${dashboard?.threadStats?.threadReplyCount.toLocaleString()} replies)`
                      : dashboard?.messageCount
                      ? "All messages"
                      : ""}
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Main Messages</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : dashboard?.messageCount
                      ? (
                          dashboard.messageCount -
                          (dashboard?.threadStats?.threadReplyCount || 0)
                        ).toLocaleString()
                      : "No data"}
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Thread Replies</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : dashboard?.threadStats?.threadReplyCount
                      ? dashboard.threadStats.threadReplyCount.toLocaleString()
                      : "No data"}
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Active Users</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : dashboard?.activeUsers
                      ? dashboard.activeUsers
                      : "No data"}
                  </div>
                </div>
                {/* <div className="metric-card">
                  <h3>Engagement Rate</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : dashboard?.activeUsers && dashboard?.totalUsers
                      ? (
                          (dashboard.activeUsers / dashboard.totalUsers) *
                          100
                        ).toFixed(1)
                      : "No data"}
                    {dashboard?.activeUsers && dashboard?.totalUsers ? "%" : ""}
                  </div>
                </div> */}
                <div className="metric-card">
                  <h3>Thread Count</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : dashboard?.threadStats?.threadCount
                      ? dashboard.threadStats.threadCount
                      : "No data"}
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Avg Replies/Thread</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : dashboard?.threadStats?.avgRepliesPerThread
                      ? dashboard.threadStats.avgRepliesPerThread
                      : "No data"}
                  </div>
                </div>
                <div className="metric-card">
                  <h3>Thread Engagement</h3>
                  <div className="metric-value">
                    {isLoadingDashboard
                      ? "Loading..."
                      : dashboard?.threadStats?.threadEngagement
                      ? `${dashboard.threadStats.threadEngagement}%`
                      : "No data"}
                  </div>
                </div>
              </div>

              <div className="charts-grid">
                <div className="chart-container">
                  <h3>Sentiment Distribution</h3>
                  <div className="chart-wrapper">
                    {isLoadingDashboard ? (
                      <div className="chart-loading">
                        <div className="loading-spinner"></div>
                        <p>Loading sentiment data...</p>
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

              {trends?.burnoutWarnings && trends.burnoutWarnings.length > 0 && (
                <div className="burnout-warnings-section">
                  <h3>Burnout Warnings</h3>
                  <div className="warnings-grid">
                    {trends.burnoutWarnings.map((warning, index) => (
                      <div
                        key={index}
                        className={`warning-card ${warning.severity}`}
                      >
                        <div className="warning-header">
                          <span className="severity-badge">
                            {warning.severity}
                          </span>
                          <span className="warning-type">
                            User: {warning.userId}
                          </span>
                        </div>
                        <p className="warning-message">{warning.warning}</p>
                        <div className="warning-details">
                          <span>
                            Negative messages: {warning.negativeCount}
                          </span>
                          {warning.recentMessages && (
                            <div className="recent-messages">
                              <strong>Recent messages:</strong>
                              {warning.recentMessages.map((msg, i) => (
                                <div key={i} className="message-preview">
                                  "{msg.text.substring(0, 100)}..."
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {trends?.summary && (
                <div className="trends-summary">
                  <h3>Trends Summary</h3>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span className="label">Total Messages:</span>
                      <span className="value">
                        {trends.summary.totalMessages}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="label">Average Sentiment:</span>
                      <span className="value">
                        {(trends.summary.averageSentiment * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="label">Users with Warnings:</span>
                      <span className="value">
                        {trends.summary.usersWithWarnings}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="label">Trend Direction:</span>
                      <span
                        className={`value ${trends.summary.trendDirection}`}
                      >
                        {trends.summary.trendDirection}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {trends?.aiAnalysis && (
                <div className="ai-analysis-section">
                  <h3>AI-Powered Trend Analysis</h3>

                  {trends.aiAnalysis.trendSummary && (
                    <div className="analysis-card">
                      <h4>Trend Summary</h4>
                      <p>{trends.aiAnalysis.trendSummary}</p>
                    </div>
                  )}

                  {trends.aiAnalysis.patternAnalysis && (
                    <div className="analysis-card">
                      <h4>Pattern Analysis</h4>
                      <p>{trends.aiAnalysis.patternAnalysis}</p>
                    </div>
                  )}

                  {trends.aiAnalysis.predictions &&
                    trends.aiAnalysis.predictions.length > 0 && (
                      <div className="analysis-card">
                        <h4>Predictions</h4>
                        <div className="predictions-list">
                          {trends.aiAnalysis.predictions.map(
                            (prediction, index) => (
                              <div key={index} className="prediction-item">
                                <div className="prediction-header">
                                  <span className="prediction-type">
                                    {prediction.type}
                                  </span>
                                  <span
                                    className={`confidence ${prediction.confidence}`}
                                  >
                                    {prediction.confidence} confidence
                                  </span>
                                </div>
                                <p className="prediction-text">
                                  {prediction.prediction}
                                </p>
                                <span className="timeframe">
                                  {prediction.timeframe}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {trends.aiAnalysis.riskFactors &&
                    trends.aiAnalysis.riskFactors.length > 0 && (
                      <div className="analysis-card">
                        <h4>Risk Factors</h4>
                        <div className="risk-factors-list">
                          {trends.aiAnalysis.riskFactors.map((risk, index) => (
                            <div
                              key={index}
                              className={`risk-item ${risk.impact}`}
                            >
                              <div className="risk-header">
                                <span className="risk-factor">
                                  {risk.factor}
                                </span>
                                <span className={`impact ${risk.impact}`}>
                                  {risk.impact} impact
                                </span>
                              </div>
                              <p className="mitigation">{risk.mitigation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {trends.aiAnalysis.opportunities &&
                    trends.aiAnalysis.opportunities.length > 0 && (
                      <div className="analysis-card">
                        <h4>Opportunities</h4>
                        <div className="opportunities-list">
                          {trends.aiAnalysis.opportunities.map((opp, index) => (
                            <div key={index} className="opportunity-item">
                              <p className="opportunity-text">
                                {opp.opportunity}
                              </p>
                              <p className="action-text">{opp.action}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {trends.aiAnalysis.weeklyInsights && (
                    <div className="analysis-card">
                      <h4>Weekly Insights</h4>
                      <div className="weekly-insights-grid">
                        {Object.entries(trends.aiAnalysis.weeklyInsights).map(
                          ([day, insight]) => (
                            <div key={day} className="day-insight">
                              <h5>{day}</h5>
                              <p>{insight}</p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                            insights?.metrics?.teamHappiness || 0
                          ),
                        }}
                      >
                        {isLoadingInsights
                          ? "Loading..."
                          : insights?.metrics?.teamHappiness
                          ? (insights.metrics.teamHappiness * 100).toFixed(0)
                          : "No data"}
                        {insights?.metrics?.teamHappiness ? "%" : ""}
                      </span>
                    </div>
                    {/* <div className="metric">
                      <span className="label">Engagement Rate:</span>
                      <span
                        className="value"
                        style={{
                          color: getSentimentColor(
                            insights?.metrics?.engagementRate || 0
                          ),
                        }}
                      >
                        {isLoadingInsights
                          ? "Loading..."
                          : insights?.metrics?.engagementRate
                          ? (insights.metrics.engagementRate * 100).toFixed(0)
                          : "No data"}
                        {insights?.metrics?.engagementRate ? "%" : ""}
                      </span>
                    </div> */}
                    <div className="metric">
                      <span className="label">Stress Level:</span>
                      <span
                        className="value"
                        style={{
                          color: getSentimentColor(
                            1 - (insights?.metrics?.stressLevel || 0)
                          ),
                        }}
                      >
                        {isLoadingInsights
                          ? "Loading..."
                          : insights?.metrics?.stressLevel
                          ? (insights.metrics.stressLevel * 100).toFixed(0)
                          : "No data"}
                        {insights?.metrics?.stressLevel ? "%" : ""}
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
                      {(insights?.recommendations || []).map((rec, index) => (
                        <div key={index} className="recommendation-card">
                          <div className="rec-header">
                            <h4>{rec.title}</h4>
                            <span
                              className="priority"
                              style={{
                                backgroundColor:
                                  rec.priority === "high"
                                    ? "#F44336"
                                    : rec.priority === "medium"
                                    ? "#FF9800"
                                    : "#4CAF50",
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

                {insights?.keyInsights && insights.keyInsights.length > 0 && (
                  <div className="key-insights">
                    <h3>Key Insights</h3>
                    <div className="insights-list">
                      {insights.keyInsights.map((insight, index) => (
                        <div key={index} className="insight-item">
                          <span className="insight-bullet">•</span>
                          <span className="insight-text">{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {insights?.trendAnalysis && (
                  <div className="trend-analysis">
                    <h3>Trend Analysis</h3>
                    <p className="analysis-text">{insights.trendAnalysis}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EmployeeEngagement;
