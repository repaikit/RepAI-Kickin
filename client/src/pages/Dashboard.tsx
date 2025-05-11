import { useQuery } from "@tanstack/react-query";
import { type Player, type Challenge } from "@shared/schema";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Leaderboard from "@/components/Leaderboard";
import SkillsSidebar from "@/components/SkillsSidebar";
import Challenges from "@/components/Challenges";
import WaitingRoom from "@/components/WaitingRoom";

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
            skills={null} 
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
          <WaitingRoom 
            players={players || []} 
            isLoading={isPlayersLoading}
          />
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
