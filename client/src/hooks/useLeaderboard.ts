import { useState, useEffect } from "react";
import { websocketService } from "@/services/websocket";
import { useAuth } from "@/contexts/AuthContext";
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
  is_vip: boolean;
  total_extra_skill: number;
  extra_skill_win: number;
  total_point: number;
  bonus_point: number;
  level: number;
}

export const useLeaderboard = (page: number = 1, limit: number = 10) => {
  const { user } = useAuth();
  const [data, setData] = useState<LeaderboardPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInitialData = async () => {
    try {
      const url = API_ENDPOINTS.users.leaderboard + `?page=${page}&limit=${limit}`;
      const response = await fetch(url, defaultFetchOptions);
      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.status} ${response.statusText}`);
      }
      const initialData = await response.json();
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

  // Set up WebSocket for realtime updates
  useEffect(() => {
    if (!user) return;

    // Không cập nhật leaderboard cho user_type là guest
    if (user.user_type === 'guest') return;

    const handleLeaderboardUpdate = (message: any) => {
      console.log('Received leaderboard update in hook:', message);
      if (message.type === 'leaderboard_update' && Array.isArray(message.leaderboard)) {
        const updatedData = message.leaderboard.map((player: any) => ({
          id: player.id,
          name: player.name,
          avatar: player.avatar,
          total_kicked: player.total_kicked,
          kicked_win: player.kicked_win,
          total_keep: player.total_keep,
          keep_win: player.keep_win,
          is_pro: player.is_pro,
          is_vip: player.is_vip,
          total_extra_skill: player.total_extra_skill,
          extra_skill_win: player.extra_skill_win,
          total_point: player.total_point,
          bonus_point: player.bonus_point,
          level: player.level,
        }));
        console.log('Updating leaderboard with:', updatedData);
        setData(prevData => {
          // Merge new data with existing data to maintain order
          const mergedData = [...prevData];
          updatedData.forEach((newPlayer: LeaderboardPlayer) => {
            const existingIndex = mergedData.findIndex(p => p.id === newPlayer.id);
            if (existingIndex !== -1) {
              mergedData[existingIndex] = newPlayer;
            } else {
              mergedData.push(newPlayer);
            }
          });
          // Sort by total points
          return mergedData.sort((a, b) => b.total_point - a.total_point);
        });
        setIsLoading(false);
      }
    };

    // Initialize WebSocket connection if not already connected
    if (!websocketService.isConnected()) {
      websocketService.connect();
    }

    // Set up WebSocket callbacks
    websocketService.setCallbacks({
      onLeaderboardUpdate: handleLeaderboardUpdate,
      onConnect: () => {
        console.log('WebSocket connected in useLeaderboard');
        // Fetch initial data when connected
        fetchInitialData();
      },
      onDisconnect: () => {
        console.log('WebSocket disconnected in useLeaderboard');
        setIsLoading(true);
      },
      onError: (error) => {
        console.error('WebSocket error in useLeaderboard:', error);
        setIsLoading(true);
      }
    });

    // Cleanup function
    return () => {
      websocketService.removeCallbacks({
        onLeaderboardUpdate: handleLeaderboardUpdate,
        onConnect: () => {
          console.log('WebSocket connected in useLeaderboard');
        },
        onDisconnect: () => {
          console.log('WebSocket disconnected in useLeaderboard');
          setIsLoading(true);
        },
        onError: (error) => {
          console.error('WebSocket error in useLeaderboard:', error);
          setIsLoading(true);
        }
      });
    };
  }, [user]);

  return { data, isLoading };
}; 