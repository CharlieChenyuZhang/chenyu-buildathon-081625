// Environment configuration
export const ENV_CONFIG = {
  development: {
    name: 'Development',
    apiBaseUrl: 'http://localhost:8080',
    description: 'Local development environment',
  },
  production: {
    name: 'Production',
    apiBaseUrl: 'https://b2tutnx6u2.us-east-1.awsapprunner.com',
    description: 'Deployed production environment',
  },
  test: {
    name: 'Test',
    apiBaseUrl: '',
    description: 'Testing environment',
  }
};

// Get current environment
export const getCurrentEnvironment = () => {
  return process.env.NODE_ENV || 'development';
};

// Get environment config
export const getEnvironmentConfig = () => {
  const env = getCurrentEnvironment();
  return ENV_CONFIG[env] || ENV_CONFIG.development;
};

// Environment info for debugging
export const getEnvironmentInfo = () => {
  const config = getEnvironmentConfig();
  return {
    environment: getCurrentEnvironment(),
    apiBaseUrl: config.apiBaseUrl,
    name: config.name,
    description: config.description,
    isDevelopment: getCurrentEnvironment() === 'development',
    isProduction: getCurrentEnvironment() === 'production',
    isTest: getCurrentEnvironment() === 'test',
  };
};

// Log environment info in development
if (process.env.NODE_ENV === 'development') {
  console.log('🌍 Environment Info:', getEnvironmentInfo());
}

