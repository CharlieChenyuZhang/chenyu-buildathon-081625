const express = require("express");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const simpleGit = require("simple-git");
const OpenAI = require("openai");
const { analyzeCodeChanges } = require("../utils/openai");

// ⚠️ APP RUNNER DEPLOYMENT WARNING ⚠️
// This code uses in-memory storage which will NOT work properly in App Runner:
// - Containers can restart anytime, losing all data
// - Multiple instances won't share data
// - No persistence across deployments
//
// PRODUCTION SOLUTIONS NEEDED:
// 1. Replace Map() storage with database (DynamoDB, RDS, etc.)
// 2. Use S3 for temporary file storage instead of local filesystem
// 3. Implement proper job queue (SQS + Lambda, or Step Functions)
// 4. Add proper error handling for container restarts
//
// For now, this is suitable for development/testing only.

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const router = express.Router();

// Storage for analyses (in production, use a database)
const analyses = new Map();
const analysisResults = new Map();

// Track container startup for App Runner
const containerStartTime = new Date();
console.log(`🚀 Container started at: ${containerStartTime.toISOString()}`);
console.log(
  `⚠️  WARNING: Using in-memory storage - data will be lost on container restart`
);

// POST /api/codebase-time-machine/analyze-repo
// Clone and analyze a repository
router.post("/analyze-repo", async (req, res) => {
  try {
    const {
      repoUrl,
      branch = "main",
      maxCommits = 1000,
      timeRange = "all",
    } = req.body;

    if (!repoUrl) {
      return res.status(400).json({ error: "Repository URL is required" });
    }

    // Validate repository URL
    if (
      !repoUrl.includes("github.com") &&
      !repoUrl.includes("gitlab.com") &&
      !repoUrl.includes("bitbucket.org")
    ) {
      return res.status(400).json({
        error:
          "Please provide a valid GitHub, GitLab, or Bitbucket repository URL",
      });
    }

    // Quick repository accessibility check before starting analysis
    try {
      console.log(`🔍 Pre-checking repository: ${repoUrl}`);
      const git = simpleGit();
      await git.listRemote([repoUrl]);
      console.log(`✅ Repository pre-check passed`);
    } catch (preCheckError) {
      console.error(`❌ Repository pre-check failed: ${preCheckError.message}`);
      return res.status(400).json({
        error: `Repository not accessible: ${preCheckError.message}. Please ensure the repository is public and the URL is correct.`,
        details: {
          repoUrl,
          error: preCheckError.message,
        },
      });
    }

    const analysisId = uuidv4();
    const analysis = {
      id: analysisId,
      repoUrl: repoUrl,
      branch: branch,
      maxCommits: maxCommits,
      timeRange: timeRange,
      status: "processing",
      startedAt: new Date(),
      metrics: {
        totalCommits: 0,
        totalFiles: 0,
        contributors: 0,
        timeRange: {
          firstCommit: null,
          lastCommit: null,
        },
      },
    };

    analyses.set(analysisId, analysis);

    // Clear any existing analysis results for this repository URL
    // This prevents showing old data when analyzing the same repo again
    for (const [existingId, existingAnalysis] of analyses.entries()) {
      if (existingAnalysis.repoUrl === repoUrl && existingId !== analysisId) {
        analysisResults.delete(existingId);
        console.log(`Cleared old analysis results for ${repoUrl}`);
      }
    }

    // Start analysis in background
    performRepositoryAnalysis(
      analysisId,
      repoUrl,
      branch,
      maxCommits,
      timeRange
    );

    res.json({
      message: "Repository analysis started",
      analysis: analysis,
    });
  } catch (error) {
    console.error("Repository analysis error:", error);
    res.status(500).json({ error: "Failed to start repository analysis" });
  }
});

// Helper function to get total commits in repository
async function getTotalCommitsInRepo(repoGit) {
  try {
    const totalLog = await repoGit.log({ maxCount: 0 });
    return totalLog.total;
  } catch (error) {
    console.warn("Could not get total commits:", error.message);
    return null;
  }
}

