import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { useAuth } from "@/contexts/AuthContext";
import { API_ENDPOINTS, defaultFetchOptions } from "@/config/api";
import { fetchWithApiCache } from '@/utils/apiCache';

export interface LeaderboardPlayer {
  id: string;
  name: string;
  avatar: string;
  level: number;
  total_kicked: number;
  kicked_win: number;
  total_keep: number;
  keep_win: number;
  total_point: number;
  bonus_point: number;
  is_pro: boolean;
  is_vip: boolean;
  extra_point?: number;
}

export function useLeaderboard(page: number = 1, limit: number = 5, type: string = 'basic') {
  const { user } = useAuth();
  const [data, setData] = useState<LeaderboardPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial leaderboard from API
  const fetchInitialData = async () => {
    try {
      const url = API_ENDPOINTS.users.leaderboard + `?page=${page}&limit=${limit}&type=${type}`;
      const cacheKey = `leaderboard-${page}-${limit}-${type}`;
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
        total_point: user.total_point,
        bonus_point: user.bonus_point,
        level: user.level,
        extra_point: user.extra_point,
      })));
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching initial leaderboard:', error);
      setIsLoading(false);
      setError('Failed to load leaderboard');
    }
  };

  // Fetch when page, limit, or type changes
  useEffect(() => {
    fetchInitialData();
  }, [page, limit, type]);

  // Listen for websocket leaderboard updates
  useWebSocket({
    onLeaderboardUpdate: (message: { leaderboard: LeaderboardPlayer[] }) => {
      if (message && Array.isArray(message.leaderboard)) {
        setData([...message.leaderboard]);
        setIsLoading(false);
      } else {
        setData([]);
        setIsLoading(false);
      }
    },
    onError: (err) => {
      setError(err);
      setIsLoading(false);
    }
  });

  return {
    data,
    isLoading,
    error,
    fetchInitialData,
  };
} 