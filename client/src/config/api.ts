// API configuration
const isDevelopment = process.env.NODE_ENV === 'development';

// Base URL for API calls
export const API_BASE_URL = isDevelopment 
  ? 'http://localhost:5000'
  : process.env.NEXT_PUBLIC_API_URL || '';

// API endpoints
export const API_ENDPOINTS = {
  players: `${API_BASE_URL}/api/players`,
  challenges: `${API_BASE_URL}/api/challenges`,
  skills: (playerId: number) => `${API_BASE_URL}/api/skills/${playerId}`,
};

// Default fetch options
export const defaultFetchOptions = {
  credentials: 'same-origin' as RequestCredentials,
  headers: {
    'Content-Type': 'application/json',
  },
}; 