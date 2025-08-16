const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { WebClient } = require("@slack/web-api");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);
const {
  analyzeSentiment,
  generateEngagementInsights,
  generateTrendAnalysis,
  generateAlertAnalysis,
} = require("../utils/openai");

// Helper function to analyze sentiment for a message
async function analyzeMessageSentiment(message) {
  try {
    if (!message.text || message.text.trim().length === 0) {
      return {
        ...message,
        sentiment: "neutral",
        sentimentConfidence: 0.5,
        emotions: [],
        intensity: "low",
        context: "Empty message",
      };
    }

    const sentimentResult = await analyzeSentiment(message.text);
    return {
      ...message,
      sentiment: sentimentResult.sentiment,
      sentimentConfidence: sentimentResult.confidence,
      emotions: sentimentResult.emotions,
      intensity: sentimentResult.intensity,
      context: sentimentResult.context,
    };
  } catch (error) {
    console.error(
      `Error analyzing sentiment for message ${message.id}:`,
      error
    );
    return {
      ...message,
      sentiment: "neutral",
      sentimentConfidence: 0.5,
      emotions: [],
      intensity: "medium",
      context: "Error during analysis",
    };
  }
}

const router = express.Router();

// In-memory storage for workspaces (in production, use a database)
let workspaces = [];
let workspaceMessages = new Map(); // workspaceId -> messages
let sentimentProgress = new Map(); // workspaceId -> progress

// Function to save sentiment data to JSON file
async function saveSentimentData(workspaceId, data) {
  try {
    const dataDir = path.join(__dirname, "..", "data", "sentiment");

    // Create directory if it doesn't exist
    if (!(await exists(dataDir))) {
      await mkdir(dataDir, { recursive: true });
    }

    const filename = `sentiment_${workspaceId}_${Date.now()}.json`;
    const filepath = path.join(dataDir, filename);

    const sentimentData = {
      workspaceId,
      timestamp: new Date().toISOString(),
      totalMessages: data.length,
      sentimentDistribution: {
        positive: data.filter((m) => m.sentiment === "positive").length,
        neutral: data.filter((m) => m.sentiment === "neutral").length,
        negative: data.filter((m) => m.sentiment === "negative").length,
      },
      averageSentiment:
        data.reduce((sum, m) => sum + (m.sentimentConfidence || 0.5), 0) /
        data.length,
      messages: data,
      summary: {
        totalMessages: data.length,
        uniqueUsers: new Set(data.map((m) => m.userId)).size,
        uniqueChannels: new Set(data.map((m) => m.channel)).size,
        dateRange: {
          start:
            data.length > 0
              ? new Date(Math.min(...data.map((m) => new Date(m.timestamp))))
              : null,
          end:
            data.length > 0
              ? new Date(Math.max(...data.map((m) => new Date(m.timestamp))))
              : null,
        },
      },
    };

    await writeFile(filepath, JSON.stringify(sentimentData, null, 2));
    console.log(`Sentiment data saved to: ${filepath}`);

    return filepath;
  } catch (error) {
    console.error("Error saving sentiment data:", error);
    throw error;
  }
}

// Function to load sentiment data from JSON file
async function loadSentimentData(workspaceId) {
  try {
    const dataDir = path.join(__dirname, "..", "data", "sentiment");
    const files = await fs.promises.readdir(dataDir);

    // Find the most recent file for this workspace
    const workspaceFiles = files
      .filter((file) => file.startsWith(`sentiment_${workspaceId}_`))
      .sort()
      .reverse();

    if (workspaceFiles.length === 0) {
      return null;
    }

    const latestFile = workspaceFiles[0];
    const filepath = path.join(dataDir, latestFile);
    const data = await readFile(filepath, "utf8");

    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading sentiment data:", error);
    return null;
  }
}

// Initialize Slack client with environment variables
const slackBotToken = process.env.SLACK_BOT_TOKEN;
const defaultChannels = process.env.DEFAULT_SLACK_CHANNELS
  ? process.env.DEFAULT_SLACK_CHANNELS.split(",")
  : ["aifund-buildathon-081625"];

