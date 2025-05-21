import { useQuery, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Leaderboard from "@/components/Leaderboard";
import SkillsSidebar from "@/components/SkillsSidebar";
import Challenges from "@/components/Challenges";
import { useRouter } from "next/router";
import { API_ENDPOINTS, defaultFetchOptions } from "@/config/api";
import { useState, useEffect, useCallback } from 'react';
import WaitingRoom from "@/components/WaitingRoom";
import { useAuth } from "@/contexts/AuthContext";
import GlobalChatPlaceholder from "@/components/GlobalChatPlaceholder";
import { useWebSocket } from '@/hooks/useWebSocket';


interface Skill {
  _id: string;
  name: string;
  type: string;
  description: string;
  point: number;
}

const TIMEOUT_DURATION = 15000; // 15 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchSkills = async (type: string, retryCount = 0): Promise<Skill[]> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_DURATION);

  try {
    const response = await fetch(API_ENDPOINTS.skills.getByType(type), {
      ...defaultFetchOptions,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${type} skills: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    
    if (retryCount < MAX_RETRIES) {
      await sleep(RETRY_DELAY);
      return fetchSkills(type, retryCount + 1);
    }
    
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
};

export default function Dashboard() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, checkAuth } = useAuth();
  const queryClient = useQueryClient();
  const [leaderboardPosition, setLeaderboardPosition] = useState("all");
  const [leaderboardSeason, setLeaderboardSeason] = useState("current");

  const [users, setUsers] = useState<any[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(true);

  const [kickerSkills, setKickerSkills] = useState<Skill[]>([]);
  const [goalkeeperSkills, setGoalkeeperSkills] = useState<Skill[]>([]);
  const [isSkillsLoading, setIsSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  const refreshUserData = useCallback(async () => {
    try {
      await checkAuth(); // This will refresh the user data in AuthContext
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  }, [checkAuth]);

  const refreshSkills = useCallback(async () => {
    try {
      // Don't set loading state to avoid UI flicker
      const [kicker, goalkeeper] = await Promise.all([
        fetchSkills("kicker"),
        fetchSkills("goalkeeper")
      ]);

      // Update skills states
      setKickerSkills(prevSkills => {
        const newSkills = [...prevSkills];
        kicker.forEach(newSkill => {
          const index = newSkills.findIndex(s => s._id === newSkill._id);
          if (index !== -1) {
            newSkills[index] = newSkill;
          } else {
            newSkills.push(newSkill);
          }
        });
        return newSkills;
      });

      setGoalkeeperSkills(prevSkills => {
        const newSkills = [...prevSkills];
        goalkeeper.forEach(newSkill => {
          const index = newSkills.findIndex(s => s._id === newSkill._id);
          if (index !== -1) {
            newSkills[index] = newSkill;
          } else {
            newSkills.push(newSkill);
          }
        });
        return newSkills;
      });
      
      // Refresh user data in background
      refreshUserData();
    } catch (error) {
      console.error('Failed to refresh skills:', error);
      setSkillsError('Failed to load skills. Please try again.');
    }
  }, [refreshUserData]);

  useEffect(() => {
    let isMounted = true;
    const fetchAllSkills = async () => {
      try {
        setIsSkillsLoading(true);
        setSkillsError(null);

        const [kicker, goalkeeper] = await Promise.all([
          fetchSkills("kicker"),
          fetchSkills("goalkeeper")
        ]);

        if (isMounted) {
          setKickerSkills(kicker);
          setGoalkeeperSkills(goalkeeper);
        }
      } catch (error) {
        setSkillsError('Failed to load skills. Please try again.');
      } finally {
        setIsSkillsLoading(false);
      }
    };

    fetchAllSkills();
    return () => { isMounted = false; };
  }, []);

  // Đồng bộ user khi có kết quả trận đấu
  useWebSocket({
    onChallengeResult: () => {
      checkAuth();
    }
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6 space-y-6">
        {/* Top row: Leaderboard and Chat */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Leaderboard
              onPositionChange={setLeaderboardPosition}
              onSeasonChange={setLeaderboardSeason}
              currentPosition={leaderboardPosition}
              currentSeason={leaderboardSeason}
            />
          </div>
          <div className="md:col-span-1">
            <GlobalChatPlaceholder />
          </div>
        </section>
        
        {/* Skills Section */}
        <section className="w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {skillsError ? (
            <div className="col-span-full text-center text-red-500">{skillsError}</div>
          ) : (
            <>
              <SkillsSidebar
                skills={kickerSkills}
                userSkills={user?.kicker_skills || []}
                title="Kicker Skills"
                isLoading={isSkillsLoading}
                userPoints={user?.kicked_win || 0}
                onSkillBought={refreshSkills}
                kickedWin={user?.kicked_win || 0}
                keepWin={user?.keep_win || 0}
              />

              <SkillsSidebar
                skills={goalkeeperSkills}
                userSkills={user?.goalkeeper_skills || []}
                title="Goalkeeper Skills"
                isLoading={isSkillsLoading}
                userPoints={user?.keep_win || 0}
                onSkillBought={refreshSkills}
                kickedWin={user?.kicked_win || 0}
                keepWin={user?.keep_win || 0}
              />

            </>
          )}
        </div>
        </section>
        
        {/* Active Challenges */}
        <section className="w-full">
          <Challenges 
            challenges={[]}
            isLoading={false}
          />
        </section>
        
        {/* Waiting Room */}
        <section className="w-full">
         <WaitingRoom/>
        </section>

      </main>
      
      <Footer />


    </div>
  );
}