import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS, defaultFetchOptions } from "@/config/api";

export interface LeaderboardPlayer {
  id: string;
  name: string;
  position: string;
  avatar: string;
  wins: number;
  losses: number;
  trend: "up" | "down" | "stable";
  trendValue: string;
}

interface User {
  _id: string;
  name: string;
  user_type: string;
  kicker_skills: string[];
  goalkeeper_skills: string[];
  wins: number;
  losses: number;
  avatar: string;
  position: string;
  point: number;
  rank: number;
  trend: string;
}

interface ApiResponse {
  total: number;
  users: User[];
  page: number;
  size: number;
}

const calculateTrend = (wins: number, losses: number): { trend: "up" | "down" | "stable", trendValue: string } => {
  const total = wins + losses;
  if (total === 0) return { trend: "stable", trendValue: "0%" };
  
  const winRate = (wins / total) * 100;
  if (winRate >= 60) return { trend: "up", trendValue: `${Math.round(winRate)}%` };
  if (winRate <= 40) return { trend: "down", trendValue: `${Math.round(winRate)}%` };
  return { trend: "stable", trendValue: `${Math.round(winRate)}%` };
};

const determinePosition = (user: User): string => {
  if (user.kicker_skills.length > 0 && user.goalkeeper_skills.length > 0) return "both";
  if (user.kicker_skills.length > 0) return "kicker";
  if (user.goalkeeper_skills.length > 0) return "goalkeeper";
  return "unknown";
};

export const useLeaderboard = (position: string = "all", season: string = "current") => {
  return useQuery<LeaderboardPlayer[]>({
    queryKey: ["leaderboard", position, season],
    queryFn: async () => {
      try {
        const url = API_ENDPOINTS.users.getAll;
        console.log('Fetching users data from:', url);
        const response = await fetch(url, defaultFetchOptions);
        if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
        }
        const data: ApiResponse = await response.json();
        console.log('Users response:', data);

        // Transform users into leaderboard players
        const players: LeaderboardPlayer[] = data.users.map(user => ({
          id: user._id,
          name: user.name,
          position: user.position,
          avatar: user.avatar,
          wins: user.wins,
          losses: user.losses,
          ...calculateTrend(user.wins, user.losses)
        }));

        // Filter by position if needed
        const filteredPlayers = position === "all" 
          ? players 
          : players.filter(p => p.position === position);

        // Sort by win rate
        return filteredPlayers.sort((a, b) => {
          const winRateA = a.wins / (a.wins + a.losses) || 0;
          const winRateB = b.wins / (b.wins + b.losses) || 0;
          return winRateB - winRateA;
        });
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        throw error;
      }
    },
    enabled: true,
  });
}; 