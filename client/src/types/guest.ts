export interface DeviceInfo {
  user_agent: string;
  ip: string;
}

export interface GuestUser {
  _id: string;
  user_type: 'guest' | 'user';
  session_id: string;
  remaining_matches: number;
  email?: string | null;
  wallet?: string | null;
  name: string;
  avatar: string;
  kicker_skills: string[];
  goalkeeper_skills: string[];
  total_point: number;
  total_kicked: number;
  kicked_win: number;
  total_keep: number;
  keep_win: number;
  is_pro: boolean;
  total_extra_skill: number;
  extra_skill_win: number;
  level: number;
  created_at: string;
  updated_at: string;
  last_login?: string | null;
} 