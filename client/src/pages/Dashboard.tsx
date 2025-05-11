import { useQuery } from "@tanstack/react-query";
import { type Player, type Challenge, type Skills } from "@shared/schema";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Leaderboard from "@/components/Leaderboard";
import SkillsSidebar from "@/components/SkillsSidebar";
import Challenges from "@/components/Challenges";

export default function Dashboard() {
  const { data: players, isLoading: isPlayersLoading } = useQuery<Player[]>({
    queryKey: ["/api/players"],
  });

  const { data: challenges, isLoading: isChallengesLoading } = useQuery<Challenge[]>({
    queryKey: ["/api/challenges"],
  });

  // Find the goalkeeper player (Manuel Neuer)
  const goalkeeper = players?.find(player => player.position === "Goalkeeper");
  const goalkeeperId = goalkeeper?.id;

  // Find a kicker player (e.g., first Forward or any non-Goalkeeper)
  const kicker = players?.find(player => player.position !== "Goalkeeper") || players?.[0];

  // Fetch goalkeeper skills if we have the goalkeeper ID
  const { data: goalkeeperSkills, isLoading: isSkillsLoading } = useQuery<Skills>({
    queryKey: ["/api/skills", goalkeeperId],
    enabled: !!goalkeeperId,
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans">
      <Header />
      
      <div className="container mx-auto px-4 py-6 flex-1 flex flex-col gap-6">
        {/* Leaderboard Section - Full Width */}
        <section className="w-full">
          <Leaderboard players={players || []} isLoading={isPlayersLoading} />
        </section>
        
        {/* Skills Section - Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Kicker Skills */}
          <SkillsSidebar 
            goalkeeper={kicker} 
            isKicker={true}
            title="Kicker Skills"
            skills={undefined} 
            isLoading={isPlayersLoading} 
          />
          
          {/* Right Column - Goalkeeper Skills */}
          <SkillsSidebar 
            goalkeeper={goalkeeper} 
            isKicker={false}
            title="Goalkeeper Skills"
            skills={goalkeeperSkills} 
            isLoading={isSkillsLoading || isPlayersLoading} 
          />
        </div>
        
        {/* Bottom Section - Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Challenges */}
          <Challenges 
            challenges={challenges || []} 
            isLoading={isChallengesLoading} 
          />
          
          {/* Waiting Room */}
          <div className="bg-white rounded-xl shadow-md p-6 h-full">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Waiting Room</h2>
                <p className="text-slate-500">Players ready for matches</p>
              </div>
              <div className="bg-accent/10 text-accent px-3 py-1 rounded-full text-sm font-medium">
                <span className="mr-1">•</span> 12 Online
              </div>
            </div>
            
            <div className="space-y-4">
              {isPlayersLoading ? (
                Array(4).fill(0).map((_, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg">
                    <div className="h-12 w-12 rounded-full bg-slate-200 animate-pulse"></div>
                    <div className="flex-1">
                      <div className="h-5 w-32 mb-1 bg-slate-200 animate-pulse"></div>
                      <div className="h-4 w-24 bg-slate-200 animate-pulse"></div>
                    </div>
                    <div className="h-8 w-24 rounded-full bg-slate-200 animate-pulse"></div>
                  </div>
                ))
              ) : players ? (
                players.slice(0, 4).map((player) => (
                  <div 
                    key={player.id} 
                    className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg hover:border-primary/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="relative">
                      <img 
                        src={player.avatar} 
                        alt={player.name} 
                        className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm"
                      />
                      <span className="absolute -bottom-1 -right-1 bg-success w-4 h-4 rounded-full border-2 border-white"></span>
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-800">{player.name}</h3>
                      <p className="text-sm text-slate-500">
                        {player.position} • Win rate: {Math.round((player.wins / (player.wins + player.losses)) * 100)}%
                      </p>
                    </div>
                    
                    <button className="px-4 py-1.5 bg-primary/10 text-primary font-medium text-sm rounded-full hover:bg-primary hover:text-white transition-colors">
                      Challenge
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center text-slate-500">
                  <p className="text-lg font-medium">No players available</p>
                </div>
              )}
            </div>
            
            {!isPlayersLoading && players && players.length > 0 && (
              <div className="mt-6 text-center">
                <button className="px-6 py-2 text-primary font-medium text-sm hover:underline inline-flex items-center">
                  <span>View All Players</span>
                  <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
