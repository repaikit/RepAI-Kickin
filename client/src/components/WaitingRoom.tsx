import React, { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useWaitingRoom } from "@/hooks/useWaitingRoom";
import { useGuestUser } from "@/hooks/useGuestUser";

interface WaitingRoomProps {
  sessionId: string;
}

const WaitingRoom: React.FC<WaitingRoomProps> = ({ sessionId }) => {
  const { guestUser } = useGuestUser();
  const { users, isConnected, sendChallenge } = useWaitingRoom();
  const [isLoading, setIsLoading] = useState(true);

  // Simulate loading state for initial data fetch
  React.useEffect(() => {
    if (users.length > 0) {
      setIsLoading(false);
    }
  }, [users]);

  // Filter out current user from the list
  const waitingPlayers = users.filter(user => user.user_id !== guestUser?._id).slice(0, 4);

  const handleChallenge = (targetUserId: string) => {
    sendChallenge(targetUserId);
  };

  return (
    <section className="bg-white rounded-xl shadow-md p-6 h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Waiting Room</h2>
          <p className="text-slate-500">Players ready for matches</p>
        </div>
        <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 px-3 py-1">
          <span className="mr-1">•</span> {users.length} Online
        </Badge>
      </div>
      
      <div className="space-y-4">
        {isLoading ? (
          // Loading skeletons
          Array(4).fill(0).map((_, index) => (
            <div key={`skeleton-${index}`} className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          ))
        ) : (
          waitingPlayers.map((player) => (
            <div 
              key={player.user_id} 
              className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg hover:border-primary/50 hover:bg-slate-50 transition-colors"
            >
              <div className="relative">
                <img 
                  src={player.avatar || 'https://via.placeholder.com/150'}
                  alt={player.name} 
                  className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm"
                />
              </div>
              
              <div className="flex-1">
                <h3 className="font-medium text-slate-800">{player.name}</h3>
                <p className="text-sm text-slate-500">
                  {player.remaining_matches} matches left • {player.wins}W {player.losses}L
                </p>
              </div>
              
              <button 
                onClick={() => handleChallenge(player.user_id)}
                className="px-4 py-1.5 bg-primary/10 text-primary font-medium text-sm rounded-full hover:bg-primary hover:text-white transition-colors"
              >
                Challenge
              </button>
            </div>
          ))
        )}
      </div>
      
      <div className="mt-6 text-center">
        <button className="px-6 py-2 text-primary font-medium text-sm hover:underline inline-flex items-center">
          <span>View All Players</span>
          <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      {!isLoading && waitingPlayers.length === 0 && (
        <div className="py-16 text-center text-slate-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p className="text-lg font-medium">No players in waiting room</p>
          <p>Check back later or invite players to join</p>
        </div>
      )}
    </section>
  );
}

export default WaitingRoom;