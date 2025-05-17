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
  const { data: players, isLoading } = useLeaderboard();

  // Filter players based on active tab
  const filteredPlayers = players?.filter(player => {
    switch (activeTab) {
      case 'basic':
        return !player.is_pro && !player.is_vip;
      case 'pro':
        return player.is_pro;
      case 'vip':
        return player.is_vip;
      default:
        return true;
    }
  }) || [];

  return (
    <section className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Leaderboard</h2>
      </div>

      <Tabs defaultValue="basic" value={activeTab} onValueChange={(value) => setActiveTab(value as PlayerType)}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="basic">Basic Players</TabsTrigger>
          <TabsTrigger value="pro">Pro Players</TabsTrigger>
          <TabsTrigger value="vip">VIP Players</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Kicked Win</TableHead>
                  <TableHead>Kept Win</TableHead>
                  <TableHead>Total Week Point</TableHead>
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
                    </TableRow>
                  ))
                ) : (
                  filteredPlayers.map((player, index) => (
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
                      <TableCell>{player.kicked_win}</TableCell>
                      <TableCell>{player.keep_win}</TableCell>
                      <TableCell>{player.total_point}</TableCell>
                      <TableCell>{player.reward}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pro">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Kicked Win</TableHead>
                  <TableHead>Kept Win</TableHead>
                  <TableHead>Total Week Point</TableHead>
                  <TableHead>Extra Points</TableHead>
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
                    </TableRow>
                  ))
                ) : (
                  filteredPlayers.map((player, index) => (
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
                            <span className="text-xs text-yellow-600">PRO</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{player.level}</TableCell>
                      <TableCell>{player.kicked_win}</TableCell>
                      <TableCell>{player.keep_win}</TableCell>
                      <TableCell>{player.total_point}</TableCell>
                      <TableCell>{player.total_extra_skill}</TableCell>
                      <TableCell>{player.reward}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="vip">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Kicked Win</TableHead>
                  <TableHead>Kept Win</TableHead>
                  <TableHead>Total Week Point</TableHead>
                  <TableHead>Extra Points</TableHead>
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
                    </TableRow>
                  ))
                ) : (
                  filteredPlayers.map((player, index) => (
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
                            <span className="text-xs text-purple-600">VIP</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{player.level}</TableCell>
                      <TableCell>{player.kicked_win}</TableCell>
                      <TableCell>{player.keep_win}</TableCell>
                      <TableCell>{player.total_point}</TableCell>
                      <TableCell>{player.total_extra_skill}</TableCell>
                      <TableCell>{player.reward}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
