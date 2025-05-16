import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaderboard, LeaderboardPlayer } from "@/hooks/useLeaderboard";
import { Button } from "@/components/ui/button";

interface LeaderboardProps {
  onPositionChange: (position: string) => void;
  onSeasonChange: (season: string) => void;
  currentPosition: string;
  currentSeason: string;
}

export default function Leaderboard({ 
  onPositionChange,
  onSeasonChange,
  currentPosition,
  currentSeason 
}: LeaderboardProps) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;
  const maxPages = 100;
  const { data: players, isLoading } = useLeaderboard(currentPage, pageSize);

  const pagedPlayers = players || [];

  return (
    <section className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Leaderboard</h2>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Player</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Total Kicked</TableHead>
              <TableHead>Kicked Win</TableHead>
              <TableHead>Total Keep</TableHead>
              <TableHead>Keep Win</TableHead>
              <TableHead>Total Extra Skill</TableHead>
              <TableHead>Extra Skill Win</TableHead>
              <TableHead>Total Point</TableHead>
              <TableHead>Reward (USDC)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
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
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                </TableRow>
              ))
            ) : (
              pagedPlayers.map((player, index) => (
                <TableRow key={player.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell>
                    <span className={
                      index === 0 ? "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-yellow-500 text-white border-2 border-white" :
                      index === 1 ? "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-gray-700 text-white border-2 border-white" :
                      index === 2 ? "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-orange-600 text-white border-2 border-white" :
                      "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-slate-600 text-white border-2 border-white"
                    }>
                      {(currentPage - 1) * pageSize + index + 1}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <img
                        src={player.avatar}
                        alt={player.name}
                        className="w-10 h-10 rounded-full object-cover mr-3"
                      />
                      <div>
                        <p className="font-medium text-slate-800">{player.name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{player.level}</TableCell>
                  <TableCell>{player.total_kicked}</TableCell>
                  <TableCell>{player.kicked_win}</TableCell>
                  <TableCell>{player.total_keep}</TableCell>
                  <TableCell>{player.keep_win}</TableCell>
                  <TableCell>{player.total_extra_skill}</TableCell>
                  <TableCell>{player.extra_skill_win}</TableCell>
                  <TableCell>{player.total_point}</TableCell>
                  <TableCell>{player.reward}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {!isLoading && (
        <div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-slate-500">
            Showing {pagedPlayers.length} of {pagedPlayers.length} players (Page {currentPage})
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="font-medium">{currentPage}</span>
            <button
              onClick={() => {
                if (pagedPlayers.length === pageSize && currentPage < maxPages) {
                  setCurrentPage((p) => p + 1);
                }
              }}
              disabled={pagedPlayers.length < pageSize || currentPage === maxPages}
              className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
