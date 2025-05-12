import React, { useState } from "react";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface LeaderboardProps {
  players: any[];
  isLoading: boolean;
}

type SortField = "name" | "wins" | "losses" | "winRate";
type SortDirection = "asc" | "desc";

export default function Leaderboard({ players, isLoading }: LeaderboardProps) {
  const [position, setPosition] = useState<string>("all");
  const [season, setSeason] = useState<string>("current");
  const [sortField, setSortField] = useState<SortField>("wins");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortedPlayers = () => {
    let filteredPlayers = [...players];
    
    // Apply position filter
    if (position !== "all") {
      filteredPlayers = filteredPlayers.filter(player => 
        player.position.toLowerCase() === position.toLowerCase()
      );
    }
    
    // Apply sorting
    return filteredPlayers.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "wins":
          comparison = a.wins - b.wins;
          break;
        case "losses":
          comparison = a.losses - b.losses;
          break;
        case "winRate":
          const winRateA = a.wins / (a.wins + a.losses) * 100;
          const winRateB = b.wins / (b.wins + b.losses) * 100;
          comparison = winRateA - winRateB;
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <svg className="ml-1 w-4 h-4 text-slate-400 group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    return sortDirection === "asc" ? (
      <svg className="ml-1 w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="ml-1 w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const renderWinRate = (wins: number, losses: number) => {
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    
    return (
      <div>
        <Progress value={winRate} className="h-2.5 mb-1" />
        <span className="text-xs font-medium text-slate-600">{winRate}%</span>
      </div>
    );
  };

  const renderTrend = (trend: string, trendValue: string) => {
    if (trend === "up") {
      return (
        <div className="flex items-center text-success">
          <svg className="mr-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          <span className="text-sm font-medium">{trendValue}</span>
        </div>
      );
    } else if (trend === "down") {
      return (
        <div className="flex items-center text-error">
          <svg className="mr-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <span className="text-sm font-medium">{trendValue}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-warning">
          <svg className="mr-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
          </svg>
          <span className="text-sm font-medium">{trendValue}</span>
        </div>
      );
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-md p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Leaderboard</h2>
          <p className="text-slate-500">Season 2023/2024 - Top Performers</p>
        </div>
        
        <div className="flex space-x-2 mt-4 md:mt-0">
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger className="w-[160px] bg-slate-100 text-slate-700">
              <SelectValue placeholder="All Positions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Positions</SelectItem>
              <SelectItem value="goalkeeper">Goalkeepers</SelectItem>
              <SelectItem value="defender">Defenders</SelectItem>
              <SelectItem value="midfielder">Midfielders</SelectItem>
              <SelectItem value="forward">Forwards</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={season} onValueChange={setSeason}>
            <SelectTrigger className="w-[160px] bg-slate-100 text-slate-700">
              <SelectValue placeholder="This Season" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">This Season</SelectItem>
              <SelectItem value="last">Last Season</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">
                <span className="text-sm font-semibold text-slate-600">#</span>
              </TableHead>
              <TableHead>
                <button 
                  onClick={() => handleSort("name")}
                  className="flex items-center cursor-pointer group"
                >
                  <span className="text-sm font-semibold text-slate-600">Player</span>
                  {getSortIcon("name")}
                </button>
              </TableHead>
              <TableHead>
                <button 
                  onClick={() => handleSort("wins")}
                  className="flex items-center cursor-pointer group"
                >
                  <span className="text-sm font-semibold text-slate-600">Wins</span>
                  {getSortIcon("wins")}
                </button>
              </TableHead>
              <TableHead>
                <button 
                  onClick={() => handleSort("losses")}
                  className="flex items-center cursor-pointer group"
                >
                  <span className="text-sm font-semibold text-slate-600">Losses</span>
                  {getSortIcon("losses")}
                </button>
              </TableHead>
              <TableHead>
                <button 
                  onClick={() => handleSort("winRate")}
                  className="flex items-center cursor-pointer group"
                >
                  <span className="text-sm font-semibold text-slate-600">Win Rate</span>
                  {getSortIcon("winRate")}
                </button>
              </TableHead>
              <TableHead>
                <span className="text-sm font-semibold text-slate-600">Trend</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton
              Array(5).fill(0).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-6 w-6 rounded-full" /></TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Skeleton className="h-10 w-10 rounded-full mr-3" />
                      <div>
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : (
              getSortedPlayers().map((player, index) => (
                <TableRow key={player.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell>
                    <span className={
                      index === 0 ? "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-yellow-500 text-white border-2 border-white" :
                      index === 1 ? "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-gray-700 text-white border-2 border-white" :
                      index === 2 ? "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-orange-600 text-white border-2 border-white" :
                      "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-slate-600 text-white border-2 border-white"
                    }>
                      {index + 1}
                    </span>
                  </TableCell >
                  <TableCell>
                    <div className="flex items-center">
                      <img 
                        src={player.avatar} 
                        alt={player.name} 
                        className="w-10 h-10 rounded-full object-cover mr-3"
                      />
                      <div>
                        <p className="font-medium text-slate-800">{player.name}</p>
                        <p className="text-xs text-slate-500">{player.position}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-success">{player.wins}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-error">{player.losses}</span>
                  </TableCell>
                  <TableCell>
                    {renderWinRate(player.wins, player.losses)}
                  </TableCell>
                  <TableCell>
                    {renderTrend(player.trend, player.trendValue)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {!isLoading && (
        <div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-slate-500">
            Showing {players.length} of 125 players
          </div>
          <div className="flex space-x-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-primary hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md bg-primary text-white">1</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-primary hover:text-white transition-colors">2</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-primary hover:text-white transition-colors">3</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-primary hover:text-white transition-colors">...</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-primary hover:text-white transition-colors">25</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-primary hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Force Tailwind to generate these classes for leaderboard ranking colors */}
      <div className="bg-yellow-500 bg-gray-700 bg-orange-600 bg-slate-600 text-white border-2 border-white" style={{display: 'none'}}></div>
    </section>
  );
}
