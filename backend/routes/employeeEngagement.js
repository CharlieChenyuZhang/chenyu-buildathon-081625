const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { WebClient } = require("@slack/web-api");
const {
  analyzeSentiment,
  generateEngagementInsights,
} = require("../utils/openai");

const router = express.Router();

// In-memory storage for workspaces (in production, use a database)
let workspaces = [];
let workspaceMessages = new Map(); // workspaceId -> messages

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
            const channelMessages = messagesResult.messages
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
              totalMainMessages: channelMessages.length,
              messagesWithThreads: channelMessages.filter((m) => m.threadTs)
                .length,
              messagesWithoutThreads: channelMessages.filter((m) => !m.threadTs)
                .length,
            });

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
                    const threadReplies = replies
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

                    threadMessages.push(...threadReplies);
                    console.log(
                      `Fetched ${threadReplies.length} thread replies for message ${message.id}`
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

    // Analyze sentiment for messages if not already done
    const processedMessages = [];
    for (const message of messages.slice(0, 50)) {
      // Limit to 50 for performance
      try {
        const sentimentResult = await analyzeSentiment(message.text);
        processedMessages.push({
          ...message,
          sentiment: sentimentResult.confidence,
          sentimentType: sentimentResult.sentiment,
          emotions: sentimentResult.emotions || [],
        });
      } catch (error) {
        console.error("Error analyzing sentiment for message:", error);
        processedMessages.push({
          ...message,
          sentiment: 0.5,
          sentimentType: "neutral",
          emotions: [],
        });
      }
    }

    // Calculate metrics
    const totalMessages = messages.length;
    const uniqueUsers = new Set(messages.map((m) => m.userId)).size;
    const averageSentiment =
      processedMessages.length > 0
        ? processedMessages.reduce((sum, m) => sum + m.sentiment, 0) /
          processedMessages.length
        : 0.5;

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
        };
      }
      channelStats[msg.channel].count++;
      channelStats[msg.channel].messages.push(msg);

      if (msg.isThreadReply) {
        channelStats[msg.channel].threadReplyCount++;
      } else if (msg.threadTs) {
        channelStats[msg.channel].threadCount++;
      }
    });

    const topChannels = Object.entries(channelStats)
      .map(([name, stats]) => ({
        name,
        messageCount: stats.count,
        threadCount: stats.threadCount,
        threadReplyCount: stats.threadReplyCount,
        sentiment: 0.75, // Placeholder - would calculate from actual sentiment data
      }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 5);

    const dashboard = {
      workspaceId: workspaceId,
      week: week || "current",
      overallSentiment: averageSentiment,
      messageCount: totalMessages,
      activeUsers: uniqueUsers,
      threadStats: {
        threadCount: threadCount,
        threadReplyCount: threadReplyCount,
        avgRepliesPerThread: avgRepliesPerThread,
        threadEngagement:
          threadCount > 0
            ? ((threadReplyCount / totalMessages) * 100).toFixed(1)
            : 0,
      },
      trends: {
        monday: 0.72,
        tuesday: 0.78,
        wednesday: 0.81,
        thursday: 0.69,
        friday: 0.74,
      },
      topChannels: topChannels,
      burnoutWarnings: [
        {
          userId: "U123456",
          username: "john.doe",
          warning: "High stress indicators detected",
          severity: "medium",
        },
      ],
      insights: [
        `Team has ${totalMessages} total messages this week`,
        `Main messages: ${mainMessageCount}, Thread replies: ${threadReplyCount}`,
        `Active users: ${uniqueUsers}`,
        `Average sentiment: ${(averageSentiment * 100).toFixed(1)}%`,
        `Thread engagement: ${threadCount} threads with ${threadReplyCount} replies`,
        `Average ${avgRepliesPerThread} replies per thread`,
      ],
    };

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

    // TODO: Fetch sentiment data with filters and process with GPT-4
    const mockMessages = [
      {
        id: "1",
        userId: "U123456",
        username: "john.doe",
        text: "Great work on the new feature!",
        timestamp: new Date(),
        channel: "general",
      },
      {
        id: "2",
        userId: "U789012",
        username: "jane.smith",
        text: "This bug is really frustrating",
        timestamp: new Date(),
        channel: "engineering",
      },
    ];

    // Process messages with GPT-4 sentiment analysis
    const processedMessages = [];
    for (const message of mockMessages) {
      try {
        const sentimentResult = await analyzeSentiment(message.text);
        processedMessages.push({
          ...message,
          sentiment: sentimentResult.confidence,
          sentimentType: sentimentResult.sentiment,
          emotions: sentimentResult.emotions || [],
        });
      } catch (error) {
        console.error("Error analyzing sentiment for message:", error);
        processedMessages.push({
          ...message,
          sentiment: 0.5,
          sentimentType: "neutral",
          emotions: [],
        });
      }
    }

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
          processedMessages.reduce((sum, m) => sum + m.sentiment, 0) /
          processedMessages.length,
      },
    };

    res.json({ sentimentData });
  } catch (error) {
    console.error("Error fetching sentiment data:", error);
    res.status(500).json({ error: "Failed to fetch sentiment data" });
  }
});

