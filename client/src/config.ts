// API base URL - hardcoded to API URL to fix CORS issues
export const STAGING_API_URL = 'https://api.roxonn.com';

// App configuration
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Roxonn';
export const APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:3000';

// Feature flags
export const ENABLE_DEBUG = import.meta.env.VITE_ENABLE_DEBUG === 'true';

// Debug logging function
export const debug = (...args: any[]) => {
  if (ENABLE_DEBUG) {
    
  }
};

// Other configuration variables can be added here 