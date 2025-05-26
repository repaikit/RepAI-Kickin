// API configuration
const isDevelopment = process.env.NODE_ENV === 'development';

// Base URL for API calls
export const API_BASE_URL = isDevelopment 
  ? 'http://localhost:5000'
  : process.env.NEXT_PUBLIC_API_URL || '';

console.log("bạn đang kết nối tới" + API_BASE_URL);
// WebSocket URL
export const WS_BASE_URL = isDevelopment
  ? 'ws://localhost:5000'
  : process.env.NEXT_PUBLIC_WS_URL || '';

// API endpoints
export const API_ENDPOINTS = {

  leaderboard: {
    weekly: `${API_BASE_URL}/api/leaderboard/weekly`,
    monthly: `${API_BASE_URL}/api/leaderboard/monthly`,
  },

  mystery_box: {
    getStatus: `${API_BASE_URL}/api/status`,
    openBox: `${API_BASE_URL}/api/open`,
    getHistory: `${API_BASE_URL}/api/history`,
  },

  bot: {
    getSkills: `${API_BASE_URL}/api/bot/skills`,
  },

  task_claim_matches: {
    getStatus: `${API_BASE_URL}/api/tasks/claim-matches-status`,
    claimMatches: `${API_BASE_URL}/api/tasks/claim-matches`,
  },
  // User APIs
  users: {
    me: `${API_BASE_URL}/api/me`,
    googleAuth: `${API_BASE_URL}/api/auth/google`,
    googleCallback: `${API_BASE_URL}/api/auth/google/callback`,
    createGuest: `${API_BASE_URL}/api/guest`,
    getGuest: (sessionId: string) => `${API_BASE_URL}/api/guest/${sessionId}`,

    verifyEmail: `${API_BASE_URL}/api/auth/verify-email`,

    login: `${API_BASE_URL}/api/auth/login`,
    register: `${API_BASE_URL}/api/auth/register`,
    GoogleLogin: `${API_BASE_URL}/api/auth/google`,
    GoogleRegister: `${API_BASE_URL}/api/auth/google/register`,

    decodeWalletInfo: `${API_BASE_URL}/api/users/decode-wallet-info`,

    refreshToken: `${API_BASE_URL}/api/auth/refresh`,
    // Upgrade Guest
    upgradeGuest: `${API_BASE_URL}/api/upgrade`,

    // refresh guest
    refreshGuest: `${API_BASE_URL}/api/guest/refresh`,

    play: `${API_BASE_URL}/api/play`,
    leaderboard: `${API_BASE_URL}/api/leaderboard`,
    deleteMe: `${API_BASE_URL}/api/me`,

    updateProfile: `${API_BASE_URL}/api/me`,
    levelUp: `${API_BASE_URL}/api/level-up`,

    getById: (userId: string) => `${API_BASE_URL}/api/users/${userId}`,
    
    getByEmail: (email: string) => `${API_BASE_URL}/api/users/email/${email}`,
    getByWallet: (wallet: string) => `${API_BASE_URL}/api/users/wallet/${wallet}`,
    deleteById: (userId: string) => `${API_BASE_URL}/api/users/${userId}`,

    weeklyStats: `${API_BASE_URL}/api/me/weekly-stats`,

    upgradeToPro: `${API_BASE_URL}/api/upgrade-to-pro`,
  },

  // Skills APIs
  skills: {
    getByType: (skillType: string) => `${API_BASE_URL}/api/skills/type/${skillType}`,
    getUserSkills: () => `${API_BASE_URL}/api/skills/user`,
    buySkill: `${API_BASE_URL}/api/buy_skill`,
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
    waitingRoom: `${WS_BASE_URL}/ws/waitingroom`,
    notifications: `${WS_BASE_URL}/ws/notifications`,
  },

  daily_tasks: {
    get: `${API_BASE_URL}/api/tasks/daily`,
    claim: `${API_BASE_URL}/api/tasks/daily/claim`,
  },

  // Chat APIs
  chat: {
    getHistory: `${API_BASE_URL}/api/chat/history`,
  },

  nft: {
    getNFTs: (walletAddress: string) => `${API_BASE_URL}/api/nfts/${walletAddress}`,
  },

  upgradeToPro: `${API_BASE_URL}/api/upgrade-to-pro`,
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