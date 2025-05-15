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
  const { data: players, isLoading } = useLeaderboard();

  // Sắp xếp theo số lần đá thắng (kicked_win) giảm dần
  const sortedPlayers = [...(players || [])].sort((a, b) => b.kicked_win - a.kicked_win);

  return (
    <section className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Leaderboard</h2>
        
        {/* Position Controls */}
        <div className="flex items-center space-x-2">
          <Button
            variant={currentPosition === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => onPositionChange("all")}
          >
            All
          </Button>
          <Button
            variant={currentPosition === "kicker" ? "default" : "outline"}
            size="sm"
            onClick={() => onPositionChange("kicker")}
          >
            Kicker
          </Button>
          <Button
            variant={currentPosition === "goalkeeper" ? "default" : "outline"}
            size="sm"
            onClick={() => onPositionChange("goalkeeper")}
          >
            Goalkeeper
          </Button>
        </div>

        {/* Season Controls */}
        <div className="flex items-center space-x-2">
          <Button
            variant={currentSeason === "current" ? "default" : "outline"}
            size="sm"
            onClick={() => onSeasonChange("current")}
          >
            Current
          </Button>
          <Button
            variant={currentSeason === "previous" ? "default" : "outline"}
            size="sm"
            onClick={() => onSeasonChange("previous")}
          >
            Previous
          </Button>
        </div>
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
              <TableHead>Pro</TableHead>
              <TableHead>Total Extra Skill</TableHead>
              <TableHead>Extra Skill Win</TableHead>
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
                </TableRow>
              ))
            ) : (
              sortedPlayers.map((player, index) => (
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
                  <TableCell>{player.is_pro ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{player.is_pro ? player.total_extra_skill : '-'}</TableCell>
                  <TableCell>{player.is_pro ? player.extra_skill_win : '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {!isLoading && (
        <div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-slate-500">
            Showing {players?.length || 0} of {players?.length || 0} players
          </div>
        </div>
      )}
    </section>
  );
}
