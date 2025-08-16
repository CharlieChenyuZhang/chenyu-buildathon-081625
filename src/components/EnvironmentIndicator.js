import React from 'react';
import { getEnvironmentInfo } from '../config/environment';

const EnvironmentIndicator = () => {
  const envInfo = getEnvironmentInfo();
  
  // Only show in development
  if (!envInfo.isDevelopment) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: '#333',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: '4px',
      fontSize: '12px',
      zIndex: 9999,
      fontFamily: 'monospace',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    }}>
      <div>🌍 {envInfo.name}</div>
      <div>🔗 {envInfo.apiBaseUrl}</div>
    </div>
  );
};

export default EnvironmentIndicator;