// POST /api/employee-engagement/connect-slack
// Connect Slack workspace and configure channels
router.post("/connect-slack", async (req, res) => {
  try {
    const { workspaceName, channels } = req.body;

    if (!workspaceName) {
      return res.status(400).json({
        error: "Workspace name is required",
      });
    }

    if (!slackBotToken) {
      return res.status(500).json({
        error:
          "Slack bot token not configured. Please set SLACK_BOT_TOKEN in your .env file.",
      });
    }

    // Validate Slack token by testing the API
    const slack = new WebClient(slackBotToken);

    try {
      // Test the token by calling auth.test
      const authTest = await slack.auth.test();

      if (!authTest.ok) {
        return res.status(400).json({
          error: "Invalid Slack bot token",
        });
      }

      // Get workspace info
      const teamInfo = await slack.team.info();

      const workspace = {
        id: uuidv4(),
        name: workspaceName,
        slackTeamId: authTest.team_id,
        channels: channels || defaultChannels,
        connectedAt: new Date(),
        status: "active",
        botUserId: authTest.user_id,
      };

      // Store workspace
      workspaces.push(workspace);
      workspaceMessages.set(workspace.id, []);

      res.json({
        message: "Slack workspace connected successfully",
        workspace: {
          id: workspace.id,
          name: workspace.name,
          channels: workspace.channels,
          connectedAt: workspace.connectedAt,
          status: workspace.status,
        },
      });
    } catch (slackError) {
      console.error("Slack API error:", slackError);
      return res.status(400).json({
        error:
          "Failed to validate Slack token. Please check your SLACK_BOT_TOKEN in .env file.",
      });
    }
  } catch (error) {
    console.error("Slack connection error:", error);
    res.status(500).json({ error: "Failed to connect Slack workspace" });
  }
});

// GET /api/employee-engagement/workspaces
// Get all connected Slack workspaces
router.get("/workspaces", async (req, res) => {
  try {
    const workspaceList = workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      channels: workspace.channels,
      connectedAt: workspace.connectedAt,
      status: workspace.status,
    }));

    res.json({ workspaces: workspaceList });
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    res.status(500).json({ error: "Failed to fetch workspaces" });
  }
});

