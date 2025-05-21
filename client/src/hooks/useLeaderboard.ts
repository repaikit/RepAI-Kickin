import { useState, useEffect } from "react";
import { websocketService } from "@/services/websocket";
import { useAuth } from "@/contexts/AuthContext";
import { API_ENDPOINTS, defaultFetchOptions } from "@/config/api";
import { fetchWithApiCache } from '@/utils/apiCache';
import { useWebSocketData } from '@/contexts/WebSocketContext';

export interface LeaderboardPlayer {
  id: string;
  name: string;
  avatar: string;
  total_kicked: number;
  kicked_win: number;
  total_keep: number;
  keep_win: number;
  is_pro: boolean;
  is_vip: boolean;
  total_extra_skill: number;
  extra_skill_win: number;
  total_point: number;
  bonus_point: number;
  level: number;
}

export const useLeaderboard = (page: number = 1, limit: number = 10) => {
  const { user } = useAuth();
  const { leaderboard } = useWebSocketData();
  const [data, setData] = useState<LeaderboardPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInitialData = async () => {
    try {
      const url = API_ENDPOINTS.users.leaderboard + `?page=${page}&limit=${limit}`;
      const cacheKey = `leaderboard-${page}-${limit}`;
      const initialData = await fetchWithApiCache(cacheKey, url, defaultFetchOptions);
      setData(initialData.map((user: any) => ({
        id: user._id,
        name: user.name,
        avatar: user.avatar,
        total_kicked: user.total_kicked,
        kicked_win: user.kicked_win,
        total_keep: user.total_keep,
        keep_win: user.keep_win,
        is_pro: user.is_pro,
        is_vip: user.is_vip,
        total_extra_skill: user.total_extra_skill,
        extra_skill_win: user.extra_skill_win,
        total_point: user.total_point,
        bonus_point: user.bonus_point,
        level: user.level,
      })));
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching initial leaderboard:', error);
      setIsLoading(false);
    }
  };

  // Fetch initial data
  useEffect(() => {
    fetchInitialData();
  }, [page, limit]);

  // Always use realtime data if available, otherwise fallback to fetched data
  const result = leaderboard && leaderboard.length > 0 ? leaderboard : data;

  return { data: result, isLoading, fetchInitialData };
}; 