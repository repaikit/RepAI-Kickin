import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS, defaultFetchOptions } from "@/config/api";

export interface LeaderboardPlayer {
  id: string;
  name: string;
  avatar: string;
  total_kicked: number;
  kicked_win: number;
  total_keep: number;
  keep_win: number;
  is_pro: boolean;
  total_extra_skill: number;
  extra_skill_win: number;
  level: number;
}

export const useLeaderboard = (limit: number = 10) => {
  return useQuery<LeaderboardPlayer[]>({
    queryKey: ["leaderboard", limit],
    queryFn: async () => {
      const url = API_ENDPOINTS.users.leaderboard + `?limit=${limit}`;
      const response = await fetch(url, defaultFetchOptions);
      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      // Map backend user to LeaderboardPlayer
      return data.map((user: any) => ({
        id: user._id,
        name: user.name,
        avatar: user.avatar,
        total_kicked: user.total_kicked,
        kicked_win: user.kicked_win,
        total_keep: user.total_keep,
        keep_win: user.keep_win,
        is_pro: user.is_pro,
        total_extra_skill: user.total_extra_skill,
        extra_skill_win: user.extra_skill_win,
        level: user.level,
      }));
    },
    enabled: true,
  });
}; 