const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

// Gmail API configuration
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

const TOKEN_PATH = path.join(__dirname, "../data/gmail_token.json");
const CREDENTIALS_PATH = path.join(__dirname, "../data/gmail_credentials.json");

// Ensure data directory exists
const DATA_DIR = path.dirname(TOKEN_PATH);
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class GmailService {
  constructor() {
    this.oAuth2Client = null;
    this.gmail = null;
  }

  // Initialize OAuth2 client
  initializeOAuth2Client() {
    const credentials = this.loadCredentials();
    if (!credentials) {
      throw new Error(
        "Gmail credentials not found. Please set up Gmail API credentials."
      );
    }

    const { client_secret, client_id, redirect_uris } =
      credentials.installed || credentials.web;
    this.oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0] || process.env.GMAIL_REDIRECT_URI
    );

    return this.oAuth2Client;
  }

  // Load credentials from file or environment
  loadCredentials() {
    try {
      // Try to load from file first
      if (fs.existsSync(CREDENTIALS_PATH)) {
        const content = fs.readFileSync(CREDENTIALS_PATH);
        return JSON.parse(content);
      }

      // Fallback to environment variables
      if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET) {
        return {
          installed: {
            client_id: process.env.GMAIL_CLIENT_ID,
            client_secret: process.env.GMAIL_CLIENT_SECRET,
            redirect_uris: [process.env.GMAIL_REDIRECT_URI],
          },
        };
      }

      return null;
    } catch (error) {
      console.error("Error loading Gmail credentials:", error);
      return null;
    }
  }

  // Load token from file
  loadToken() {
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        const token = fs.readFileSync(TOKEN_PATH);
        return JSON.parse(token);
      }
    } catch (error) {
      console.error("Error loading token:", error);
    }
    return null;
  }

  // Save token to file
  saveToken(token) {
    try {
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      console.log("Token stored to", TOKEN_PATH);
    } catch (error) {
      console.error("Error saving token:", error);
    }
  }

  // Generate authorization URL
  generateAuthUrl() {
    const oAuth2Client = this.initializeOAuth2Client();
    return oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });
  }

  // Get tokens from authorization code
  async getTokensFromCode(code) {
    try {
      const oAuth2Client = this.initializeOAuth2Client();
      const { tokens } = await oAuth2Client.getToken(code);
      this.saveToken(tokens);
      return tokens;
    } catch (error) {
      console.error("Error retrieving access token:", error);
      throw error;
    }
  }

  // Set credentials and initialize Gmail API
  async setCredentials(tokens) {
    try {
      const oAuth2Client = this.initializeOAuth2Client();
      oAuth2Client.setCredentials(tokens);
      this.gmail = google.gmail({ version: "v1", auth: oAuth2Client });
      return true;
    } catch (error) {
      console.error("Error setting credentials:", error);
      return false;
    }
  }

  // Authenticate with stored token or return auth URL
  async authenticate() {
    try {
      const token = this.loadToken();
      if (token) {
        const success = await this.setCredentials(token);
        if (success) {
          return {
            authenticated: true,
            message: "Successfully authenticated with Gmail",
          };
        }
      }

      // If no token or token is invalid, return auth URL
      const authUrl = this.generateAuthUrl();
      return {
        authenticated: false,
        authUrl,
        message:
          "Authentication required. Please visit the auth URL to authorize Gmail access.",
      };
    } catch (error) {
      console.error("Authentication error:", error);
      throw error;
    }
  }

  // Fetch emails from Gmail
  async fetchEmails(maxResults = 200) {
    try {
      if (!this.gmail) {
        throw new Error(
          "Gmail API not initialized. Please authenticate first."
        );
      }

      const response = await this.gmail.users.messages.list({
        userId: "me",
        maxResults: maxResults,
        labelIds: ["INBOX"],
      });

      const messages = response.data.messages || [];
      const emails = [];

      // Fetch full email details for each message
      for (const message of messages) {
        try {
          const emailDetail = await this.gmail.users.messages.get({
            userId: "me",
            id: message.id,
            format: "full",
          });

          const email = this.parseEmailMessage(emailDetail.data);
          emails.push(email);
        } catch (error) {
          console.error(`Error fetching email ${message.id}:`, error);
        }
      }

      return emails;
    } catch (error) {
      console.error("Error fetching emails:", error);
      throw error;
    }
  }

  // Parse Gmail message into our email format
  parseEmailMessage(message) {
    const headers = message.payload.headers;
    const subject =
      headers.find((h) => h.name === "Subject")?.value || "No Subject";
    const from =
      headers.find((h) => h.name === "From")?.value || "Unknown Sender";
    const date =
      headers.find((h) => h.name === "Date")?.value || new Date().toISOString();

    // Extract email body
    let body = "";
    if (message.payload.body && message.payload.body.data) {
      body = Buffer.from(message.payload.body.data, "base64").toString("utf-8");
    } else if (message.payload.parts) {
      // Try to find text/plain part
      const textPart = message.payload.parts.find(
        (part) => part.mimeType === "text/plain" && part.body && part.body.data
      );
      if (textPart) {
        body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
      }
    }

    // Simple priority detection based on subject and sender
    const priority = this.detectPriority(subject, from);
    const category = this.detectCategory(subject, from, body);

    return {
      id: message.id,
      subject: subject,
      sender: from,
      date: new Date(date).toISOString(),
      body: body.substring(0, 500) + (body.length > 500 ? "..." : ""), // Truncate long bodies
      category: category,
      priority: priority,
      threadId: message.threadId,
      snippet: message.snippet || "",
    };
  }

  // Simple priority detection
  detectPriority(subject, from) {
    const urgentKeywords = [
      "urgent",
      "asap",
      "emergency",
      "critical",
      "important",
      "deadline",
    ];
    const lowPriorityKeywords = [
      "newsletter",
      "promotion",
      "sale",
      "marketing",
    ];

    const subjectLower = subject.toLowerCase();
    const fromLower = from.toLowerCase();

    if (urgentKeywords.some((keyword) => subjectLower.includes(keyword))) {
      return "high";
    }

    if (
      lowPriorityKeywords.some(
        (keyword) =>
          subjectLower.includes(keyword) || fromLower.includes(keyword)
      )
    ) {
      return "low";
    }

    return "medium";
  }

  // Simple category detection
  detectCategory(subject, from, body) {
    const subjectLower = subject.toLowerCase();
    const fromLower = from.toLowerCase();
    const bodyLower = body.toLowerCase();

    if (
      subjectLower.includes("meeting") ||
      subjectLower.includes("call") ||
      subjectLower.includes("appointment")
    ) {
      return "meeting";
    }

    if (
      subjectLower.includes("invoice") ||
      subjectLower.includes("payment") ||
      subjectLower.includes("billing")
    ) {
      return "finance";
    }

    if (
      subjectLower.includes("newsletter") ||
      fromLower.includes("newsletter")
    ) {
      return "newsletter";
    }

    if (
      subjectLower.includes("order") ||
      subjectLower.includes("shipping") ||
      subjectLower.includes("delivery")
    ) {
      return "shopping";
    }

    if (
      subjectLower.includes("security") ||
      subjectLower.includes("login") ||
      subjectLower.includes("password")
    ) {
      return "security";
    }

    if (
      fromLower.includes("@gmail.com") ||
      fromLower.includes("@yahoo.com") ||
      fromLower.includes("@outlook.com")
    ) {
      return "personal";
    }

    return "work";
  }

  // Archive emails (move to Archive label)
  async archiveEmails(emailIds) {
    try {
      if (!this.gmail) {
        throw new Error(
          "Gmail API not initialized. Please authenticate first."
        );
      }

      const results = [];
      for (const emailId of emailIds) {
        try {
          await this.gmail.users.messages.modify({
            userId: "me",
            id: emailId,
            requestBody: {
              removeLabelIds: ["INBOX"],
              addLabelIds: ["TRASH"], // or 'Archive' if you want to archive instead of delete
            },
          });
          results.push({ id: emailId, status: "archived" });
        } catch (error) {
          console.error(`Error archiving email ${emailId}:`, error);
          results.push({ id: emailId, status: "error", error: error.message });
        }
      }

      return results;
    } catch (error) {
      console.error("Error archiving emails:", error);
      throw error;
    }
  }
}

module.exports = new GmailService();
