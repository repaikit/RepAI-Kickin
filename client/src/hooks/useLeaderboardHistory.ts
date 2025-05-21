import { useState, useEffect } from "react";
import { API_ENDPOINTS } from "@/config/api";

export interface LeaderboardHistoryEntry {
  user_id: string;
  name: string;
  total_point: number;
  kicked_win?: number;
  keep_win?: number;
  rank: number;
  avatar: string;
  bonus_point: number;
  level: number;
}

export function useWeeklyLeaderboardHistory(week: string, board: string) {
  const [data, setData] = useState<LeaderboardHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!week || !board) return;
    setIsLoading(true);
    fetch(`${API_ENDPOINTS.leaderboard.weekly}?week=${week}&board=${board}`)
      .then(res => res.json())
      .then(res => {
        setData(res.top_10 || []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [week, board]);

  return { data, isLoading };
}

export function useMonthlyLeaderboardHistory(year: number, month: number, board: string) {
  const [data, setData] = useState<LeaderboardHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!year || !month || !board) return;
    setIsLoading(true);
    fetch(`${API_ENDPOINTS.leaderboard.monthly}?year=${year}&month=${month}&board=${board}`)
      .then(res => res.json())
      .then(res => {
        setData(res.top_10 || []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [year, month, board]);

  return { data, isLoading };
} 