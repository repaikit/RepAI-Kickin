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
  const [leaderboardPosition, setLeaderboardPosition] = useState("all");
  const [leaderboardSeason, setLeaderboardSeason] = useState("current");

  const [users, setUsers] = useState<any[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(true);

  const [kickerSkills, setKickerSkills] = useState<Skill[]>([]);
  const [goalkeeperSkills, setGoalkeeperSkills] = useState<Skill[]>([]);
  const [isSkillsLoading, setIsSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6 space-y-6">
        <section className="w-full">
          <Leaderboard
            onPositionChange={setLeaderboardPosition}
            onSeasonChange={setLeaderboardSeason}
            currentPosition={leaderboardPosition}
            currentSeason={leaderboardSeason}
          />
        </section>
        
        {/* Skills Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {skillsError ? (
            <div className="col-span-2 text-center text-red-500">{skillsError}</div>
          ) : (
            <>
              <SkillsSidebar
                skills={kickerSkills}
                userSkills={user?.kicker_skills || []}
                title="Kicker Skills"
                isLoading={isSkillsLoading}
              />
              <SkillsSidebar
                skills={goalkeeperSkills}
                userSkills={user?.goalkeeper_skills || []}
                title="Goalkeeper Skills"
                isLoading={isSkillsLoading}
              />
            </>
          )}
        </div>
        
        {/* Active Challenges */}
        <section className="w-full">
          <Challenges 
            challenges={[]} 
            isLoading={false} 
          />
        </section>
        
        {/* Waiting Room */}
        <WaitingRoom/>
      </main>
      
      <Footer />
    </div>
  );
}