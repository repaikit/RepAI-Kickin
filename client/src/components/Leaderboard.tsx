import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { FaCrown, FaTrophy, FaMedal, FaAward } from 'react-icons/fa';
import { useWeeklyLeaderboardHistory, useMonthlyLeaderboardHistory } from "@/hooks/useLeaderboardHistory";
import { GiDiamondTrophy, GiGoldBar } from 'react-icons/gi';

interface LeaderboardProps {
  onPositionChange: (position: string) => void;
  onSeasonChange: (season: string) => void;
  currentPosition: string;
  currentSeason: string;
}

type PlayerType = 'basic' | 'pro' | 'vip';

export default function Leaderboard({
  onPositionChange,
  onSeasonChange,
  currentPosition,
  currentSeason
}: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<PlayerType>('basic');
  const [currentPage, setCurrentPage] = useState(1);
  const { data: players, isLoading } = useLeaderboard(currentPage, 5, activeTab);
  const { user } = useAuth();

  // Leaderboard history state
  const [historyType, setHistoryType] = useState<'weekly' | 'monthly'>('weekly');
  const [selectedWeek, setSelectedWeek] = useState('2025-21');
  const [selectedMonth, setSelectedMonth] = useState(5);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedBoard, setSelectedBoard] = useState('BASIC');

  const { data: weeklyHistory, isLoading: loadingWeeklyHistory } = useWeeklyLeaderboardHistory(selectedWeek, selectedBoard);
  const { data: monthlyHistory, isLoading: loadingMonthlyHistory } = useMonthlyLeaderboardHistory(selectedYear, selectedMonth, selectedBoard);

  // Handle tab change
  const handleTabChange = (value: string) => {
    if (user?.user_type === 'guest' && value !== 'basic') {
      return; // Prevent changing to pro/vip tabs for guests
    }
    setActiveTab(value as PlayerType);
    setCurrentPage(1); // Reset page when tab changes
  };

  // Medal colors for top 3 positions
  const medalColors = ['text-yellow-400', 'text-gray-400', 'text-amber-600'];

  // Add pagination controls
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <section className="bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-lg p-2 md:p-6 border border-slate-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4 mb-4 md:mb-6">
        <h2 className="text-xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
          <GiDiamondTrophy className="text-yellow-500" />
          Leaderboard
        </h2>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <select
            className="w-full md:w-auto bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm"
            value={currentSeason}
            onChange={(e) => onSeasonChange(e.target.value)}
          >
            <option value="current">Current Season</option>
            <option value="previous">Previous Season</option>
          </select>
          <select
            className="w-full md:w-auto bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm"
            value={currentPosition}
            onChange={(e) => onPositionChange(e.target.value)}
          >
            <option value="global">Global</option>
            <option value="country">Country</option>
            <option value="friends">Friends</option>
          </select>
        </div>
      </div>

      {/* Professional Leaderboard History Section */}
      <div className="mb-6 md:mb-10 p-3 md:p-6 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-4 gap-4">
          <div className="w-full md:w-auto">
            <h3 className="text-lg md:text-xl font-semibold mb-2 text-slate-700 flex items-center gap-2">
              <FaMedal className="text-blue-500" />
              Historical Rankings
            </h3>
            <div className="flex flex-col md:flex-row gap-2">
              <button
                className={`w-full md:w-auto px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  historyType === 'weekly' 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg' 
                    : 'bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 shadow-sm'
                }`}
                onClick={() => setHistoryType('weekly')}
                title="View weekly top 10 history"
              >
                <span>Weekly</span>
                {historyType === 'weekly' && <FaAward className="text-yellow-300" />}
              </button>
              <button
                className={`w-full md:w-auto px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  historyType === 'monthly' 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg' 
                    : 'bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 shadow-sm'
                }`}
                onClick={() => setHistoryType('monthly')}
                title="View monthly top 10 history"
              >
                <span>Monthly</span>
                {historyType === 'monthly' && <FaAward className="text-yellow-300" />}
              </button>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-2 items-center flex-wrap">
            {historyType === 'weekly' ? (
              <div className="relative w-full md:w-auto">
                <input
                  className="w-full md:w-32 border px-3 py-2 rounded-lg text-sm shadow-sm bg-white"
                  value={selectedWeek}
                  onChange={e => setSelectedWeek(e.target.value)}
                  placeholder="e.g. 2025-21"
                  title="Enter week code (e.g. 2025-21)"
                />
                <span className="absolute right-3 top-2.5 text-slate-400 text-xs">Week</span>
              </div>
            ) : (
              <>
                <div className="relative w-full md:w-auto">
                  <input
                    type="number"
                    className="w-full md:w-20 border px-3 py-2 rounded-lg text-sm shadow-sm bg-white"
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    min={2020}
                    max={2100}
                    title="Year"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-xs">Year</span>
                </div>
                <div className="relative w-full md:w-auto">
                  <input
                    type="number"
                    className="w-full md:w-16 border px-3 py-2 rounded-lg text-sm shadow-sm bg-white"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(Number(e.target.value))}
                    min={1}
                    max={12}
                    title="Month (1-12)"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-xs">Month</span>
                </div>
              </>
            )}
            <select
              className="w-full md:w-auto border px-3 py-2 rounded-lg text-sm shadow-sm bg-white"
              value={selectedBoard}
              onChange={e => setSelectedBoard(e.target.value)}
              title="Select leaderboard type"
            >
              <option value="BASIC">BASIC</option>
              <option value="PRO">PRO</option>
              <option value="VIP">VIP</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full w-full border text-sm rounded-lg overflow-hidden">
            <thead className="bg-gradient-to-r from-slate-700 to-slate-600 text-white">
              <tr>
                <th className="px-2 py-2 md:px-4 md:py-3 text-center">Rank</th>
                <th className="px-2 py-2 md:px-4 md:py-3 text-left">Player</th>
                <th className="px-2 py-2 md:px-4 md:py-3 text-center hidden md:table-cell">Points</th>
                <th className="px-2 py-2 md:px-4 md:py-3 text-center hidden md:table-cell">Kicked Win</th>
                <th className="px-2 py-2 md:px-4 md:py-3 text-center hidden md:table-cell">Kept Win</th>
                {historyType === 'monthly' && (
                  <th className="px-2 py-2 md:px-4 md:py-3 text-center hidden md:table-cell">Bonus Point</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(historyType === 'weekly' ? weeklyHistory : monthlyHistory).map((u, index) => {
                const isVIP = selectedBoard === 'VIP' || u.level >= 100;
                const isTop3 = index < 3;
                
                return (
                  <tr
                    key={u.user_id}
                    className={`border-t hover:bg-blue-50 transition-colors ${
                      isVIP ? 'bg-gradient-to-r from-yellow-50 to-amber-50' : ''
                    } ${
                      isTop3 ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : ''
                    }`}
                    style={isVIP ? { borderLeft: '4px solid #f59e0b' } : {}}
                  >
                    <td className="px-2 py-2 md:px-4 md:py-3 text-center font-semibold">
                      {isTop3 ? (
                        <div className="flex justify-center">
                          <span className={`text-xl md:text-2xl ${medalColors[index]}`}>
                            {index === 0 ? <FaTrophy /> : <FaMedal />}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold bg-slate-200 text-slate-700">
                          {u.rank}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 md:px-4 md:py-3">
                      <div className="flex items-center min-w-0">
                        <div className="relative flex-shrink-0">
                          <img
                            src={u.avatar || '/default-avatar.png'}
                            alt={u.name}
                            className={`w-8 h-8 md:w-12 md:h-12 rounded-full object-cover mr-2 md:mr-3 ${
                              isVIP ? 'border-2 border-yellow-400 shadow-md' : ''
                            }`}
                            style={isVIP ? { boxShadow: '0 0 10px rgba(245, 158, 11, 0.5)' } : {}}
                            onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/default-avatar.png'; }}
                          />
                          {isVIP && (
                            <FaCrown className="absolute -top-1 -right-1 md:-top-2 md:-right-2 text-yellow-400 text-sm md:text-lg bg-white rounded-full p-0.5 shadow" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-medium truncate ${isVIP ? 'text-yellow-700 mr-2' : 'text-slate-800'}`}>{u.name}</p>
                          {isVIP && (
                            <span className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow flex items-center mt-1">
                              <GiGoldBar className="mr-1" />
                              VIP
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 md:px-4 md:py-3 text-center font-medium hidden md:table-cell">{u.total_point}</td>
                    <td className="px-2 py-2 md:px-4 md:py-3 text-center hidden md:table-cell">{u.kicked_win ?? 0}</td>
                    <td className="px-2 py-2 md:px-4 md:py-3 text-center hidden md:table-cell">{u.keep_win ?? 0}</td>
                    {historyType === 'monthly' && (
                      <td className="px-2 py-2 md:px-4 md:py-3 text-center font-bold text-blue-600 hidden md:table-cell">{u.bonus_point ?? 0}</td>
                    )}
                  </tr>
                );
              })}
              {((historyType === 'weekly' ? loadingWeeklyHistory : loadingMonthlyHistory)) && (
                <tr><td colSpan={5} className="text-center py-4">Loading historical data...</td></tr>
              )}
              {!(historyType === 'weekly' ? loadingWeeklyHistory : loadingMonthlyHistory) && (historyType === 'weekly' ? weeklyHistory : monthlyHistory).length === 0 && (
                <tr><td colSpan={5} className="text-center py-4 text-slate-400 italic">No historical data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Tabs
        defaultValue="basic"
        value={activeTab}
        onValueChange={handleTabChange}
        className="mt-4 md:mt-8"
      >
        <TabsList className={`grid ${
          user?.user_type === 'guest' ? 'w-full grid-cols-1' : 'w-full grid-cols-3'
        } mb-4 md:mb-6 gap-2 bg-slate-100 p-2 rounded-xl`}>
          <TabsTrigger 
            value="basic"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200 rounded-lg py-2 px-4 transition-all text-sm md:text-base"
          >
            Basic Players
          </TabsTrigger>
          {user?.user_type !== 'guest' && (
            <>
              <TabsTrigger 
                value="pro"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-blue-200 data-[state=active]:text-blue-600 rounded-lg py-2 px-4 transition-all text-sm md:text-base"
              >
                Pro Players
              </TabsTrigger>
              <TabsTrigger
                value="vip"
                className="relative font-bold text-yellow-700 flex items-center justify-center gap-2 rounded-lg py-2 px-4 transition-all text-sm md:text-base
                  data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-50 data-[state=active]:to-amber-50
                  data-[state=active]:border-2 data-[state=active]:border-yellow-300 data-[state=active]:shadow-[0_0_15px_0_rgba(245,158,11,0.2)]"
              >
                <FaCrown className="text-yellow-500" />
                VIP Players
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="basic">
          <div className="w-full overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-[40px] md:w-[60px] text-slate-600 px-2 py-2 md:px-4 md:py-3">#</TableHead>
                  <TableHead className="text-left text-slate-600 px-2 py-2 md:px-4 md:py-3">Player</TableHead>
                  <TableHead className="hidden md:table-cell text-left text-slate-600 px-2 py-2 md:px-4 md:py-3">Level</TableHead>
                  <TableHead className="hidden md:table-cell text-left text-slate-600 px-2 py-2 md:px-4 md:py-3">Kicked Win</TableHead>
                  <TableHead className="hidden md:table-cell text-left text-slate-600 px-2 py-2 md:px-4 md:py-3">Kept Win</TableHead>
                  <TableHead className="text-left text-slate-600 px-2 py-2 md:px-4 md:py-3">Week Points</TableHead>
                  <TableHead className="hidden md:table-cell text-left text-slate-600 px-2 py-2 md:px-4 md:py-3">Bonus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell><Skeleton className="h-6 w-6 rounded-full" /></TableCell>
                      <TableCell className="w-[200px] md:w-[250px] min-w-[200px] md:min-w-[250px]">
                        <div className="flex items-center min-w-0">
                          <Skeleton className="h-8 w-8 md:h-10 md:w-10 rounded-full mr-2 md:mr-3" />
                          <div className="min-w-0 flex-1">
                            <Skeleton className="h-4 w-24 mb-1" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  players.map((player, index) => (
                    <TableRow 
                      key={`${player.id}-${activeTab}-${index}`}
                      className="hover:bg-slate-50 transition-colors border-t border-slate-100"
                    >
                      <TableCell className="px-2 py-2 md:px-4 md:py-3">
                        <span className={
                          index === 0 ? "inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow" :
                          index === 1 ? "inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold bg-gradient-to-br from-gray-400 to-gray-500 text-white shadow" :
                          index === 2 ? "inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow" :
                          "inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold bg-slate-200 text-slate-700"
                        }>
                          {(currentPage - 1) * 5 + index + 1}
                        </span>
                      </TableCell>
                      <TableCell className="px-2 py-2 md:px-4 md:py-3 w-[200px] md:w-[250px] min-w-[200px] md:min-w-[250px]">
                        <div className="flex items-center min-w-0">
                          <img
                            src={player.avatar}
                            alt={player.name}
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover mr-2 md:mr-3 border-2 border-white shadow"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-800 truncate">{player.name}</p>
                            <p className="text-xs text-slate-500 truncate">Basic Player</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{player.level}</TableCell>
                      <TableCell className="hidden md:table-cell">{player.kicked_win}</TableCell>
                      <TableCell className="hidden md:table-cell">{player.keep_win}</TableCell>
                      <TableCell className="font-medium">{player.total_point}</TableCell>
                      <TableCell className="hidden md:table-cell">{player.bonus_point}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {/* Add pagination controls */}
            <div className="flex justify-center items-center gap-2 py-4 border-t border-slate-200">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="w-full md:w-auto px-3 py-2 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 text-sm md:text-base"
              >
                Previous
              </button>
              <span className="px-3 py-2 bg-slate-100 rounded-lg text-sm md:text-base">
                Page {currentPage}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!players || players.length < 5}
                className="w-full md:w-auto px-3 py-2 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 text-sm md:text-base"
              >
                Next
              </button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pro">
          <div className="overflow-x-auto rounded-xl border border-blue-100 shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-50 hover:bg-blue-50">
                  <TableHead className="w-[40px] md:w-[60px] text-blue-600 px-2 py-2 md:px-4 md:py-3">#</TableHead>
                  <TableHead className="text-left text-blue-600 px-2 py-2 md:px-4 md:py-3">Player</TableHead>
                  <TableHead className="hidden md:table-cell text-left text-blue-600 px-2 py-2 md:px-4 md:py-3">Level</TableHead>
                  <TableHead className="hidden md:table-cell text-left text-blue-600 px-2 py-2 md:px-4 md:py-3">Kicked Win</TableHead>
                  <TableHead className="hidden md:table-cell text-left text-blue-600 px-2 py-2 md:px-4 md:py-3">Kept Win</TableHead>
                  <TableHead className="text-left text-blue-600 px-2 py-2 md:px-4 md:py-3">Week Points</TableHead>
                  <TableHead className="hidden md:table-cell text-left text-blue-600 px-2 py-2 md:px-4 md:py-3">Bonus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell><Skeleton className="h-6 w-6 rounded-full" /></TableCell>
                      <TableCell className="w-[200px] md:w-[250px] min-w-[200px] md:min-w-[250px]">
                        <div className="flex items-center min-w-0">
                          <Skeleton className="h-8 w-8 md:h-10 md:w-10 rounded-full mr-2 md:mr-3" />
                          <div className="min-w-0 flex-1">
                            <Skeleton className="h-4 w-24 mb-1" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  players.map((player, index) => (
                    <TableRow 
                      key={`${player.id}-${activeTab}-${index}`}
                      className="hover:bg-blue-50 transition-colors border-t border-blue-100"
                    >
                      <TableCell className="px-2 py-2 md:px-4 md:py-3">
                        <span className={
                          index === 0 ? "inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow" :
                          index === 1 ? "inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold bg-gradient-to-br from-gray-400 to-gray-500 text-white shadow" :
                          index === 2 ? "inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow" :
                          "inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold bg-blue-200 text-blue-700"
                        }>
                          {(currentPage - 1) * 5 + index + 1}
                        </span>
                      </TableCell>
                      <TableCell className="px-2 py-2 md:px-4 md:py-3 w-[200px] md:w-[250px] min-w-[200px] md:min-w-[250px]">
                        <div className="flex items-center min-w-0">
                          <img
                            src={player.avatar}
                            alt={player.name}
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover mr-2 md:mr-3 border-2 border-blue-100 shadow"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-blue-800 truncate">{player.name}</p>
                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full truncate">PRO PLAYER</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-medium">{player.level}</TableCell>
                      <TableCell className="hidden md:table-cell">{player.kicked_win}</TableCell>
                      <TableCell className="hidden md:table-cell">{player.keep_win}</TableCell>
                      <TableCell className="font-bold text-blue-600">{player.total_point}</TableCell>
                      <TableCell className="hidden md:table-cell">{player.bonus_point}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {/* Add pagination controls */}
            <div className="flex justify-center items-center gap-2 py-4 border-t border-blue-100">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="w-full md:w-auto px-3 py-2 rounded-lg border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50 text-sm md:text-base"
              >
                Previous
              </button>
              <span className="px-3 py-2 bg-blue-100 rounded-lg text-sm md:text-base">
                Page {currentPage}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!players || players.length < 5}
                className="w-full md:w-auto px-3 py-2 rounded-lg border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50 text-sm md:text-base"
              >
                Next
              </button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vip">
          <div className="overflow-x-auto rounded-xl border border-yellow-100 shadow-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-yellow-50 to-amber-50 hover:bg-yellow-50">
                  <TableHead className="w-[40px] md:w-[60px] text-yellow-700 px-2 py-2 md:px-4 md:py-3">#</TableHead>
                  <TableHead className="text-left text-yellow-700 px-2 py-2 md:px-4 md:py-3">Player</TableHead>
                  <TableHead className="hidden md:table-cell text-left text-yellow-700 px-2 py-2 md:px-4 md:py-3">Level</TableHead>
                  <TableHead className="hidden md:table-cell text-left text-yellow-700 px-2 py-2 md:px-4 md:py-3">Kicked Win</TableHead>
                  <TableHead className="hidden md:table-cell text-left text-yellow-700 px-2 py-2 md:px-4 md:py-3">Kept Win</TableHead>
                  <TableHead className="text-left text-yellow-700 px-2 py-2 md:px-4 md:py-3">Week Points</TableHead>
                  <TableHead className="hidden md:table-cell text-left text-yellow-700 px-2 py-2 md:px-4 md:py-3">Extra</TableHead>
                  <TableHead className="hidden md:table-cell text-left text-yellow-700 px-2 py-2 md:px-4 md:py-3">Bonus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell><Skeleton className="h-6 w-6 rounded-full bg-yellow-200" /></TableCell>
                      <TableCell className="w-[200px] md:w-[250px] min-w-[200px] md:min-w-[250px]">
                        <div className="flex items-center min-w-0">
                          <Skeleton className="h-8 w-8 md:h-10 md:w-10 rounded-full mr-2 md:mr-3 bg-yellow-200" />
                          <div className="min-w-0 flex-1">
                            <Skeleton className="h-4 w-24 mb-1 bg-yellow-200" />
                            <Skeleton className="h-3 w-16 bg-yellow-200" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-8 bg-yellow-200" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-8 bg-yellow-200" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-8 bg-yellow-200" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 bg-yellow-200" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-8 bg-yellow-200" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-8 bg-yellow-200" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  players.map((player, index) => (
                    <TableRow
                      key={`${player.id}-${activeTab}-${index}`}
                      className="hover:shadow-lg transition-all duration-200 border-t border-yellow-100"
                      style={{
                        background: index % 2 === 0 
                          ? 'linear-gradient(90deg, #fffbe6 0%, #fff8e1 100%)' 
                          : 'linear-gradient(90deg, #fff8e1 0%, #fff3cd 100%)',
                        borderLeft: '4px solid #f59e0b'
                      }}
                    >
                      <TableCell className="px-2 py-2 md:px-4 md:py-3">
                        <div className="relative">
                          <span className={
                            index === 0 ? "inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-lg" :
                            index === 1 ? "inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold bg-gradient-to-br from-gray-400 to-gray-500 text-white shadow-lg" :
                            index === 2 ? "inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-lg" :
                            "inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold bg-gradient-to-br from-yellow-200 to-yellow-300 text-yellow-800 shadow"
                          }>
                            {(currentPage - 1) * 5 + index + 1}
                          </span>
                          {index < 3 && (
                            <FaCrown className={`absolute -top-1 -right-1 md:-top-2 md:-right-2 text-sm md:text-lg ${
                              index === 0 ? 'text-yellow-400' :
                              index === 1 ? 'text-gray-400' :
                              'text-amber-600'
                            }`} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-2 md:px-4 md:py-3 w-[200px] md:w-[250px] min-w-[200px] md:min-w-[250px]">
                        <div className="flex items-center min-w-0">
                          <div className="relative mr-2 md:mr-3">
                            <img
                              src={player.avatar}
                              alt={player.name}
                              className="w-8 h-8 md:w-12 md:h-12 rounded-full object-cover border-2 border-yellow-300 shadow-lg"
                              style={{ boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)' }}
                            />
                            <FaCrown className="absolute -bottom-1 -right-1 text-yellow-400 text-xs md:text-sm bg-white rounded-full p-0.5 shadow" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-yellow-700 mr-2 truncate">{player.name}</p>
                            <span className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow flex items-center mt-1">
                              <GiGoldBar className="mr-1" />
                              VIP
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-bold text-yellow-700">{player.level}</TableCell>
                      <TableCell className="hidden md:table-cell">{player.kicked_win}</TableCell>
                      <TableCell className="hidden md:table-cell">{player.keep_win}</TableCell>
                      <TableCell className="font-bold text-yellow-600">{player.total_point}</TableCell>
                      <TableCell className="hidden md:table-cell font-bold text-amber-600">{player.extra_point}</TableCell>
                      <TableCell className="hidden md:table-cell font-bold text-yellow-600">{player.bonus_point}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {/* Add pagination controls */}
            <div className="flex justify-center items-center gap-2 py-4 border-t border-yellow-100">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="w-full md:w-auto px-3 py-2 rounded-lg border border-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-50 text-sm md:text-base"
              >
                Previous
              </button>
              <span className="px-3 py-2 bg-yellow-100 rounded-lg text-sm md:text-base">
                Page {currentPage}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!players || players.length < 5}
                className="w-full md:w-auto px-3 py-2 rounded-lg border border-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-50 text-sm md:text-base"
              >
                Next
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}