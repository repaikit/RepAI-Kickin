import { useQuery, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Leaderboard from "@/components/Leaderboard";
import SkillsSidebar from "@/components/SkillsSidebar";
import Challenges from "@/components/Challenges";
import { useRouter } from "next/router";
import { API_ENDPOINTS, defaultFetchOptions } from "@/config/api";
import { useState, useEffect, useCallback } from 'react';
import { useGuestUserContext } from "@/contexts/GuestUserContext";
import WaitingRoom from "@/components/WaitingRoom";

// Cache time constants
const CACHE_TIME = 10 * 60 * 1000; // 10 minutes
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

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
    console.log(`[DEBUG] Fetching ${type} skills... (attempt ${retryCount + 1})`);
    const response = await fetch(API_ENDPOINTS.skills.getByType(type), {
      ...defaultFetchOptions,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${type} skills: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[DEBUG] Successfully fetched ${type} skills:`, data);
    return data;
  } catch (error) {
    console.error(`[DEBUG] Error fetching ${type} skills (attempt ${retryCount + 1}):`, error);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`[DEBUG] Retrying ${type} skills fetch in ${RETRY_DELAY}ms...`);
      await sleep(RETRY_DELAY);
      return fetchSkills(type, retryCount + 1);
    }
    
    console.error(`[DEBUG] All retries failed for ${type} skills`);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchUsers = async (retryCount = 0): Promise<any[]> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_DURATION);
  try {
    console.log(`[DEBUG] Fetching users... (attempt ${retryCount + 1})`);
    const response = await fetch(API_ENDPOINTS.users.getAll, {
      ...defaultFetchOptions,
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Failed to fetch users: ${response.status}`);
    const data = await response.json();
    console.log("[DEBUG] Successfully fetched users:", data.users);
    return data.users || [];
  } catch (error) {
    console.error(`[DEBUG] Error fetching users (attempt ${retryCount + 1}):`, error);
    if (retryCount < MAX_RETRIES) {
      console.log(`[DEBUG] Retrying users fetch in ${RETRY_DELAY}ms...`);
      await sleep(RETRY_DELAY);
      return fetchUsers(retryCount + 1);
    }
    console.error("[DEBUG] All retries failed for users");
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
};

export default function Dashboard() {
  const router = useRouter();
  const { guestUser, isLoading: isGuestUserLoading } = useGuestUserContext();
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
    const loadUsers = async () => {
      setIsUsersLoading(true);
      const usersData = await fetchUsers();
      if (isMounted) setUsers(usersData);
      setIsUsersLoading(false);
    };
    loadUsers();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchAllSkills = async () => {
      try {
        setIsSkillsLoading(true);
        setSkillsError(null);
        
        console.log('[DEBUG] Starting to fetch all skills...');
        const [kicker, goalkeeper] = await Promise.all([
          fetchSkills("kicker"),
          fetchSkills("goalkeeper")
        ]);
        
        console.log('[DEBUG] All skills fetched:', { kicker, goalkeeper });
        if (isMounted) {
          setKickerSkills(kicker);
          setGoalkeeperSkills(goalkeeper);
        }
      } catch (error) {
        console.error('[DEBUG] Error in fetchAllSkills:', error);
        setSkillsError('Failed to load skills. Please try again.');
      } finally {
        setIsSkillsLoading(false);
      }
    };

    fetchAllSkills();
    return () => { isMounted = false; };
  }, []);

  // Debug logs for guest user
  useEffect(() => {
    if (guestUser) {
      console.log('Dashboard - Guest User State:', {
        guestUser,
        isLoading: isGuestUserLoading,
        sessionId: guestUser.session_id,
        kickerSkills: guestUser.kicker_skills,
        goalkeeperSkills: guestUser.goalkeeper_skills
      });
    }
  }, [guestUser, isGuestUserLoading]);

  // Show loading state while guest user is initializing
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
            players={users}
            isLoading={isUsersLoading}
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
                userSkills={guestUser?.kicker_skills || []}
                title="Kicker Skills"
                isLoading={isSkillsLoading}
              />
              <SkillsSidebar
                skills={goalkeeperSkills}
                userSkills={guestUser?.goalkeeper_skills || []}
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
        {guestUser?.session_id && <WaitingRoom sessionId={guestUser.session_id} />}
      </main>
      
      <Footer />
    </div>
  );
}