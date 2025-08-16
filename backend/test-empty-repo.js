const simpleGit = require("simple-git");
const path = require("path");
const fs = require("fs");

async function testEmptyRepositoryHandling() {
  console.log("🧪 Testing Empty Repository Handling...");
  
  // Test with the actual repository that's causing issues
  const testRepoUrl = "https://github.com/CharlieChenyuZhang/chenyuzhang.com";
  const tempDir = path.join(__dirname, "temp", "test-empty-" + Date.now());
  
  try {
    console.log("📁 Creating temp directory:", tempDir);
    if (!fs.existsSync(path.dirname(tempDir))) {
      fs.mkdirSync(path.dirname(tempDir), { recursive: true });
    }

    console.log("🔗 Cloning repository...");
    const git = simpleGit();
    await git.clone(testRepoUrl, tempDir, ["-b", "main"]);

    console.log("📊 Getting commit history...");
    const repoGit = simpleGit(tempDir);

    const log = await repoGit.log({
      maxCount: 2000,
      format: {
        hash: "%H",
        author: "%an",
        authorEmail: "%ae",
        date: "%aI",
        message: "%s",
        body: "%b",
        refs: "%D"
      }
    });

    console.log(`📈 Total commits found: ${log.all.length}`);
    
    if (log.all.length === 0) {
      console.log("✅ Repository is empty - this is expected behavior");
      console.log("✅ The analysis should complete with appropriate messaging");
    } else {
      console.log("❌ Repository has commits - this is unexpected");
    }

    // Test file statistics
    const files = await repoGit.raw(["ls-files"]);
    const fileList = files.split("\n").filter(f => f.trim());
    console.log(`📁 Total files found: ${fileList.length}`);

    console.log("🎉 Empty repository test completed!");

  } catch (error) {
    console.error("❌ Test failed:", error.message);
  } finally {
    // Clean up
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

// Run the test
testEmptyRepositoryHandling().catch(console.error);
