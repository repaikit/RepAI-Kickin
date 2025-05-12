import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Leaderboard from "@/components/Leaderboard";
import SkillsSidebar from "@/components/SkillsSidebar";
import Challenges from "@/components/Challenges";
import { useRouter } from "next/router";
import { API_BASE_URL } from "@/config/api";

export default function Dashboard() {
  const router = useRouter();
  const { data: players, isLoading: isPlayersLoading } = useQuery<any[]>({
    queryKey: ["players"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/players`);
      if (!response.ok) {
        throw new Error('Failed to fetch players');
      }
      return response.json();
    }
  });

  const { data: challenges, isLoading: isChallengesLoading } = useQuery<any[]>({
    queryKey: ["challenges"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/challenges`);
      if (!response.ok) {
        throw new Error('Failed to fetch challenges');
      }
      return response.json();
    }
  });

  // Find the goalkeeper player
  const goalkeeper = players?.find((player: any) => player.position === "Goalkeeper");
  const goalkeeperId = goalkeeper?.id;

  // Find a kicker player
  const kicker = players?.find((player: any) => player.position !== "Goalkeeper") || players?.[0];

  // Fetch goalkeeper skills if we have the goalkeeper ID
  const { data: goalkeeperSkills, isLoading: isSkillsLoading } = useQuery<any>({
    queryKey: ["skills", goalkeeperId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/skills/${goalkeeperId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch skills');
      }
      return response.json();
    },
    enabled: !!goalkeeperId,
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6 space-y-6">
        {/* Leaderboard Section */}
        <section className="w-full">
          <Leaderboard players={players || []} isLoading={isPlayersLoading} />
        </section>
        
        {/* Skills Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkillsSidebar 
            goalkeeper={kicker} 
            isKicker={true}
            title="Kicker Skills"
            skills={undefined} 
            isLoading={isPlayersLoading} 
          />
          
          <SkillsSidebar 
            goalkeeper={goalkeeper} 
            isKicker={false}
            title="Goalkeeper Skills"
            skills={goalkeeperSkills} 
            isLoading={isSkillsLoading || isPlayersLoading} 
          />
        </div>
        
        {/* Active Challenges */}
        <section className="w-full">
          <Challenges 
            challenges={challenges || []} 
            isLoading={isChallengesLoading} 
          />
        </section>
        
        {/* Waiting Room */}
        <section className="w-full bg-white rounded-xl shadow-sm p-5">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Waiting Room</h2>
              <p className="text-sm text-slate-500">Players ready for matches</p>
            </div>
            <div className="bg-accent/10 text-accent px-2.5 py-1 rounded-full text-xs font-medium">
              <span className="mr-1">•</span> 12 Online
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isPlayersLoading ? (
              Array(4).fill(0).map((_, index) => (
                <div key={index} className="flex flex-col items-center gap-3 p-4 border border-slate-100 rounded-lg">
                  <div className="h-16 w-16 rounded-full bg-slate-100 animate-pulse"></div>
                  <div className="w-full text-center">
                    <div className="h-4 w-24 mb-1 bg-slate-100 animate-pulse mx-auto"></div>
                    <div className="h-3 w-20 bg-slate-100 animate-pulse mx-auto"></div>
                  </div>
                  <div className="h-7 w-20 rounded-full bg-slate-100 animate-pulse"></div>
                </div>
              ))
            ) : players ? (
              players.slice(0, 8).map((player) => (
                <div 
                  key={player.id} 
                  className="flex flex-col items-center gap-3 p-4 border border-slate-100 rounded-lg hover:border-primary/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="relative">
                    <img 
                      src={player.avatar} 
                      alt={player.name} 
                      className="h-16 w-16 rounded-full object-cover border-2 border-white shadow-sm"
                    />
                    <span className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-white"></span>
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-sm font-medium text-slate-800">{player.name}</h3>
                    <p className="text-xs text-slate-500">
                      {player.position} • Win rate: {Math.round((player.wins / (player.wins + player.losses)) * 100)}%
                    </p>
                  </div>
                  
                  <button className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full hover:bg-primary hover:text-white transition-colors">
                    Challenge
                  </button>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-500 col-span-4">
                <p className="text-sm font-medium">No players available</p>
              </div>
            )}
          </div>
          
          {!isPlayersLoading && players && players.length > 0 && (
            <div className="mt-5 text-center">
              <button className="text-primary text-xs font-medium hover:underline inline-flex items-center">
                <span>View All Players</span>
                <svg className="ml-1 w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