// Background function to perform repository analysis
async function performRepositoryAnalysis(
  analysisId,
  repoUrl,
  branch,
  maxCommits,
  timeRange
) {
  const analysis = analyses.get(analysisId);
  const tempDir = path.join(__dirname, "../temp", analysisId);

  try {
    // Check if we can write to the filesystem (App Runner limitation)
    const testDir = path.join(__dirname, "../temp");
    try {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
        console.log(`✅ Filesystem write access confirmed`);
      }
    } catch (fsError) {
      console.error(`❌ Filesystem write access failed: ${fsError.message}`);
      analysis.status = "failed";
      analysis.error =
        "App Runner filesystem limitation: Cannot create temporary directories. Consider using S3 for file storage.";
      return;
    }

    // Create temp directory
    if (!fs.existsSync(path.dirname(tempDir))) {
      fs.mkdirSync(path.dirname(tempDir), { recursive: true });
    }

    // Clone repository with full history for better analysis
    const git = simpleGit();
    let cloneSuccess = false;

    // First, try to check if the repository is accessible
    try {
      console.log(`Checking repository accessibility: ${repoUrl}`);
      // Try to get repository info without cloning
      const repoInfo = await git.listRemote([repoUrl]);
      console.log(
        `Repository is accessible. Available refs: ${repoInfo
          .split("\n")
          .slice(0, 5)
          .join(", ")}...`
      );
    } catch (accessError) {
      console.log(`Repository access check failed: ${accessError.message}`);
      // Continue with cloning attempt anyway
    }

    // Try to clone with the specified branch first
    try {
      console.log(`Attempting to clone ${repoUrl} with branch '${branch}'...`);
      await git.clone(repoUrl, tempDir, ["-b", branch]);
      cloneSuccess = true;
      console.log(`Successfully cloned with branch '${branch}'`);
    } catch (error) {
      console.log(`Failed to clone with branch '${branch}': ${error.message}`);
      console.log(`Trying default branches...`);

      // Try common default branches
      const defaultBranches = ["main", "master", "develop"];
      for (const defaultBranch of defaultBranches) {
        if (defaultBranch === branch) continue; // Skip if we already tried this branch

        try {
          // Clean up previous attempt
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }

          console.log(`Attempting to clone with branch '${defaultBranch}'...`);
          await git.clone(repoUrl, tempDir, ["-b", defaultBranch]);
          console.log(`Successfully cloned with branch '${defaultBranch}'`);
          cloneSuccess = true;
          break;
        } catch (branchError) {
          console.log(
            `Failed to clone with branch '${defaultBranch}': ${branchError.message}`
          );
        }
      }
    }

    // If all branch-specific clones failed, try cloning without specifying a branch
    if (!cloneSuccess) {
      try {
        console.log(
          `Attempting to clone without specifying branch (will use default)...`
        );
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        await git.clone(repoUrl, tempDir);
        cloneSuccess = true;
        console.log(`Successfully cloned with default branch`);
      } catch (fallbackError) {
        console.log(
          `Failed to clone with default branch: ${fallbackError.message}`
        );
      }
    }

    if (!cloneSuccess) {
      console.error("Failed to clone repository with any method");
      analysis.status = "failed";
      analysis.error =
        "Failed to clone repository. Possible issues:\n" +
        "1. Repository is private and requires authentication\n" +
        "2. Repository URL is incorrect\n" +
        "3. Repository is empty or has no commits\n" +
        "4. Network connectivity issues\n" +
        "Please check the repository URL and ensure it's publicly accessible.";

      // Clean up temp directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      return;
    }

    const repoGit = simpleGit(tempDir);

    // Calculate date range for filtering
    let sinceDate = null;
    if (timeRange !== "all") {
      const now = new Date();
      switch (timeRange) {
        case "last_month":
          sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "last_6months":
          sinceDate = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
          break;
        case "last_year":
          sinceDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    // Get commit history with comprehensive data
    const logOptions = {
      maxCount: maxCommits,
      format: {
        hash: "%H",
        author: "%an",
        authorEmail: "%ae",
        date: "%aI",
        message: "%s",
        body: "%b",
        refs: "%D",
      },
    };

    // Add date filter if specified
    if (sinceDate) {
      logOptions.from = sinceDate.toISOString();
    }

    const log = await repoGit.log(logOptions);

    // Check if repository is empty
    if (log.all.length === 0) {
      console.log("Repository is empty - no commits found");
      analysis.status = "completed";
      analysis.completedAt = new Date();
      analysis.metrics = {
        totalCommits: 0,
        totalFiles: 0,
        contributors: 0,
        timeRange: {
          firstCommit: null,
          lastCommit: null,
        },
      };
      analysis.summary = {
        mostActiveFiles: [],
        topContributors: [],
        majorFeatures: [],
      };
      analysis.error = "Repository is empty - no commits found";

      // Store empty results
      analysisResults.set(analysisId, {
        commits: [],
        contributors: [],
        fileOwnership: [],
        complexity: [],
        features: [],
        insights: ["Repository is empty with no commit history"],
      });

      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
      return;
    }

    // Get file statistics
    const files = await repoGit.raw(["ls-files"]);
    const fileList = files.split("\n").filter((f) => f.trim());

    // Get contributor statistics
    const contributors = new Map();
    const fileOwnership = new Map();
    const commitPatterns = [];

    for (const commit of log.all) {
      // Track contributors
      const author = commit.author;
      if (!contributors.has(author)) {
        contributors.set(author, {
          name: author,
          commits: 0,
          linesAdded: 0,
          linesRemoved: 0,
          filesOwned: new Set(),
          primaryAreas: new Set(),
        });
      }
      contributors.get(author).commits++;

      // Get commit details
      try {
        const commitDetails = await repoGit.show([
          commit.hash,
          "--stat",
          "--format=",
        ]);
        const statMatch = commitDetails.match(
          /(\d+) files? changed(?:, (\d+) insertions?)?(?:, (\d+) deletions?)?/
        );

        if (statMatch) {
          const linesAdded = parseInt(statMatch[2]) || 0;
          const linesRemoved = parseInt(statMatch[3]) || 0;

          contributors.get(author).linesAdded += linesAdded;
          contributors.get(author).linesRemoved += linesRemoved;
        }

        // Get files changed
        const filesChanged = await repoGit.raw([
          "show",
          "--name-only",
          "--format=",
          commit.hash,
        ]);
        const changedFiles = filesChanged.split("\n").filter((f) => f.trim());

        for (const file of changedFiles) {
          contributors.get(author).filesOwned.add(file);

          // Track file ownership
          if (!fileOwnership.has(file)) {
            fileOwnership.set(file, new Map());
          }
          const fileContributors = fileOwnership.get(file);
          fileContributors.set(author, (fileContributors.get(author) || 0) + 1);
        }

        // Analyze commit patterns
        commitPatterns.push({
          hash: commit.hash,
          author: commit.author,
          date: commit.date,
          message: commit.message,
          body: commit.body,
          files: changedFiles,
          linesAdded: parseInt(statMatch[2]) || 0,
          linesRemoved: parseInt(statMatch[3]) || 0,
        });
      } catch (error) {
        console.warn(`Error processing commit ${commit.hash}:`, error.message);
      }
    }

    // Calculate complexity and trends
    const complexityData = calculateComplexityTrends(commitPatterns);

    // Extract business features using AI
    const features = await extractBusinessFeaturesWithAI(commitPatterns);

    // Generate insights
    const insights = await generateInsightsWithAI(
      commitPatterns,
      contributors,
      fileOwnership
    );

    // Update analysis with results
    analysis.status = "completed";
    analysis.completedAt = new Date();
    analysis.metrics = {
      totalCommits: log.all.length,
      totalFiles: fileList.length,
      contributors: contributors.size,
      timeRange: {
        firstCommit: log.all[log.all.length - 1]?.date || null,
        lastCommit: log.all[0]?.date || null,
      },
      analysisScope: {
        maxCommits: maxCommits,
        timeRange: timeRange,
        sinceDate: sinceDate?.toISOString() || null,
        totalCommitsInRepo: await getTotalCommitsInRepo(repoGit),
      },
    };
    analysis.summary = {
      mostActiveFiles: getMostActiveFiles(fileOwnership, 10),
      topContributors: getTopContributors(contributors, 10),
      majorFeatures: features.map((f) => f.name),
    };

    // Store detailed results
    analysisResults.set(analysisId, {
      commits: commitPatterns,
      contributors: Array.from(contributors.values()).map((c) => ({
        ...c,
        filesOwned: c.filesOwned.size,
        primaryAreas: Array.from(c.primaryAreas),
      })),
      fileOwnership: Array.from(fileOwnership.entries()).map(
        ([file, contributors]) => ({
          file,
          contributors: Array.from(contributors.entries()).map(
            ([name, count]) => ({ name, count })
          ),
        })
      ),
      complexity: complexityData,
      features: features,
      insights: insights,
    });

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.error("Analysis failed:", error);
    analysis.status = "failed";
    analysis.error = error.message;

    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

// Helper functions
function calculateComplexityTrends(commits) {
  const monthlyData = new Map();

  for (const commit of commits) {
    const month = commit.date.substring(0, 7); // YYYY-MM
    if (!monthlyData.has(month)) {
      monthlyData.set(month, {
        date: month,
        commitCount: 0,
        filesChanged: 0,
        complexity: 0,
        contributors: new Set(),
        totalLines: 0,
      });
    }

    const data = monthlyData.get(month);
    data.commitCount++;
    data.filesChanged += commit.files.length;
    data.contributors.add(commit.author);
    data.totalLines += commit.linesAdded + commit.linesRemoved;
  }

  // Calculate complexity score
  for (const data of monthlyData.values()) {
    data.complexity = Math.min(
      1,
      (data.filesChanged / data.commitCount) * 0.3 +
        (data.totalLines / data.commitCount) * 0.0001
    );
    data.contributors = data.contributors.size;
  }

  return Array.from(monthlyData.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

// Enhanced feature extraction using AI
async function extractBusinessFeaturesWithAI(commits) {
  try {
    // Group commits by time periods and patterns
    const commitGroups = groupCommitsByPatterns(commits);

    // Use AI to analyze commit groups for business features
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a software architecture analyst. Analyze commit messages and identify business features and architectural decisions.
          
Return a JSON object with this structure:
{
  "features": [
    {
      "name": "Feature Name",
      "description": "What this feature does",
      "commits": ["hash1", "hash2"],
      "timeRange": {"start": "2023-01-01", "end": "2023-02-01"},
      "contributors": ["author1", "author2"],
      "businessValue": "Why this feature matters",
      "complexity": "low|medium|high",
      "category": "auth|payment|ui|api|database|security|infrastructure"
    }
  ],
  "architecturalDecisions": [
    {
      "decision": "Decision made",
      "rationale": "Why this decision was made",
      "impact": "low|medium|high",
      "date": "2023-01-01",
      "commits": ["hash1"]
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Analyze these commits and identify business features:\n${commits
            .slice(0, 50)
            .map(
              (c) =>
                `${c.hash.substring(0, 8)} - ${c.message} (${c.files.join(
                  ", "
                )})`
            )
            .join("\n")}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const aiAnalysis = JSON.parse(response.choices[0].message.content);
    return aiAnalysis.features || [];
  } catch (error) {
    console.error(
      "AI feature extraction failed, falling back to keyword-based:",
      error
    );
    return extractBusinessFeatures(commits);
  }
}

function extractBusinessFeatures(commits) {
  const features = [];
  const featureKeywords = [
    "auth",
    "authentication",
    "login",
    "signup",
    "payment",
    "stripe",
    "billing",
    "api",
    "database",
    "user",
    "admin",
    "dashboard",
    "report",
    "analytics",
    "notification",
    "email",
    "sms",
    "chat",
    "messaging",
    "file",
    "upload",
    "search",
    "filter",
    "sort",
    "export",
    "import",
    "backup",
    "security",
  ];

  // Group commits by feature patterns
  const featureGroups = new Map();

  for (const commit of commits) {
    const message = commit.message.toLowerCase();
    const body = commit.body.toLowerCase();

    for (const keyword of featureKeywords) {
      if (message.includes(keyword) || body.includes(keyword)) {
        if (!featureGroups.has(keyword)) {
          featureGroups.set(keyword, {
            name: keyword.charAt(0).toUpperCase() + keyword.slice(1),
            commits: [],
            timeRange: { start: commit.date, end: commit.date },
            contributors: new Set(),
          });
        }

        const group = featureGroups.get(keyword);
        group.commits.push(commit);
        group.contributors.add(commit.author);

        if (commit.date < group.timeRange.start)
          group.timeRange.start = commit.date;
        if (commit.date > group.timeRange.end)
          group.timeRange.end = commit.date;
      }
    }
  }

  // Convert to features array
  for (const [keyword, group] of featureGroups) {
    if (group.commits.length >= 2) {
      // Only include features with multiple commits
      features.push({
        name: group.name,
        description: `Feature related to ${keyword}`,
        commits: group.commits.map((c) => c.hash),
        timeRange: group.timeRange,
        contributors: Array.from(group.contributors),
        businessValue: determineBusinessValue(keyword),
        complexity: determineComplexity(group.commits),
      });
    }
  }

  return features;
}

function groupCommitsByPatterns(commits) {
  // Group commits by similar patterns and time proximity
  const groups = [];
  const timeWindow = 7 * 24 * 60 * 60 * 1000; // 7 days

  for (const commit of commits) {
    const commitTime = new Date(commit.date).getTime();
    let addedToGroup = false;

    for (const group of groups) {
      const groupTime = new Date(group.commits[0].date).getTime();
      if (Math.abs(commitTime - groupTime) < timeWindow) {
        group.commits.push(commit);
        addedToGroup = true;
        break;
      }
    }

    if (!addedToGroup) {
      groups.push({ commits: [commit] });
    }
  }

  return groups;
}

function determineBusinessValue(keyword) {
  const valueMap = {
    auth: "Security and user management",
    payment: "Revenue generation",
    api: "System integration and extensibility",
    database: "Data persistence and management",
    user: "User experience and engagement",
    admin: "System administration and control",
    dashboard: "Data visualization and insights",
    report: "Business intelligence and analytics",
    notification: "User engagement and communication",
    search: "User experience and content discovery",
    file: "Content management and storage",
    security: "Data protection and compliance",
  };

  return valueMap[keyword] || "Feature enhancement";
}

function determineComplexity(commits) {
  const totalLines = commits.reduce(
    (sum, c) => sum + c.linesAdded + c.linesRemoved,
    0
  );
  const totalFiles = new Set(commits.flatMap((c) => c.files)).size;

  if (totalLines > 1000 || totalFiles > 20) return "high";
  if (totalLines > 500 || totalFiles > 10) return "medium";
  return "low";
}

// Enhanced insights generation using AI
async function generateInsightsWithAI(commits, contributors, fileOwnership) {
  try {
    const analysisData = {
      totalCommits: commits.length,
      contributors: Array.from(contributors.values()).slice(0, 10),
      mostActiveFiles: getMostActiveFiles(fileOwnership, 10),
      commitTrends: calculateCommitTrends(commits),
      recentActivity: getRecentActivity(commits),
      codeQualityMetrics: calculateCodeQualityMetrics(commits),
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a senior software engineering manager analyzing codebase health and team dynamics. 
          
Generate actionable insights from the repository data. Return a JSON array of insights, each being a string that:
- Identifies patterns in development practices
- Highlights potential risks or opportunities
- Provides context about team collaboration
- Suggests areas for improvement
- Notes architectural evolution patterns

Focus on practical, actionable insights that would be valuable to engineering managers.`,
        },
        {
          role: "user",
          content: `Analyze this repository data and generate insights: ${JSON.stringify(
            analysisData
          )}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const aiResult = JSON.parse(response.choices[0].message.content);
    return (
      aiResult.insights ||
      generateInsights(commits, contributors, fileOwnership)
    );
  } catch (error) {
    console.error(
      "AI insights generation failed, falling back to basic insights:",
      error
    );
    return generateInsights(commits, contributors, fileOwnership);
  }
}

function generateInsights(commits, contributors, fileOwnership) {
  const insights = [];

  // Team insights
  const topContributor = Array.from(contributors.values()).sort(
    (a, b) => b.commits - a.commits
  )[0];

  if (topContributor) {
    insights.push(
      `${topContributor.name} is the most active contributor with ${topContributor.commits} commits`
    );
  }

  // Activity insights
  const recentCommits = commits.filter((c) => {
    const commitDate = new Date(c.date);
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return commitDate > monthAgo;
  });

  if (recentCommits.length > 0) {
    insights.push(
      `Recent activity shows ${recentCommits.length} commits in the last month`
    );
  }

  // File insights
  const mostActiveFile = Array.from(fileOwnership.entries()).sort(
    (a, b) => b[1].size - a[1].size
  )[0];

  if (mostActiveFile) {
    insights.push(`${mostActiveFile[0]} is the most frequently modified file`);
  }

  return insights;
}

function calculateCommitTrends(commits) {
  const trends = {};
  const now = new Date();
  const weeks = [];

  for (let i = 0; i < 12; i++) {
    const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const weekCommits = commits.filter((c) => {
      const commitDate = new Date(c.date);
      return commitDate >= weekStart && commitDate <= weekEnd;
    });

    weeks.push({
      week: i,
      commits: weekCommits.length,
      contributors: new Set(weekCommits.map((c) => c.author)).size,
      linesChanged: weekCommits.reduce(
        (sum, c) => sum + c.linesAdded + c.linesRemoved,
        0
      ),
    });
  }

  return weeks.reverse();
}

function getRecentActivity(commits) {
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentCommits = commits.filter((c) => new Date(c.date) > last30Days);

  return {
    totalCommits: recentCommits.length,
    uniqueContributors: new Set(recentCommits.map((c) => c.author)).size,
    avgCommitsPerDay: recentCommits.length / 30,
    mostActiveDay: getMostActiveDay(recentCommits),
  };
}

function getMostActiveDay(commits) {
  const dayCounts = {};
  commits.forEach((c) => {
    const day = new Date(c.date).toLocaleDateString("en-US", {
      weekday: "long",
    });
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });

  return (
    Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "No data"
  );
}

function calculateCodeQualityMetrics(commits) {
  const metrics = {
    avgCommitSize: Math.round(
      commits.reduce((sum, c) => sum + c.linesAdded + c.linesRemoved, 0) /
        commits.length
    ),
    largeCommits: commits.filter((c) => c.linesAdded + c.linesRemoved > 500)
      .length,
    refactorCommits: commits.filter((c) =>
      c.message.toLowerCase().includes("refactor")
    ).length,
    testCommits: commits.filter(
      (c) =>
        c.message.toLowerCase().includes("test") ||
        c.files.some((f) => f.includes("test") || f.includes("spec"))
    ).length,
    bugfixCommits: commits.filter(
      (c) =>
        c.message.toLowerCase().includes("fix") ||
        c.message.toLowerCase().includes("bug")
    ).length,
  };

  return metrics;
}

function getMostActiveFiles(fileOwnership, limit) {
  return Array.from(fileOwnership.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, limit)
    .map(([file]) => file);
}

function getTopContributors(contributors, limit) {
  return Array.from(contributors.values())
    .sort((a, b) => b.commits - a.commits)
    .slice(0, limit)
    .map((c) => c.name);
}

// GET /api/codebase-time-machine/analysis/:id
// Get analysis status and results
router.get("/analysis/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const analysis = analyses.get(id);
    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    res.json({ analysis });
  } catch (error) {
    console.error("Error fetching analysis:", error);
    res.status(500).json({ error: "Failed to fetch analysis" });
  }
});

// POST /api/codebase-time-machine/query
// Query codebase evolution with natural language
router.post("/query", async (req, res) => {
  try {
    const { analysisId, question, filters } = req.body;

    if (!analysisId || !question) {
      return res
        .status(400)
        .json({ error: "Analysis ID and question are required" });
    }

    const analysis = analyses.get(analysisId);
    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    const results = analysisResults.get(analysisId);
    if (!results) {
      return res.status(404).json({ error: "Analysis results not found" });
    }

    // Process query using GPT-4
    let queryResult;
    try {
      // Find relevant commits based on question
      const relevantCommits = findRelevantCommits(results.commits, question);

      // Analyze code changes using GPT-4
      const analyzedCommits = [];
      for (const commit of relevantCommits.slice(0, 5)) {
        // Limit to 5 commits for performance
        try {
          const analysis = await analyzeCodeChanges(
            commit.message,
            commit.files.map((file) => ({
              file,
              linesAdded: commit.linesAdded,
              linesRemoved: commit.linesRemoved,
            }))
          );
          analyzedCommits.push({
            ...commit,
            analysis: analysis,
          });
        } catch (error) {
          console.error("Error analyzing commit:", error);
          analyzedCommits.push({
            ...commit,
            analysis: {
              impact: "medium",
              type: "unknown",
              description: "Analysis failed",
            },
          });
        }
      }

      // Generate answer using GPT-4
      const answer = await generateQueryAnswer(
        question,
        analyzedCommits,
        results
      );

      queryResult = {
        id: uuidv4(),
        analysisId: analysisId,
        question: question,
        answer: answer,
        relatedCommits: analyzedCommits.map((commit) => ({
          hash: commit.hash,
          author: commit.author,
          date: commit.date,
          message: commit.message,
          files: commit.files,
          relevance: calculateRelevance(commit, question),
          analysis: commit.analysis,
        })),
        timeline: generateTimeline(analyzedCommits, question),
      };
    } catch (error) {
      console.error("Error processing query:", error);
      // Fallback to simple analysis
      queryResult = {
        id: uuidv4(),
        analysisId: analysisId,
        question: question,
        answer: generateFallbackAnswer(question, results),
        relatedCommits: results.commits.slice(0, 3).map((commit) => ({
          hash: commit.hash,
          author: commit.author,
          date: commit.date,
          message: commit.message,
          files: commit.files,
          relevance: 0.5,
        })),
        timeline: results.commits.slice(0, 3).map((commit) => ({
          date: commit.date,
          event: commit.message,
          commit: commit.hash,
        })),
      };
    }

    res.json({ queryResult });
  } catch (error) {
    console.error("Query error:", error);
    res.status(500).json({ error: "Failed to process query" });
  }
});

// Helper functions for query processing
function findRelevantCommits(commits, question) {
  const questionLower = question.toLowerCase();
  const keywords = questionLower.split(" ").filter((word) => word.length > 3);

  return commits
    .map((commit) => {
      const messageLower = commit.message.toLowerCase();
      const bodyLower = (commit.body || "").toLowerCase();
      const filesLower = commit.files.join(" ").toLowerCase();

      let score = 0;
      for (const keyword of keywords) {
        if (messageLower.includes(keyword)) score += 3;
        if (bodyLower.includes(keyword)) score += 2;
        if (filesLower.includes(keyword)) score += 1;
      }

      return { ...commit, relevanceScore: score };
    })
    .filter((commit) => commit.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function calculateRelevance(commit, question) {
  const questionLower = question.toLowerCase();
  const messageLower = commit.message.toLowerCase();

  let relevance = 0;
  const words = questionLower.split(" ");

  for (const word of words) {
    if (word.length > 3 && messageLower.includes(word)) {
      relevance += 0.2;
    }
  }

  return Math.min(1, relevance);
}

function generateTimeline(commits, question) {
  return commits
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((commit) => ({
      date: commit.date,
      event: commit.message,
      commit: commit.hash,
    }));
}

async function generateQueryAnswer(question, commits, results) {
  try {
    // Prepare comprehensive context for AI analysis
    const commitContext = commits
      .map(
        (c) =>
          `${c.hash.substring(0, 8)} by ${c.author} on ${c.date}: ${
            c.message
          }\nFiles: ${c.files.join(", ")}\nLines: +${c.linesAdded} -${
            c.linesRemoved
          }`
      )
      .join("\n\n");

    const contextualData = {
      totalCommits: results.commits.length,
      totalContributors: results.contributors.length,
      features: results.features?.slice(0, 5) || [],
      insights: results.insights?.slice(0, 3) || [],
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert software architect and codebase historian. You analyze git repositories to understand:
- How features evolved over time
- Why architectural decisions were made
- How team dynamics affected code development
- Business context behind technical changes

Provide detailed, insightful answers that explain the "why" behind code changes, not just the "what".
Focus on patterns, motivations, and business context.`,
        },
        {
          role: "user",
          content: `Question: ${question}

Repository Context:
${JSON.stringify(contextualData, null, 2)}

Relevant Commits:
${commitContext}

Provide a comprehensive answer that explains the evolution, patterns, and context behind the code changes.`,
        },
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error generating answer:", error);
    return generateFallbackAnswer(question, results);
  }
}

function generateFallbackAnswer(question, results) {
  const questionLower = question.toLowerCase();

  if (
    questionLower.includes("auth") ||
    questionLower.includes("authentication")
  ) {
    const authCommits = results.commits.filter(
      (c) =>
        c.message.toLowerCase().includes("auth") ||
        c.files.some((f) => f.toLowerCase().includes("auth"))
    );
    if (authCommits.length > 0) {
      return `Authentication-related changes were found in ${
        authCommits.length
      } commits, starting from ${authCommits[authCommits.length - 1].date}.`;
    }
  }

  return `Based on the analysis of ${results.commits.length} commits, I found relevant information related to your question. Please check the related commits for more details.`;
}

// GET /api/codebase-time-machine/evolution/:analysisId
// Get code evolution visualization data
router.get("/evolution/:analysisId", async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { feature, timeRange } = req.query;

    const results = analysisResults.get(analysisId);
    if (!results) {
      return res.status(404).json({ error: "Analysis results not found" });
    }

    const evolution = {
      analysisId: analysisId,
      feature: feature || "overall",
      timeRange: timeRange || "all",
      data: results.complexity || [],
      insights: results.insights || [],
    };

    res.json({ evolution });
  } catch (error) {
    console.error("Error fetching evolution data:", error);
    res.status(500).json({ error: "Failed to fetch evolution data" });
  }
});

// GET /api/codebase-time-machine/ownership/:analysisId
// Get code ownership and complexity trends
router.get("/ownership/:analysisId", async (req, res) => {
  try {
    const { analysisId } = req.params;

    const results = analysisResults.get(analysisId);
    if (!results) {
      return res.status(404).json({ error: "Analysis results not found" });
    }

    // Calculate file ownership percentages
    const fileOwnership = results.fileOwnership.map((fileData) => {
      const totalContributions = fileData.contributors.reduce(
        (sum, c) => sum + c.count,
        0
      );
      const primaryContributor = fileData.contributors.sort(
        (a, b) => b.count - a.count
      )[0];

      return {
        file: fileData.file,
        primaryOwner: primaryContributor.name,
        ownershipPercentage: Math.round(
          (primaryContributor.count / totalContributions) * 100
        ),
        lastModified:
          results.commits.find((c) => c.files.includes(fileData.file))?.date ||
          "Unknown",
      };
    });

    const ownership = {
      analysisId: analysisId,
      contributors: results.contributors || [],
      fileOwnership: fileOwnership,
      complexityTrends: results.complexity || [],
    };

    res.json({ ownership });
  } catch (error) {
    console.error("Error fetching ownership data:", error);
    res.status(500).json({ error: "Failed to fetch ownership data" });
  }
});

// GET /api/codebase-time-machine/features/:analysisId
// Get business features linked to code changes
router.get("/features/:analysisId", async (req, res) => {
  try {
    const { analysisId } = req.params;

    const results = analysisResults.get(analysisId);
    if (!results) {
      return res.status(404).json({ error: "Analysis results not found" });
    }

    const features = {
      analysisId: analysisId,
      features: results.features || [],
      decisions: generateArchitecturalDecisions(results.commits),
    };

    res.json({ features });
  } catch (error) {
    console.error("Error fetching features:", error);
    res.status(500).json({ error: "Failed to fetch features" });
  }
});

// Helper function to generate architectural decisions
function generateArchitecturalDecisions(commits) {
  const decisions = [];
  const decisionKeywords = [
    "refactor",
    "architecture",
    "design",
    "pattern",
    "framework",
    "library",
    "database",
    "api",
    "security",
    "performance",
    "scalability",
    "maintainability",
  ];

  for (const commit of commits) {
    const message = commit.message.toLowerCase();
    const body = commit.body.toLowerCase();

    for (const keyword of decisionKeywords) {
      if (message.includes(keyword) || body.includes(keyword)) {
        decisions.push({
          date: commit.date,
          decision: commit.message,
          rationale: body || "Architectural decision made",
          impact: determineDecisionImpact(commit),
          relatedCommits: [commit.hash],
        });
        break; // Only add each commit once
      }
    }
  }

  return decisions.slice(0, 10); // Limit to 10 decisions
}

function determineDecisionImpact(commit) {
  const linesChanged = commit.linesAdded + commit.linesRemoved;
  const filesChanged = commit.files.length;

  if (linesChanged > 500 || filesChanged > 20) return "high";
  if (linesChanged > 100 || filesChanged > 5) return "medium";
  return "low";
}

// GET /api/codebase-time-machine/commits/:analysisId
// Get detailed commit information
router.get("/commits/:analysisId", async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { author, date, file, limit = 50 } = req.query;

    const results = analysisResults.get(analysisId);
    if (!results) {
      return res.status(404).json({ error: "Analysis results not found" });
    }

    // Apply filters
    let filteredCommits = results.commits;

    if (author) {
      filteredCommits = filteredCommits.filter((c) =>
        c.author.toLowerCase().includes(author.toLowerCase())
      );
    }

    if (date) {
      filteredCommits = filteredCommits.filter((c) => c.date.startsWith(date));
    }

    if (file) {
      filteredCommits = filteredCommits.filter((c) =>
        c.files.some((f) => f.toLowerCase().includes(file.toLowerCase()))
      );
    }

    // Apply limit
    filteredCommits = filteredCommits.slice(0, parseInt(limit) || 50);

    // Calculate summary
    const totalCommits = results.commits.length;
    const totalAuthors = new Set(results.commits.map((c) => c.author)).size;
    const averageCommitSize = Math.round(
      results.commits.reduce(
        (sum, c) => sum + c.linesAdded + c.linesRemoved,
        0
      ) / totalCommits
    );

    // Find most active day
    const dayCounts = {};
    results.commits.forEach((c) => {
      const day = new Date(c.date).toLocaleDateString("en-US", {
        weekday: "long",
      });
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    const mostActiveDay =
      Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "Unknown";

    const commits = {
      analysisId: analysisId,
      commits: filteredCommits.map((c) => ({
        ...c,
        impact: determineCommitImpact(c),
      })),
      summary: {
        totalCommits,
        totalAuthors,
        averageCommitSize,
        mostActiveDay,
      },
    };

    res.json({ commits });
  } catch (error) {
    console.error("Error fetching commits:", error);
    res.status(500).json({ error: "Failed to fetch commits" });
  }
});

function determineCommitImpact(commit) {
  const linesChanged = commit.linesAdded + commit.linesRemoved;
  const filesChanged = commit.files.length;

  if (linesChanged > 500 || filesChanged > 20) return "high";
  if (linesChanged > 100 || filesChanged > 5) return "medium";
  return "low";
}

// GET /api/codebase-time-machine/health
// Health check endpoint for App Runner
router.get("/health", async (req, res) => {
  try {
    // Check if git is available
    const git = simpleGit();
    const version = await git.version();

    // Test network connectivity
    const https = require("https");
    const networkTests = {};

    // Test GitHub connectivity
    try {
      await new Promise((resolve, reject) => {
        const req = https.get("https://api.github.com", (res) => {
          networkTests.github = { status: res.statusCode, accessible: true };
          resolve();
        });
        req.on("error", (err) => {
          networkTests.github = { error: err.message, accessible: false };
          resolve();
        });
        req.setTimeout(5000, () => {
          networkTests.github = { error: "Timeout", accessible: false };
          resolve();
        });
      });
    } catch (error) {
      networkTests.github = { error: error.message, accessible: false };
    }

    // Test DNS resolution
    try {
      const dns = require("dns").promises;
      await dns.lookup("github.com");
      networkTests.dns = { accessible: true };
    } catch (error) {
      networkTests.dns = { error: error.message, accessible: false };
    }

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      git: version,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      network: networkTests,
      containerInfo: {
        startTime: containerStartTime.toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/codebase-time-machine/debug-storage
// Debug endpoint to see what's stored in memory
router.get("/debug-storage", async (req, res) => {
  try {
    const analysesList = Array.from(analyses.entries()).map(
      ([id, analysis]) => ({
        id,
        repoUrl: analysis.repoUrl,
        status: analysis.status,
        startedAt: analysis.startedAt,
        completedAt: analysis.completedAt,
      })
    );

    const resultsList = Array.from(analysisResults.entries()).map(
      ([id, results]) => ({
        id,
        hasResults: !!results,
        commitCount: results?.commits?.length || 0,
      })
    );

    res.json({
      analyses: analysesList,
      results: resultsList,
      totalAnalyses: analyses.size,
      totalResults: analysisResults.size,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/codebase-time-machine/test-repo-access
// Test repository access (for debugging)
router.get("/test-repo-access", async (req, res) => {
  try {
    const { repoUrl } = req.query;
    if (!repoUrl) {
      return res.status(400).json({ error: "Repository URL is required" });
    }

    console.log(`🔍 Testing repository access: ${repoUrl}`);

    const git = simpleGit();

    // Test 1: Check if git is available
    try {
      const version = await git.version();
      console.log(`✅ Git version: ${version}`);
    } catch (gitError) {
      console.error(`❌ Git not available: ${gitError.message}`);
      return res.json({
        accessible: false,
        error: `Git not available: ${gitError.message}`,
        tests: { git: false },
      });
    }

    // Test 2: Try to list remote refs
    try {
      const repoInfo = await git.listRemote([repoUrl]);
      const refs = repoInfo.split("\n").filter((line) => line.trim());
      console.log(`✅ Repository accessible. Found ${refs.length} refs`);

      // Extract branch names from refs
      const branches = refs
        .filter((ref) => ref.includes("refs/heads/"))
        .map((ref) => ref.replace("refs/heads/", ""))
        .slice(0, 5);

      res.json({
        accessible: true,
        refs: refs.slice(0, 10), // Show first 10 refs
        totalRefs: refs.length,
        branches: branches,
        tests: { git: true, remote: true },
      });
    } catch (remoteError) {
      console.error(`❌ Remote access failed: ${remoteError.message}`);

      // Test 3: Try with different URL formats
      const alternativeUrls = [
        repoUrl.replace("https://", "git://"),
        repoUrl.replace("https://github.com/", "git@github.com:") + ".git",
      ];

      for (const altUrl of alternativeUrls) {
        try {
          console.log(`🔄 Trying alternative URL: ${altUrl}`);
          const altRepoInfo = await git.listRemote([altUrl]);
          console.log(`✅ Alternative URL works: ${altUrl}`);
          return res.json({
            accessible: true,
            originalUrl: repoUrl,
            workingUrl: altUrl,
            refs: altRepoInfo
              .split("\n")
              .filter((line) => line.trim())
              .slice(0, 10),
            tests: { git: true, remote: false, alternative: true },
          });
        } catch (altError) {
          console.log(
            `❌ Alternative URL failed: ${altUrl} - ${altError.message}`
          );
        }
      }

      res.json({
        accessible: false,
        error: remoteError.message,
        tests: { git: true, remote: false, alternative: false },
      });
    }
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    res.json({
      accessible: false,
      error: error.message,
      tests: { git: false, remote: false },
    });
  }
});

// GET /api/codebase-time-machine/analyses
// Get all repository analyses
router.get("/analyses", async (req, res) => {
  try {
    const analysesList = Array.from(analyses.values());
    res.json({ analyses: analysesList });
  } catch (error) {
    console.error("Error fetching analyses:", error);
    res.status(500).json({ error: "Failed to fetch analyses" });
  }
});

module.exports = router;