// POST /api/employee-engagement/fetch-messages/:workspaceId
// Fetch messages from specified channels
router.post("/fetch-messages/:workspaceId", async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { channels, limit = 100 } = req.body;

    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const slack = new WebClient(slackBotToken);
    const allMessages = [];
    const channelsToFetch = channels || workspace.channels;

    for (const channelName of channelsToFetch) {
      try {
        // First, get the channel ID by name
        const conversationsList = await slack.conversations.list({
          types: "public_channel,private_channel",
        });

        const channel = conversationsList.channels.find(
          (ch) => ch.name === channelName.replace("#", "")
        );

        if (!channel) {
          console.warn(`Channel ${channelName} not found`);
          continue;
        }

        // Check if bot is in the channel, if not, invite it
        try {
          const botInfo = await slack.auth.test();
          const botUserId = botInfo.user_id;
          console.log(`Bot user ID: ${botUserId}`);

          // Try to get channel info to see if bot is a member
          const channelInfo = await slack.conversations.info({
            channel: channel.id,
          });

          console.log(`Channel ${channelName} info:`, {
            id: channel.id,
            name: channel.name,
            is_private: channelInfo.channel.is_private,
            member_count: channelInfo.channel.num_members,
            has_members: !!channelInfo.channel.members,
          });

          const isBotInChannel =
            channelInfo.channel.members &&
            channelInfo.channel.members.includes(botUserId);

          console.log(`Bot in channel ${channelName}: ${isBotInChannel}`);

          if (!isBotInChannel) {
            console.log(
              `Bot not in channel ${channelName}, attempting to join...`
            );
            try {
              // For public channels, try to join
              if (!channelInfo.channel.is_private) {
                await slack.conversations.join({
                  channel: channel.id,
                });
                console.log(
                  `Successfully joined public channel ${channelName}`
                );
              } else {
                console.log(
                  `Channel ${channelName} is private. Bot needs to be invited manually.`
                );
                console.log(
                  `Please invite the bot to #${channelName} using: /invite @your-bot-name`
                );
              }
            } catch (joinError) {
              console.warn(
                `Could not auto-join channel ${channelName}:`,
                joinError.message
              );
              if (joinError.data && joinError.data.error === "missing_scope") {
                console.log(
                  `Missing scope: ${joinError.data.needed}. Please add this scope to your Slack app.`
                );
              } else {
                console.log(
                  `Please manually invite the bot to #${channelName} using /invite @your-bot-name`
                );
              }
            }
          }
        } catch (botCheckError) {
          console.warn(
            `Could not check bot membership in ${channelName}:`,
            botCheckError.message
          );
        }

        // Fetch messages from the channel
        try {
          const messagesResult = await slack.conversations.history({
            channel: channel.id,
            limit: limit,
            inclusive: true,
          });

          if (messagesResult.ok && messagesResult.messages) {
            const rawMessages = messagesResult.messages
              .filter((msg) => msg.type === "message" && !msg.subtype) // Only regular messages
              .map((msg) => ({
                id: msg.ts,
                userId: msg.user,
                text: msg.text,
                timestamp: new Date(parseFloat(msg.ts) * 1000),
                channel: channelName,
                reactions: msg.reactions || [],
                threadTs: msg.thread_ts,
                isThread: !!msg.thread_ts,
              }));

            console.log(`Channel ${channelName} - Main messages:`, {
              totalMainMessages: rawMessages.length,
              messagesWithThreads: rawMessages.filter((m) => m.threadTs).length,
              messagesWithoutThreads: rawMessages.filter((m) => !m.threadTs)
                .length,
            });

            // Analyze sentiment for main messages
            console.log(
              `Starting sentiment analysis for ${rawMessages.length} main messages...`
            );
            sentimentProgress.set(workspaceId, {
              current: 0,
              total: rawMessages.length,
              message: "Analyzing main messages...",
            });

            const channelMessages = [];
            for (let i = 0; i < rawMessages.length; i++) {
              const message = rawMessages[i];
              console.log(
                `Analyzing sentiment for message ${i + 1}/${
                  rawMessages.length
                }: ${message.text.substring(0, 50)}...`
              );

              const analyzedMessage = await analyzeMessageSentiment(message);
              channelMessages.push(analyzedMessage);

              // Update progress
              sentimentProgress.set(workspaceId, {
                current: i + 1,
                total: rawMessages.length,
                message: `Analyzing main messages... (${i + 1}/${
                  rawMessages.length
                })`,
              });

              // Add a small delay to avoid rate limiting
              if (i < rawMessages.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
            }
            console.log(
              `Completed sentiment analysis for ${channelMessages.length} main messages`
            );

            // Fetch thread replies for messages that have threads
            const threadMessages = [];
            for (const message of channelMessages) {
              if (message.threadTs) {
                try {
                  console.log(
                    `Fetching thread replies for message ${message.id}`
                  );
                  const threadResult = await slack.conversations.replies({
                    channel: channel.id,
                    ts: message.threadTs,
                    limit: 50, // Fetch up to 50 thread replies
                  });

                  if (threadResult.ok && threadResult.messages) {
                    // Skip the first message (it's the parent message we already have)
                    const replies = threadResult.messages.slice(1);
                    const rawThreadReplies = replies
                      .filter(
                        (reply) => reply.type === "message" && !reply.subtype
                      )
                      .map((reply) => ({
                        id: reply.ts,
                        userId: reply.user,
                        text: reply.text,
                        timestamp: new Date(parseFloat(reply.ts) * 1000),
                        channel: channelName,
                        reactions: reply.reactions || [],
                        threadTs: message.threadTs,
                        isThread: true,
                        isThreadReply: true,
                        parentMessageId: message.id,
                      }));

                    // Analyze sentiment for thread replies
                    console.log(
                      `Starting sentiment analysis for ${rawThreadReplies.length} thread replies...`
                    );
                    const currentProgress = sentimentProgress.get(
                      workspaceId
                    ) || { current: 0, total: 0 };
                    const totalMessages =
                      currentProgress.total + rawThreadReplies.length;
                    sentimentProgress.set(workspaceId, {
                      current: currentProgress.current,
                      total: totalMessages,
                      message: `Analyzing thread replies...`,
                    });

                    for (let i = 0; i < rawThreadReplies.length; i++) {
                      const reply = rawThreadReplies[i];
                      console.log(
                        `Analyzing sentiment for thread reply ${i + 1}/${
                          rawThreadReplies.length
                        }: ${reply.text.substring(0, 50)}...`
                      );

                      const analyzedReply = await analyzeMessageSentiment(
                        reply
                      );
                      threadMessages.push(analyzedReply);

                      // Update progress
                      sentimentProgress.set(workspaceId, {
                        current: currentProgress.current + i + 1,
                        total: totalMessages,
                        message: `Analyzing thread replies... (${i + 1}/${
                          rawThreadReplies.length
                        })`,
                      });

                      // Add a small delay to avoid rate limiting
                      if (i < rawThreadReplies.length - 1) {
                        await new Promise((resolve) =>
                          setTimeout(resolve, 100)
                        );
                      }
                    }
                    console.log(
                      `Completed sentiment analysis for ${rawThreadReplies.length} thread replies for message ${message.id}`
                    );
                  }
                } catch (threadError) {
                  console.warn(
                    `Error fetching thread replies for message ${message.id}:`,
                    threadError.message
                  );
                }
              }
            }

            console.log(`Channel ${channelName} - Thread summary:`, {
              totalThreadReplies: threadMessages.length,
              threadsProcessed: channelMessages.filter((m) => m.threadTs)
                .length,
            });

            allMessages.push(...channelMessages);
            allMessages.push(...threadMessages);
            console.log(
              `Successfully fetched ${channelMessages.length} messages and ${threadMessages.length} thread replies from ${channelName}`
            );
          }
        } catch (historyError) {
          console.error(
            `Error fetching messages from ${channelName}:`,
            historyError.message
          );
          if (
            historyError.data &&
            historyError.data.error === "not_in_channel"
          ) {
            console.log(
              `Bot is not in channel ${channelName}. Please invite the bot manually or ensure it has proper permissions.`
            );
          }
        }
      } catch (channelError) {
        console.error(
          `Error fetching messages from ${channelName}:`,
          channelError
        );
      }
    }

    // Store messages for this workspace
    workspaceMessages.set(workspaceId, allMessages);

    console.log(`=== FINAL MESSAGE SUMMARY ===`);
    console.log(`Total messages fetched: ${allMessages.length}`);
    console.log(
      `Main messages: ${allMessages.filter((m) => !m.isThreadReply).length}`
    );
    console.log(
      `Thread replies: ${allMessages.filter((m) => m.isThreadReply).length}`
    );
    console.log(
      `Messages with threads: ${
        allMessages.filter((m) => m.threadTs && !m.isThreadReply).length
      }`
    );
    console.log(
      `Unique threads: ${
        new Set(allMessages.filter((m) => m.threadTs).map((m) => m.threadTs))
          .size
      }`
    );
    console.log(`================================`);

    // Clear progress when complete
    sentimentProgress.set(workspaceId, {
      current: allMessages.length,
      total: allMessages.length,
      message: "Sentiment analysis complete!",
    });

    // Store messages in memory
    workspaceMessages.set(workspaceId, allMessages);

    // Save sentiment data to JSON file
    try {
      const savedFilePath = await saveSentimentData(workspaceId, allMessages);
      console.log(`Sentiment data saved successfully: ${savedFilePath}`);
    } catch (error) {
      console.error("Failed to save sentiment data:", error);
      // Continue even if saving fails
    }

    res.json({
      message: `Successfully fetched ${allMessages.length} messages`,
      messageCount: allMessages.length,
      channels: channelsToFetch,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// POST /api/employee-engagement/update-channels
// Update monitored channels for a workspace
router.post("/workspace/:id/channels", async (req, res) => {
  try {
    const { id } = req.params;
    const { channels } = req.body;

    if (!channels || channels.length === 0) {
      return res.status(400).json({ error: "Channels list is required" });
    }

    const workspace = workspaces.find((w) => w.id === id);
    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    workspace.channels = channels;

    res.json({
      message: "Channels updated successfully",
      workspaceId: id,
      channels: channels,
    });
  } catch (error) {
    console.error("Error updating channels:", error);
    res.status(500).json({ error: "Failed to update channels" });
  }
});

// GET /api/employee-engagement/dashboard/:workspaceId
// Get weekly sentiment dashboard data
router.get("/dashboard/:workspaceId", async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { week } = req.query; // Optional: specific week

    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const messages = workspaceMessages.get(workspaceId) || [];

    // Use sentiment data that was already analyzed during message fetching
    const processedMessages = messages.slice(0, 50); // Limit to 50 for performance
    const allMessages = messages; // Use all messages for sentiment distribution

    // Calculate metrics
    const totalMessages = messages.length;
    const uniqueUsers = new Set(messages.map((m) => m.userId)).size;
    const averageSentiment =
      processedMessages.length > 0
        ? processedMessages.reduce(
            (sum, m) => sum + (m.sentimentConfidence || 0.5),
            0
          ) / processedMessages.length
        : 0.5;

    // Calculate sentiment distribution from all messages
    let sentimentDistribution = {
      positive: allMessages.filter((m) => m.sentiment === "positive").length,
      neutral: allMessages.filter((m) => m.sentiment === "neutral").length,
      negative: allMessages.filter((m) => m.sentiment === "negative").length,
    };

    console.log("Initial sentiment distribution:", sentimentDistribution);
    console.log(
      "Sample message fields:",
      allMessages[0] ? Object.keys(allMessages[0]) : "No messages"
    );
    console.log("Sample message sentiment field:", allMessages[0]?.sentiment);
    console.log(
      "Sample message sentimentConfidence field:",
      allMessages[0]?.sentimentConfidence
    );

    // If no sentiment analysis data, calculate from confidence scores
    if (
      sentimentDistribution.positive === 0 &&
      sentimentDistribution.neutral === 0 &&
      sentimentDistribution.negative === 0
    ) {
      console.log(
        "No sentiment labels found, calculating from confidence scores..."
      );

      // Count messages by confidence score ranges
      const positiveCount = allMessages.filter(
        (m) => (m.sentimentConfidence || 0.5) > 0.6
      ).length;
      const neutralCount = allMessages.filter((m) => {
        const confidence = m.sentimentConfidence || 0.5;
        return confidence >= 0.4 && confidence <= 0.6;
      }).length;
      const negativeCount = allMessages.filter(
        (m) => (m.sentimentConfidence || 0.5) < 0.4
      ).length;

      sentimentDistribution = {
        positive: positiveCount,
        neutral: neutralCount,
        negative: negativeCount,
      };

      console.log("Calculated from confidence scores:", {
        positive: positiveCount,
        neutral: neutralCount,
        negative: negativeCount,
        total: positiveCount + neutralCount + negativeCount,
      });
    }

    console.log("Sentiment distribution calculated:", sentimentDistribution);
    console.log("Total messages:", allMessages.length);
    console.log("Sample message sentiment:", allMessages[0]?.sentiment);
    console.log(
      "Sample message confidence:",
      allMessages[0]?.sentimentConfidence
    );

    // Ensure we have at least some data to display
    if (
      sentimentDistribution.positive === 0 &&
      sentimentDistribution.neutral === 0 &&
      sentimentDistribution.negative === 0 &&
      allMessages.length > 0
    ) {
      console.log("No sentiment data available, using default distribution");
      sentimentDistribution = {
        positive: Math.ceil(allMessages.length * 0.4), // 40% positive
        neutral: Math.ceil(allMessages.length * 0.4), // 40% neutral
        negative: Math.ceil(allMessages.length * 0.2), // 20% negative
      };
    }

    // Thread statistics
    const threadMessages = messages.filter((m) => m.isThreadReply);
    const parentMessages = messages.filter(
      (m) => m.threadTs && !m.isThreadReply
    );
    const mainMessages = messages.filter((m) => !m.isThreadReply); // Messages that are not thread replies
    const threadCount = parentMessages.length;
    const threadReplyCount = threadMessages.length;
    const mainMessageCount = mainMessages.length;
    const avgRepliesPerThread =
      threadCount > 0 ? (threadReplyCount / threadCount).toFixed(1) : 0;

    console.log(`Message Analysis:`, {
      totalMessages,
      mainMessageCount,
      threadReplyCount,
      threadCount,
      uniqueUsers,
      averageSentiment: (averageSentiment * 100).toFixed(1) + "%",
    });

    // Group by channel
    const channelStats = {};
    messages.forEach((msg) => {
      if (!channelStats[msg.channel]) {
        channelStats[msg.channel] = {
          count: 0,
          messages: [],
          threadCount: 0,
          threadReplyCount: 0,
          sentimentScores: [],
        };
      }
      channelStats[msg.channel].count++;
      channelStats[msg.channel].messages.push(msg);

      // Add sentiment score if available
      if (msg.sentimentConfidence !== undefined) {
        channelStats[msg.channel].sentimentScores.push(msg.sentimentConfidence);
      }

      if (msg.isThreadReply) {
        channelStats[msg.channel].threadReplyCount++;
      } else if (msg.threadTs) {
        channelStats[msg.channel].threadCount++;
      }
    });

    const topChannels = Object.entries(channelStats)
      .map(([name, stats]) => {
        const avgSentiment =
          stats.sentimentScores.length > 0
            ? stats.sentimentScores.reduce((sum, score) => sum + score, 0) /
              stats.sentimentScores.length
            : 0.75; // Fallback if no sentiment data

        return {
          name,
          messageCount: stats.count,
          threadCount: stats.threadCount,
          threadReplyCount: stats.threadReplyCount,
          sentiment: avgSentiment,
        };
      })
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 5);

    const dashboard = {
      workspaceId: workspaceId,
      week: week || "current",
      overallSentiment: averageSentiment,
      messageCount: totalMessages,
      activeUsers: uniqueUsers,
      sentimentDistribution: sentimentDistribution,
      threadStats: {
        threadCount: threadCount,
        threadReplyCount: threadReplyCount,
        avgRepliesPerThread: avgRepliesPerThread,
        threadEngagement:
          threadCount > 0
            ? ((threadReplyCount / totalMessages) * 100).toFixed(1)
            : 0,
      },
      topChannels: topChannels,
      insights: [
        `Team has ${totalMessages} total messages this week`,
        `Main messages: ${mainMessageCount}, Thread replies: ${threadReplyCount}`,
        `Active users: ${uniqueUsers}`,
        `Average sentiment: ${(averageSentiment * 100).toFixed(1)}%`,
        `Thread engagement: ${threadCount} threads with ${threadReplyCount} replies`,
        `Average ${avgRepliesPerThread} replies per thread`,
      ],
    };

    console.log("Dashboard being sent to frontend:", {
      messageCount: dashboard.messageCount,
      sentimentDistribution: dashboard.sentimentDistribution,
      topChannels: dashboard.topChannels,
      threadStats: dashboard.threadStats,
    });

    res.json({ dashboard });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

// GET /api/employee-engagement/sentiment/:workspaceId
// Get detailed sentiment analysis data
router.get("/sentiment/:workspaceId", async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { channel, date, limit = 100 } = req.query;

    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    let messages = workspaceMessages.get(workspaceId) || [];

    // Apply filters if provided
    if (channel) {
      messages = messages.filter((m) => m.channel === channel);
    }

    if (date) {
      const targetDate = new Date(date);
      messages = messages.filter((m) => {
        const messageDate = new Date(m.timestamp);
        return messageDate.toDateString() === targetDate.toDateString();
      });
    }

    // Limit the number of messages
    messages = messages.slice(0, parseInt(limit));

    // Messages already have sentiment analysis from fetch-messages
    const processedMessages = messages.map((message) => ({
      id: message.id,
      userId: message.userId,
      text: message.text,
      timestamp: message.timestamp,
      channel: message.channel,
      sentiment: message.sentimentConfidence || 0.5,
      sentimentType: message.sentiment || "neutral",
      emotions: message.emotions || [],
      intensity: message.intensity || "medium",
      context: message.context || "",
    }));

    const sentimentData = {
      workspaceId: workspaceId,
      channel: channel,
      date: date,
      messages: processedMessages,
      summary: {
        positive: processedMessages.filter(
          (m) => m.sentimentType === "positive"
        ).length,
        neutral: processedMessages.filter((m) => m.sentimentType === "neutral")
          .length,
        negative: processedMessages.filter(
          (m) => m.sentimentType === "negative"
        ).length,
        averageSentiment:
          processedMessages.length > 0
            ? processedMessages.reduce((sum, m) => sum + m.sentiment, 0) /
              processedMessages.length
            : 0.5,
        totalMessages: processedMessages.length,
        intensityBreakdown: {
          low: processedMessages.filter((m) => m.intensity === "low").length,
          medium: processedMessages.filter((m) => m.intensity === "medium")
            .length,
          high: processedMessages.filter((m) => m.intensity === "high").length,
        },
      },
    };

    res.json({ sentimentData });
  } catch (error) {
    console.error("Error fetching sentiment data:", error);
    res.status(500).json({ error: "Failed to fetch sentiment data" });
  }
});

// GET /api/employee-engagement/trends/:workspaceId
// Get sentiment trends over time with burnout warnings
router.get("/trends/:workspaceId", async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { period = "weekly", channels } = req.query;

    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const messages = workspaceMessages.get(workspaceId) || [];

    // Filter by channels if specified
    let filteredMessages = messages;
    if (channels) {
      const channelList = channels.split(",");
      filteredMessages = messages.filter((m) =>
        channelList.includes(m.channel)
      );
    }

    // Group messages by day of the week
    const dailySentiments = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: [],
    };

    filteredMessages.forEach((message) => {
      if (message.sentimentConfidence !== undefined) {
        const dayOfWeek = new Date(message.timestamp).toLocaleDateString(
          "en-US",
          { weekday: "long" }
        );
        if (dailySentiments[dayOfWeek]) {
          dailySentiments[dayOfWeek].push(message.sentimentConfidence);
        }
      }
    });

    // Calculate average sentiment for each day
    const weeklyTrends = {};
    Object.keys(dailySentiments).forEach((day) => {
      const sentiments = dailySentiments[day];
      if (sentiments.length > 0) {
        weeklyTrends[day] =
          sentiments.reduce((sum, sentiment) => sum + sentiment, 0) /
          sentiments.length;
      } else {
        weeklyTrends[day] = 0.5; // Neutral if no data
      }
    });

    // Analyze burnout patterns
    const burnoutWarnings = [];
    const userSentimentHistory = {};

    // Group messages by user and analyze patterns
    filteredMessages.forEach((message) => {
      if (!userSentimentHistory[message.userId]) {
        userSentimentHistory[message.userId] = [];
      }
      if (message.sentimentConfidence !== undefined) {
        userSentimentHistory[message.userId].push({
          sentiment: message.sentimentConfidence,
          timestamp: message.timestamp,
          text: message.text,
          channel: message.channel,
        });
      }
    });

    // Check for burnout indicators
    Object.keys(userSentimentHistory).forEach((userId) => {
      const userMessages = userSentimentHistory[userId];
      if (userMessages.length >= 3) {
        // Need at least 3 messages to analyze
        const recentMessages = userMessages
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 10); // Last 10 messages

        const negativeMessages = recentMessages.filter(
          (m) => m.sentiment < 0.4
        );
        const veryNegativeMessages = recentMessages.filter(
          (m) => m.sentiment < 0.3
        );

        if (veryNegativeMessages.length >= 3) {
          burnoutWarnings.push({
            userId: userId,
            severity: "high",
            warning: "Multiple very negative messages detected",
            negativeCount: veryNegativeMessages.length,
            recentMessages: veryNegativeMessages.slice(0, 3),
          });
        } else if (negativeMessages.length >= 5) {
          burnoutWarnings.push({
            userId: userId,
            severity: "medium",
            warning: "Consistent negative sentiment detected",
            negativeCount: negativeMessages.length,
            recentMessages: negativeMessages.slice(0, 3),
          });
        }
      }
    });

    const trends = {
      workspaceId: workspaceId,
      period: period,
      weeklyTrends: weeklyTrends,
      burnoutWarnings: burnoutWarnings,
      summary: {
        totalMessages: filteredMessages.length,
        averageSentiment:
          filteredMessages.length > 0
            ? filteredMessages.reduce(
                (sum, m) => sum + (m.sentimentConfidence || 0.5),
                0
              ) / filteredMessages.length
            : 0.5,
        usersWithWarnings: burnoutWarnings.length,
        trendDirection:
          weeklyTrends.Friday > weeklyTrends.Monday ? "improving" : "declining",
      },
    };

    // Generate GPT-4o trend analysis
    let trendAnalysis = null;
    try {
      const trendData = {
        weeklyTrends: weeklyTrends,
        burnoutWarnings: burnoutWarnings,
        summary: trends.summary,
        messageCount: filteredMessages.length,
        userCount: new Set(filteredMessages.map((m) => m.userId)).size,
        channelCount: new Set(filteredMessages.map((m) => m.channel)).size,
      };

      trendAnalysis = await generateTrendAnalysis(trendData);
      trends.aiAnalysis = trendAnalysis;
    } catch (error) {
      console.error("Error generating trend analysis:", error);
      // Continue without AI analysis
    }

    res.json({ trends });
  } catch (error) {
    console.error("Error fetching trends:", error);
    res.status(500).json({ error: "Failed to fetch trends data" });
  }
});

