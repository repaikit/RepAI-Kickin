import { useQuery } from "@tanstack/react-query";
import { type Player, type Challenge } from "@shared/schema";
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

  // Fetch goalkeeper skills if we have the goalkeeper ID
  const { data: goalkeeperSkills, isLoading: isSkillsLoading } = useQuery({
    queryKey: ["/api/skills", goalkeeperId],
    enabled: !!goalkeeperId,
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans">
      <Header />
      
      <div className="container mx-auto px-4 py-6 flex-1 flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar - Goalkeeper Skills */}
        <SkillsSidebar 
          goalkeeper={goalkeeper} 
          skills={goalkeeperSkills} 
          isLoading={isSkillsLoading || isPlayersLoading} 
        />
        
        {/* Main Content Area */}
        <main className="lg:w-3/4 flex flex-col space-y-6 order-1 lg:order-2">
          {/* Leaderboard Section */}
          <Leaderboard players={players || []} isLoading={isPlayersLoading} />
          
          {/* Challenges Section */}
          <Challenges challenges={challenges || []} isLoading={isChallengesLoading} />
        </main>
      </div>
      
      <Footer />
    </div>
  );
}
