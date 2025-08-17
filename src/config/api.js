import axios from "axios";
import { getEnvironmentConfig } from "./environment";

// API Configuration for different environments
const API_CONFIG = {
  // Local development - uses local backend
  development: {
    baseURL: "http://localhost:8080",
    timeout: 30000,
  },
  // Production - uses deployed backend
  production: {
    baseURL: "https://b2tutnx6u2.us-east-1.awsapprunner.com",
    timeout: 30000,
  },
  // Test environment
  test: {
    baseURL: "",
    timeout: 5000,
  },
};

// Get current environment
const getEnvironment = () => {
  if (process.env.NODE_ENV === "production") {
    return "production";
  } else if (process.env.NODE_ENV === "test") {
    return "test";
  } else {
    return "development";
  }
};

// Get current API configuration
const getApiConfig = () => {
  const env = getEnvironment();
  return API_CONFIG[env] || API_CONFIG.development;
};

// Create axios instance with proper configuration
const createApiInstance = () => {
  const config = getApiConfig();

  const instance = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Add request interceptor for logging in development
  if (process.env.NODE_ENV === "development") {
    instance.interceptors.request.use(
      (config) => {
        console.log(
          `🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`
        );
        return config;
      },
      (error) => {
        console.error("❌ API Request Error:", error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging in development
    instance.interceptors.response.use(
      (response) => {
        console.log(
          `✅ API Response: ${response.status} ${response.config.url}`
        );
        return response;
      },
      (error) => {
        console.error(
          "❌ API Response Error:",
          error.response?.status,
          error.response?.data
        );
        return Promise.reject(error);
      }
    );
  }

  return instance;
};

// Export the configured axios instance
export const api = createApiInstance();

// Export configuration for manual use if needed
export const apiConfig = getApiConfig();
export const environment = getEnvironment();

// Helper function to get full URL for debugging
export const getFullUrl = (endpoint) => {
  const config = getApiConfig();
  return config.baseURL ? `${config.baseURL}${endpoint}` : endpoint;
};

// Export environment info for debugging
export const getEnvironmentInfo = () => ({
  environment: getEnvironment(),
  apiConfig: getApiConfig(),
  isDevelopment: getEnvironment() === "development",
  isProduction: getEnvironment() === "production",
  isTest: getEnvironment() === "test",
});