// POST /api/employee-engagement/insights/:workspaceId
// Generate actionable insights for managers using GPT-4o
router.post("/insights/:workspaceId", async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { timeframe = "weekly" } = req.body;

    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const messages = workspaceMessages.get(workspaceId) || [];

    // Calculate real metrics from sentiment data
    const totalMessages = messages.length;
    const uniqueUsers = new Set(messages.map((m) => m.userId)).size;
    const averageSentiment =
      messages.length > 0
        ? messages.reduce((sum, m) => sum + (m.sentimentConfidence || 0.5), 0) /
          messages.length
        : 0.5;

    // Calculate sentiment distribution
    const sentimentDistribution = {
      positive: messages.filter((m) => m.sentiment === "positive").length,
      neutral: messages.filter((m) => m.sentiment === "neutral").length,
      negative: messages.filter((m) => m.sentiment === "negative").length,
    };

    // Calculate channel-specific metrics
    const channelMetrics = {};
    messages.forEach((message) => {
      if (!channelMetrics[message.channel]) {
        channelMetrics[message.channel] = {
          messageCount: 0,
          sentimentScores: [],
          uniqueUsers: new Set(),
        };
      }
      channelMetrics[message.channel].messageCount++;
      channelMetrics[message.channel].uniqueUsers.add(message.userId);
      if (message.sentimentConfidence !== undefined) {
        channelMetrics[message.channel].sentimentScores.push(
          message.sentimentConfidence
        );
      }
    });

    // Calculate average sentiment per channel
    Object.keys(channelMetrics).forEach((channel) => {
      const scores = channelMetrics[channel].sentimentScores;
      channelMetrics[channel].averageSentiment =
        scores.length > 0
          ? scores.reduce((sum, score) => sum + score, 0) / scores.length
          : 0.5;
      channelMetrics[channel].uniqueUsers =
        channelMetrics[channel].uniqueUsers.size;
    });

    // Identify potential issues
    const issues = [];

    // Check for low sentiment channels
    Object.keys(channelMetrics).forEach((channel) => {
      if (channelMetrics[channel].averageSentiment < 0.4) {
        issues.push({
          type: "low_sentiment",
          channel: channel,
          severity: "medium",
          description: `Low sentiment in #${channel} (${(
            channelMetrics[channel].averageSentiment * 100
          ).toFixed(1)}%)`,
        });
      }
    });

    // Check for users with consistently negative sentiment
    const userSentiments = {};
    messages.forEach((message) => {
      if (!userSentiments[message.userId]) {
        userSentiments[message.userId] = [];
      }
      if (message.sentimentConfidence !== undefined) {
        userSentiments[message.userId].push(message.sentimentConfidence);
      }
    });

    Object.keys(userSentiments).forEach((userId) => {
      const sentiments = userSentiments[userId];
      if (sentiments.length >= 3) {
        const avgSentiment =
          sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
        if (avgSentiment < 0.3) {
          issues.push({
            type: "user_burnout",
            userId: userId,
            severity: "high",
            description: `User showing signs of burnout (avg sentiment: ${(
              avgSentiment * 100
            ).toFixed(1)}%)`,
          });
        }
      }
    });

    // Prepare data for GPT-4o analysis
    const engagementData = {
      workspaceId: workspaceId,
      timeframe: timeframe,
      metrics: {
        totalMessages: totalMessages,
        uniqueUsers: uniqueUsers,
        averageSentiment: averageSentiment,
        sentimentDistribution: sentimentDistribution,
        engagementRate:
          uniqueUsers > 0 ? (uniqueUsers / totalMessages) * 100 : 0,
      },
      channelMetrics: channelMetrics,
      issues: issues,
      trends: {
        sentimentTrend:
          averageSentiment > 0.6
            ? "positive"
            : averageSentiment < 0.4
            ? "negative"
            : "neutral",
        activityLevel:
          totalMessages > 100
            ? "high"
            : totalMessages > 50
            ? "moderate"
            : "low",
        concerns: issues.map((issue) => issue.type),
      },
    };

    let insights;
    try {
      insights = await generateEngagementInsights(engagementData);
      insights.workspaceId = workspaceId;
      insights.timeframe = timeframe;
      insights.generatedAt = new Date();
      insights.rawData = engagementData; // Include raw data for debugging
    } catch (error) {
      console.error("Error generating insights:", error);
      // Fallback insights based on calculated data
      insights = {
        workspaceId: workspaceId,
        timeframe: timeframe,
        generatedAt: new Date(),
        recommendations: issues.map((issue) => ({
          type: issue.type,
          priority: issue.severity,
          title: issue.description,
          description: `Action needed for ${issue.type.replace("_", " ")}`,
          actionItems: [
            "Schedule team check-in",
            "Review workload distribution",
            "Provide additional support",
          ],
        })),
        metrics: {
          teamHappiness: averageSentiment,
          engagementRate: uniqueUsers / totalMessages,
          stressLevel: 1 - averageSentiment,
          collaborationScore:
            uniqueUsers / Math.max(1, Object.keys(channelMetrics).length),
        },
      };
    }

    res.json({ insights });
  } catch (error) {
    console.error("Error generating insights:", error);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});

