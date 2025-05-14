// API configuration
const isDevelopment = process.env.NODE_ENV === 'development';

// Base URL for API calls
export const API_BASE_URL = isDevelopment 
  ? 'http://localhost:5000'
  : process.env.NEXT_PUBLIC_API_URL || '';

// WebSocket URL
export const WS_BASE_URL = isDevelopment
  ? 'ws://localhost:5000'
  : process.env.NEXT_PUBLIC_WS_URL || '';

// API endpoints
export const API_ENDPOINTS = {
  // User APIs
  users: {
    // Guest User
    createGuest: `${API_BASE_URL}/api/guest`,
    getGuest: (sessionId: string) => `${API_BASE_URL}/api/guest/${sessionId}`,
    getCurrentUser: `${API_BASE_URL}/api/me`,

    // Convert Guest
    convertGuest: `${API_BASE_URL}/api/convert-guest`,
    
    // User Management
    getAll: `${API_BASE_URL}/api/users`,
    getById: (userId: string) => `${API_BASE_URL}/api/users/${userId}`,
    getByPrivyId: (privyId: string) => `${API_BASE_URL}/api/users/privy/${privyId}`,
    getByEmail: (email: string) => `${API_BASE_URL}/api/users/email/${email}`,
    getByWallet: (wallet: string) => `${API_BASE_URL}/api/users/wallet/${wallet}`,
    updateById: (userId: string) => `${API_BASE_URL}/api/users/${userId}`,
    deleteById: (userId: string) => `${API_BASE_URL}/api/users/${userId}`,
  },

  // Skills APIs
  skills: {
    getByType: (skillType: string) => `${API_BASE_URL}/api/skills/type/${skillType}`,
    getUserSkills: () => `${API_BASE_URL}/api/skills/user`,
  },

  // Matches APIs
  matches: {
    create: `${API_BASE_URL}/api/matches`,
    getAll: `${API_BASE_URL}/api/matches`,
    getById: (matchId: string) => `${API_BASE_URL}/api/matches/${matchId}`,
    getByStatus: (status: string) => `${API_BASE_URL}/api/matches/status/${status}`,
    update: (matchId: string) => `${API_BASE_URL}/api/matches/${matchId}`,
    delete: (matchId: string) => `${API_BASE_URL}/api/matches/${matchId}`,
  },

  // WebSocket endpoints
  ws: {
    waitingRoom: (sessionId: string) => `${WS_BASE_URL}/api/ws/waitingroom/${sessionId}`,
  },
};

// Default fetch options
export const defaultFetchOptions = {
  credentials: 'include' as RequestCredentials,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  mode: 'cors' as RequestMode,
}; 