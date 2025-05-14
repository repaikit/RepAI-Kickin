import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Leaderboard from "@/components/Leaderboard";
import SkillsSidebar from "@/components/SkillsSidebar";
import Challenges from "@/components/Challenges";
import { useRouter } from "next/router";
import { API_ENDPOINTS, defaultFetchOptions } from "@/config/api";
import { useState, useEffect } from 'react';
import { useGuestUserContext } from "@/contexts/GuestUserContext";
import WaitingRoom from "@/components/WaitingRoom";
import { useLeaderboard } from "@/hooks/useLeaderboard";

export default function Dashboard() {
  const router = useRouter();
  const { guestUser, isLoading: isGuestUserLoading } = useGuestUserContext();
  const [leaderboardPosition, setLeaderboardPosition] = useState("all");
  const [leaderboardSeason, setLeaderboardSeason] = useState("current");
  const { data: leaderboardData, isLoading: isLeaderboardLoading } = useLeaderboard(leaderboardPosition, leaderboardSeason);
  
  // Debug logs for guest user
  useEffect(() => {
    console.log('Dashboard - Guest User State:', {
      guestUser,
      isLoading: isGuestUserLoading,
      sessionId: guestUser?.session_id,
      kickerSkills: guestUser?.kicker_skills,
      goalkeeperSkills: guestUser?.goalkeeper_skills
    });
  }, [guestUser, isGuestUserLoading]);

  // Fetch goalkeeper skills
  const { data: goalkeeperSkills, isLoading: isGoalkeeperSkillsLoading } = useQuery<any>({
    queryKey: ["skills", "goalkeeper"],
    queryFn: async () => {
      try {
        const url = API_ENDPOINTS.skills.getByType("goalkeeper");
        console.log('Fetching goalkeeper skills from:', url);
        const response = await fetch(url, defaultFetchOptions);
        if (!response.ok) {
          throw new Error(`Failed to fetch goalkeeper skills: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log('Goalkeeper skills response:', data);
        return data;
      } catch (error) {
        console.error('Error fetching goalkeeper skills:', error);
        throw error;
      }
    },
    enabled: true,
  });

  // Fetch kicker skills
  const { data: kickerSkills, isLoading: isKickerSkillsLoading } = useQuery<any>({
    queryKey: ["skills", "kicker"],
    queryFn: async () => {
      try {
        const url = API_ENDPOINTS.skills.getByType("kicker");
        console.log('Fetching kicker skills from:', url);
        const response = await fetch(url, defaultFetchOptions);
        if (!response.ok) {
          throw new Error(`Failed to fetch kicker skills: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log('Kicker skills response:', data);
        return data;
      } catch (error) {
        console.error('Error fetching kicker skills:', error);
        throw error;
      }
    },
    enabled: true,
  });

  useEffect(() => {
    console.log('Dashboard - Skills State:', {
      goalkeeperSkills,
      kickerSkills,
      isGoalkeeperSkillsLoading,
      isKickerSkillsLoading,
      guestUserSkills: {
        kicker: guestUser?.kicker_skills,
        goalkeeper: guestUser?.goalkeeper_skills
      }
    });
  }, [goalkeeperSkills, kickerSkills, isGoalkeeperSkillsLoading, isKickerSkillsLoading, guestUser]);

  if (isGuestUserLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-96 bg-slate-200 rounded"></div>
              <div className="h-96 bg-slate-200 rounded"></div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6 space-y-6">
        <section className="w-full">
          <Leaderboard 
            players={leaderboardData || []} 
            isLoading={isLeaderboardLoading}
            onPositionChange={setLeaderboardPosition}
            onSeasonChange={setLeaderboardSeason}
            currentPosition={leaderboardPosition}
            currentSeason={leaderboardSeason}
          />
        </section>
        
        {/* Skills Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkillsSidebar 
            isKicker={true}
            title="Kicker Skills"
            skills={kickerSkills || []} 
            userSkills={guestUser?.kicker_skills || []}
            isLoading={isKickerSkillsLoading} 
          />
          
          <SkillsSidebar 
            isKicker={false}
            title="Goalkeeper Skills"
            skills={goalkeeperSkills || []} 
            userSkills={guestUser?.goalkeeper_skills || []}
            isLoading={isGoalkeeperSkillsLoading} 
          />
        </div>
        
        {/* Active Challenges */}
        <section className="w-full">
          <Challenges 
            challenges={ []} 
            isLoading={false} 
          />
        </section>
        
        {/* Waiting Room */}
        <WaitingRoom />
      </main>
      
      <Footer />
    </div>
  );
}