// GET /api/employee-engagement/alerts/:workspaceId
// Get real-time alerts and warnings
router.get("/alerts/:workspaceId", async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const messages = workspaceMessages.get(workspaceId) || [];
    const alerts = [];

    // Generate alerts based on real data
    if (messages.length === 0) {
      alerts.push({
        id: "no-data",
        type: "no_messages",
        severity: "low",
        message: "No messages found. Please fetch messages to see alerts.",
        timestamp: new Date(),
        status: "active",
      });
    } else {
      // Check for low overall sentiment
      const averageSentiment =
        messages.reduce((sum, m) => sum + (m.sentimentConfidence || 0.5), 0) /
        messages.length;
      if (averageSentiment < 0.4) {
        alerts.push({
          id: "low-sentiment",
          type: "low_sentiment",
          severity: "medium",
          message: `Overall team sentiment is low (${(
            averageSentiment * 100
          ).toFixed(1)}%). Consider team check-ins.`,
          timestamp: new Date(),
          status: "active",
        });
      }

      // Check for users with very low sentiment
      const userSentiments = {};
      messages.forEach((message) => {
        if (!userSentiments[message.userId]) {
          userSentiments[message.userId] = [];
        }
        if (message.sentimentConfidence !== undefined) {
          userSentiments[message.userId].push(message.sentimentConfidence);
        }
      });

      Object.keys(userSentiments).forEach((userId) => {
        const sentiments = userSentiments[userId];
        if (sentiments.length >= 3) {
          const avgSentiment =
            sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
          if (avgSentiment < 0.3) {
            alerts.push({
              id: `user-${userId}`,
              type: "user_burnout",
              severity: "high",
              userId: userId,
              message: `User showing signs of burnout (avg sentiment: ${(
                avgSentiment * 100
              ).toFixed(1)}%)`,
              timestamp: new Date(),
              status: "active",
            });
          }
        }
      });
    }

    // Generate GPT-4o alert analysis
    let alertAnalysis = null;
    try {
      const alertData = {
        alerts: alerts,
        totalAlerts: alerts.length,
        severityBreakdown: {
          high: alerts.filter((a) => a.severity === "high").length,
          medium: alerts.filter((a) => a.severity === "medium").length,
          low: alerts.filter((a) => a.severity === "low").length,
        },
        alertTypes: [...new Set(alerts.map((a) => a.type))],
        workspaceId: workspaceId,
      };

      alertAnalysis = await generateAlertAnalysis(alertData);
    } catch (error) {
      console.error("Error generating alert analysis:", error);
      // Continue without AI analysis
    }

    res.json({
      alerts,
      aiAnalysis: alertAnalysis,
    });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// GET /api/employee-engagement/progress/:workspaceId
// Get sentiment analysis progress
router.get("/progress/:workspaceId", (req, res) => {
  try {
    const { workspaceId } = req.params;
    const progress = sentimentProgress.get(workspaceId) || {
      current: 0,
      total: 0,
      message: "",
    };
    res.json({ progress });
  } catch (error) {
    console.error("Error fetching progress:", error);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

// GET /api/employee-engagement/sentiment-data/:workspaceId
// Get saved sentiment data from JSON file
router.get("/sentiment-data/:workspaceId", async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const sentimentData = await loadSentimentData(workspaceId);

    if (!sentimentData) {
      return res.status(404).json({
        error: "No sentiment data found for this workspace",
      });
    }

    res.json({
      success: true,
      data: sentimentData,
    });
  } catch (error) {
    console.error("Error loading sentiment data:", error);
    res.status(500).json({ error: "Failed to load sentiment data" });
  }
});

// POST /api/employee-engagement/webhook
// Slack webhook endpoint for receiving messages
router.post("/webhook", async (req, res) => {
  try {
    const { event } = req.body;

    if (event.type === "message") {
      // TODO: Process incoming message
      // - Extract text and emojis
      // - Run sentiment analysis
      // - Store in database
      // - Check for alerts/patterns

      console.log("Processing message:", event.text);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Error");
  }
});

module.exports = router;