// GET /api/employee-engagement/trends/:workspaceId
// Get sentiment trends over time
router.get("/trends/:workspaceId", async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { period = "weekly", channels } = req.query;

    // TODO: Calculate trends from database
    const trends = {
      workspaceId: workspaceId,
      period: period,
      data: [
        {
          date: "2024-01-01",
          overallSentiment: 0.72,
          messageCount: 1200,
          channelBreakdown: {
            general: 0.75,
            engineering: 0.8,
            random: 0.65,
          },
        },
        {
          date: "2024-01-08",
          overallSentiment: 0.78,
          messageCount: 1350,
          channelBreakdown: {
            general: 0.78,
            engineering: 0.85,
            random: 0.7,
          },
        },
      ],
    };

    res.json({ trends });
  } catch (error) {
    console.error("Error fetching trends:", error);
    res.status(500).json({ error: "Failed to fetch trends data" });
  }
});

// POST /api/employee-engagement/insights/:workspaceId
// Generate actionable insights for managers
router.post("/insights/:workspaceId", async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { timeframe = "weekly" } = req.body;

    // Generate insights using GPT-4
    const engagementData = {
      workspaceId: workspaceId,
      timeframe: timeframe,
      metrics: {
        teamHappiness: 0.75,
        engagementRate: 0.68,
        stressLevel: 0.45,
        collaborationScore: 0.82,
      },
      trends: {
        sentimentTrend: "improving",
        activityLevel: "moderate",
        concerns: ["workload", "communication"],
      },
    };

    let insights;
    try {
      insights = await generateEngagementInsights(engagementData);
      insights.workspaceId = workspaceId;
      insights.timeframe = timeframe;
      insights.generatedAt = new Date();
    } catch (error) {
      console.error("Error generating insights:", error);
      // Fallback to mock insights if AI generation fails
      insights = {
        workspaceId: workspaceId,
        timeframe: timeframe,
        generatedAt: new Date(),
        recommendations: [
          {
            type: "morale",
            priority: "high",
            title: "Address workload concerns",
            description:
              "Engineering team shows signs of stress. Consider redistributing tasks.",
            actionItems: [
              "Schedule 1:1 meetings with stressed team members",
              "Review current sprint commitments",
              "Consider adding more resources to high-priority projects",
            ],
          },
          {
            type: "engagement",
            priority: "medium",
            title: "Boost general channel engagement",
            description:
              "General channel activity has decreased 20% this week.",
            actionItems: [
              "Post more team updates and announcements",
              "Encourage social interactions",
              "Recognize team achievements publicly",
            ],
          },
        ],
        metrics: {
          teamHappiness: 0.75,
          engagementRate: 0.68,
          stressLevel: 0.45,
          collaborationScore: 0.82,
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

    // TODO: Fetch active alerts from database
    const alerts = [
      {
        id: "1",
        type: "burnout_warning",
        severity: "high",
        userId: "U123456",
        username: "john.doe",
        message:
          "User showing signs of burnout - 5 negative messages in 2 hours",
        timestamp: new Date(),
        status: "active",
      },
      {
        id: "2",
        type: "low_engagement",
        severity: "medium",
        channel: "general",
        message: "General channel engagement dropped 30% today",
        timestamp: new Date(),
        status: "active",
      },
    ];

    res.json({ alerts });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
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
