export interface DeviceInfo {
  user_agent: string;
  ip: string;
}

export interface GuestUser {
  user_type: 'guest';
  session_id: string;
  remaining_matches: number;
  expires_at: string;
  privy_id: string | null;
  email: string | null;
  wallet: string | null;
  twitter_id: string | null;
  position: 'both' | 'kicker' | 'goalkeeper';
  role: 'user' | 'admin';
  is_active: boolean;
  is_verified: boolean;
  trend: 'neutral' | 'up' | 'down';
  name: string;
  avatar: string | null;
  kicker_skills: string[];
  goalkeeper_skills: string[];
  point: number;
  wins: number;
  losses: number;
  total_matches: number;
  rank: number;
  match_history: any[];
  created_at: string;
  updated_at: string;
  last_login: string | null;
  guest_created_at: string;
  converted_to_user: boolean;
  converted_at: string | null;
  device_info: DeviceInfo;
  _id: string;
} 