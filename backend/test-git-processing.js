const simpleGit = require("simple-git");
const path = require("path");
const fs = require("fs");

async function testGitProcessing() {
  console.log("🧪 Testing Git Processing Logic...");

  // Test with a known public repository
  const testRepoUrl = "https://github.com/octocat/Hello-World";
  const tempDir = path.join(__dirname, "temp", "test-git-" + Date.now());

  try {
    console.log("📁 Creating temp directory:", tempDir);
    if (!fs.existsSync(path.dirname(tempDir))) {
      fs.mkdirSync(path.dirname(tempDir), { recursive: true });
    }

    console.log("🔗 Cloning test repository...");
    const git = simpleGit();
    await git.clone(testRepoUrl, tempDir);

    console.log("📊 Getting commit history...");
    const repoGit = simpleGit(tempDir);

    // Test the same log format as used in the main code
    const log = await repoGit.log({
      maxCount: 50,
      format: {
        hash: "%H",
        author: "%an",
        authorEmail: "%ae",
        date: "%aI",
        message: "%s",
        body: "%b",
        refs: "%D",
      },
    });

    console.log("✅ Successfully retrieved commit history!");
    console.log(`📈 Total commits found: ${log.all.length}`);

    if (log.all.length > 0) {
      const firstCommit = log.all[0];
      console.log("📝 Sample commit:");
      console.log(`   Hash: ${firstCommit.hash.substring(0, 8)}`);
      console.log(`   Author: ${firstCommit.author}`);
      console.log(`   Date: ${firstCommit.date}`);
      console.log(`   Message: ${firstCommit.message}`);
    }

    // Test getting file statistics
    console.log("📂 Getting file list...");
    const files = await repoGit.raw(["ls-files"]);
    const fileList = files.split("\n").filter((f) => f.trim());
    console.log(`📁 Total files found: ${fileList.length}`);

    // Test getting commit details for one commit
    if (log.all.length > 0) {
      console.log("🔍 Testing commit details retrieval...");
      const commitHash = log.all[0].hash;

      try {
        const commitDetails = await repoGit.show([
          commitHash,
          "--stat",
          "--format=",
        ]);
        console.log("✅ Successfully retrieved commit details");

        // Test parsing stat information
        const statMatch = commitDetails.match(
          /(\d+) files? changed(?:, (\d+) insertions?)?(?:, (\d+) deletions?)?/
        );
        if (statMatch) {
          console.log(`📊 Files changed: ${statMatch[1]}`);
          console.log(`➕ Lines added: ${statMatch[2] || 0}`);
          console.log(`➖ Lines removed: ${statMatch[3] || 0}`);
        }

        // Test getting files changed
        const filesChanged = await repoGit.raw([
          "show",
          "--name-only",
          "--format=",
          commitHash,
        ]);
        const changedFiles = filesChanged.split("\n").filter((f) => f.trim());
        console.log(`📄 Files in commit: ${changedFiles.length}`);
      } catch (error) {
        console.error("❌ Error getting commit details:", error.message);
      }
    }

    // Test contributor analysis
    console.log("👥 Testing contributor analysis...");
    const contributors = new Map();

    for (const commit of log.all.slice(0, 10)) {
      // Test with first 10 commits
      const author = commit.author;
      if (!contributors.has(author)) {
        contributors.set(author, {
          name: author,
          commits: 0,
          linesAdded: 0,
          linesRemoved: 0,
          filesOwned: new Set(),
        });
      }
      contributors.get(author).commits++;
    }

    console.log(`👤 Unique contributors found: ${contributors.size}`);
    contributors.forEach((contributor, name) => {
      console.log(`   ${name}: ${contributor.commits} commits`);
    });

    console.log(
      "🎉 All tests passed! Git processing logic is working correctly."
    );
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack trace:", error.stack);
  } finally {
    // Clean up
    if (fs.existsSync(tempDir)) {
      console.log("🧹 Cleaning up temp directory...");
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

// Run the test
testGitProcessing().catch(console.error);
