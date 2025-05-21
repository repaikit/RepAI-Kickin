import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { websocketService } from '@/services/websocket';
import { useApi } from '@/hooks/useApi';

interface BoxStatus {
  can_open: boolean;
  next_open: string | null;
  time_until_open: number;
}

interface Reward {
  type: 'skill' | 'remaining_matches';
  value: string | number;
  skill_type?: 'kicker' | 'goalkeeper';
  skill_name?: string;
  skill_value?: number;
}

interface User {
  level?: number;
  [key: string]: any;
}

const MYSTERY_BOX_REWARDS = {
  shots: {
    1: 5,
    2: 5,
    3: 5,
    4: 5,
  } as const,
  skill: {
    1: '100-120',
    2: '100-120',
    3: '100-120',
    4: '121-150',
  } as const
};

// CountdownTimer tối ưu với React.memo
const CountdownTimer = React.memo(({ timeLeft }: { timeLeft: string }) => {
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(0);
  const [seconds, setSeconds] = useState<number>(0);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const nextOpen = new Date(timeLeft).getTime();
      const diff = nextOpen - now;
      if (diff <= 0) {
        setHours(0);
        setMinutes(0);
        setSeconds(0);
        return;
      }
      setHours(Math.floor(diff / (1000 * 60 * 60)));
      setMinutes(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
      setSeconds(Math.floor((diff % (1000 * 60)) / 1000));
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-1">
        <div className="bg-slate-100 rounded-lg px-2 py-1 min-w-[2.5rem] text-center">
          <span className="text-lg font-semibold text-primary">{hours.toString().padStart(2, '0')}</span>
        </div>
        <span className="text-slate-400">:</span>
        <div className="bg-slate-100 rounded-lg px-2 py-1 min-w-[2.5rem] text-center">
          <span className="text-lg font-semibold text-primary">{minutes.toString().padStart(2, '0')}</span>
        </div>
        <span className="text-slate-400">:</span>
        <div className="bg-slate-100 rounded-lg px-2 py-1 min-w-[2.5rem] text-center">
          <span className="text-lg font-semibold text-primary">{seconds.toString().padStart(2, '0')}</span>
        </div>
      </div>
    </div>
  );
});

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

function getLocalCache(key: string) {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    if (Date.now() - parsed.timestamp < CACHE_DURATION) {
      return parsed.data;
    }
    return null;
  } catch {
    return null;
  }
}

function setLocalCache(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

export default function TaskMysteryBoxDropdown() {
  const { user, checkAuth } = useAuth();
  const { fetchWithCache, clearCache } = useApi();
  const [isOpen, setIsOpen] = useState(false);
  const [boxStatus, setBoxStatus] = useState<BoxStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [lastReward, setLastReward] = useState<Reward | null>(null);
  const [claimStatus, setClaimStatus] = useState<any>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dailyTasks, setDailyTasks] = useState<any[]>([]);
  const [isClaimingTask, setIsClaimingTask] = useState<string | null>(null);
  const [boxStatusRetry, setBoxStatusRetry] = useState(0);
  const [claimStatusRetry, setClaimStatusRetry] = useState(0);
  const [dailyTasksRetry, setDailyTasksRetry] = useState(0);
  const MAX_RETRY = 2;

  // Get user's level
  const userLevel = (user as User)?.level || 1;

  // Debounce khi mở dropdown
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (isOpen) {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      debounceTimeout.current = setTimeout(() => {
        const cachedBox = getLocalCache('boxStatus');
        if (cachedBox) setBoxStatus(cachedBox);
        fetchBoxStatus(true);
        const cachedClaim = getLocalCache('claimStatus');
        if (cachedClaim) setClaimStatus(cachedClaim);
        fetchClaimStatus(true);
        const cachedTasks = getLocalCache('dailyTasks');
        if (cachedTasks) setDailyTasks(cachedTasks);
        fetchDailyTasks(true);
      }, 250);
    }
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
    // eslint-disable-next-line
  }, [isOpen]);

  // useMemo cho getPossibleRewards
  const possibleRewards = useMemo(() => {
    const level = userLevel >= 4 ? 4 : userLevel;
    return {
      shots: MYSTERY_BOX_REWARDS.shots[level as keyof typeof MYSTERY_BOX_REWARDS.shots],
      skill: MYSTERY_BOX_REWARDS.skill[level as keyof typeof MYSTERY_BOX_REWARDS.skill]
    };
  }, [userLevel]);

  // Lazy load lịch sử box (giả sử có tab 'mystery-box-history')
  const [activeTab, setActiveTab] = useState('tasks');
  const [boxHistory, setBoxHistory] = useState<any[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const fetchBoxHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const res = await fetch(API_ENDPOINTS.mystery_box.getHistory, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setBoxHistory(data.data);
    } catch {}
    setIsLoadingHistory(false);
  }, []);
  useEffect(() => {
    if (activeTab === 'mystery-box-history' && boxHistory === null) {
      fetchBoxHistory();
    }
  }, [activeTab, boxHistory, fetchBoxHistory]);

  // Khi fetch thành công, lưu vào localStorage
  const fetchBoxStatus = useCallback(async (forceRefresh = false) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('Please login to view mystery box');
        return;
      }
      const result = await fetchWithCache(
        API_ENDPOINTS.mystery_box.getStatus,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        },
        forceRefresh
      );
      if (result?.success === true) {
        setBoxStatus(result.data);
        setLocalCache('boxStatus', result.data);
        setBoxStatusRetry(0); // reset retry count
      } else if (boxStatusRetry < MAX_RETRY) {
        setBoxStatusRetry(prev => prev + 1);
        setTimeout(() => fetchBoxStatus(true), 2000);
      } else {
        toast.error(result?.message || 'Failed to fetch box status');
        setBoxStatusRetry(0);
      }
    } catch (error) {
      if (boxStatusRetry < MAX_RETRY) {
        setBoxStatusRetry(prev => prev + 1);
        setTimeout(() => fetchBoxStatus(true), 2000);
      } else {
        toast.error('Failed to fetch box status. Please try again.');
        setBoxStatusRetry(0);
      }
    }
  }, [boxStatusRetry, fetchWithCache]);

  const fetchClaimStatus = useCallback(async (forceRefresh = false) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('Please login to view claim status');
        return;
      }
      const data = await fetchWithCache(
        API_ENDPOINTS.task_claim_matches.getStatus,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        },
        forceRefresh
      );
      if (data?.success === true) {
        setClaimStatus(data.data);
        setLocalCache('claimStatus', data.data);
        setClaimStatusRetry(0);
      } else if (claimStatusRetry < MAX_RETRY) {
        setClaimStatusRetry(prev => prev + 1);
        setTimeout(() => fetchClaimStatus(true), 2000);
      } else {
        toast.error(data?.message || 'Failed to fetch claim status');
        setClaimStatusRetry(0);
      }
    } catch (error) {
      if (claimStatusRetry < MAX_RETRY) {
        setClaimStatusRetry(prev => prev + 1);
        setTimeout(() => fetchClaimStatus(true), 2000);
      } else {
        toast.error('Failed to fetch claim status. Please try again.');
        setClaimStatusRetry(0);
      }
    }
  }, [claimStatusRetry, fetchWithCache]);

  const fetchDailyTasks = useCallback(async (forceRefresh = false) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('Please login to view daily tasks');
        return;
      }
      const data = await fetchWithCache(
        API_ENDPOINTS.daily_tasks.get,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        },
        forceRefresh
      );
      if (data?.success === true) {
        setDailyTasks(data.data);
        setLocalCache('dailyTasks', data.data);
        setDailyTasksRetry(0);
      } else if (dailyTasksRetry < MAX_RETRY) {
        setDailyTasksRetry(prev => prev + 1);
        setTimeout(() => fetchDailyTasks(true), 2000);
      } else {
        toast.error(data?.message || 'Failed to fetch daily tasks');
        setDailyTasksRetry(0);
      }
    } catch (error) {
      if (dailyTasksRetry < MAX_RETRY) {
        setDailyTasksRetry(prev => prev + 1);
        setTimeout(() => fetchDailyTasks(true), 2000);
      } else {
        toast.error('Failed to fetch daily tasks. Please try again.');
        setDailyTasksRetry(0);
      }
    }
  }, [dailyTasksRetry, fetchWithCache]);

  // Lắng nghe sự kiện websocket
  useEffect(() => {
    const callbacks = {
      onUserUpdated: (updatedUser: any) => {
        // Cập nhật user trong context
        checkAuth();
      },
      onMysteryBoxOpened: (data: any) => {
        // Cập nhật box status và user
        fetchBoxStatus(true);
        checkAuth();
      },
      onTaskCompleted: (data: any) => {
        // Cập nhật daily tasks và user
        fetchDailyTasks(true);
        checkAuth();
      },
      onMatchesClaimed: (data: any) => {
        // Cập nhật claim status và user
        fetchClaimStatus(true);
        checkAuth();
      }
    };

    // Đăng ký các event listeners
    websocketService.setCallbacks(callbacks);

    // Cleanup
    return () => {
      websocketService.removeCallbacks(callbacks);
    };
  }, [checkAuth, fetchBoxStatus, fetchDailyTasks, fetchClaimStatus]);

  // Open mystery box
  const handleOpenBox = async () => {
    if (isLoading || !boxStatus?.can_open) return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('Please login to open mystery box');
        return;
      }

      const response = await fetch(API_ENDPOINTS.mystery_box.openBox, {
        method: 'POST',
        ...defaultFetchOptions,
        headers: {
          ...defaultFetchOptions.headers,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_free: true })
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try to refresh
          await checkAuth();
          toast.error('Session expired. Please try again.');
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to open box');
      }
      
      const data = await response.json();
      if (data.success) {
        const reward: Reward = {
          type: data.data.reward_type,
          value: data.data.reward_type === 'skill' ? data.data.skill_name : data.data.amount,
          skill_type: data.data.skill_type,
          skill_name: data.data.skill_name,
          skill_value: data.data.skill_value
        };
        setLastReward(reward);

        if (reward.type === 'skill') {
          toast.success(`Congratulations! You received a new ${reward.skill_type} skill: ${reward.skill_name} (${reward.skill_value} points)`);
        } else {
          toast.success(`Congratulations! You received ${reward.value} matches!`);
        }
        
        // Cập nhật box status ngay lập tức
        setBoxStatus((prev: BoxStatus | null) => ({
          ...prev!,
          can_open: false,
          next_open: data.data.next_open
        }));

        // Cập nhật user context
        await checkAuth();

        // Emit websocket event to update waiting room
        websocketService.sendUserUpdate({
          ...user,
          remaining_matches: reward.type === 'remaining_matches' ? (user?.remaining_matches || 0) + Number(reward.value) : user?.remaining_matches,
          kicker_skills: reward.type === 'skill' && reward.skill_type === 'kicker' ? [...(user?.kicker_skills || []), reward.skill_name] : user?.kicker_skills,
          goalkeeper_skills: reward.type === 'skill' && reward.skill_type === 'goalkeeper' ? [...(user?.goalkeeper_skills || []), reward.skill_name] : user?.goalkeeper_skills,
          name: user?.name || "Guest Player",
          user_type: user?.user_type || "guest",
          avatar: user?.avatar || "",
          role: user?.role || "user",
          is_active: user?.is_active ?? true,
          is_verified: user?.is_verified ?? false,
          trend: user?.trend || "neutral",
          level: user?.level || 1,
          total_point: user?.total_point || 0,
          total_kicked: user?.total_kicked || 0,
          kicked_win: user?.kicked_win || 0,
          total_keep: user?.total_keep || 0,
          keep_win: user?.keep_win || 0,
          is_pro: user?.is_pro || false,
        });
      } else {
        toast.error(data.message || 'Failed to open box');
      }
    } catch (error) {
      console.error('Error opening box:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to open box');
    } finally {
      setIsLoading(false);
    }
  };

  // Update countdown timer
  useEffect(() => {
    if (!boxStatus?.next_open) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const nextOpen = new Date(boxStatus.next_open!).getTime();
      const diff = nextOpen - now;

      if (diff <= 0) {
        setTimeLeft('Ready!');
        fetchBoxStatus();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [boxStatus?.next_open]);

  const handleClaimMatches = async () => {
    setIsClaiming(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('Please login to claim matches');
        return;
      }

      const res = await fetch(API_ENDPOINTS.task_claim_matches.claimMatches, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('You have claimed 50 free matches!');
        
        // Cập nhật claim status ngay lập tức
        setClaimStatus((prev: any) => ({
          ...prev,
          can_claim: false,
          next_claim: data.data.next_claim
        }));

        // Cập nhật user context
        await checkAuth();
        
        // Emit websocket event to update waiting room
        websocketService.sendUserUpdate({
          ...user,
          remaining_matches: (user?.remaining_matches || 0) + 50
        });
      } else {
        toast.error(data.message || 'You need to wait before claiming again!');
      }
    } catch (error) {
      console.error('Error claiming matches:', error);
      toast.error('Failed to claim matches. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  };

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleClaimTask = async (taskId: string) => {
    try {
      setIsClaimingTask(taskId);
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('Please login to claim reward');
        return;
      }

      const response = await fetch(API_ENDPOINTS.daily_tasks.claim, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ task_id: taskId })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try to refresh
          await checkAuth();
          toast.error('Session expired. Please try again.');
          return;
        }
        throw new Error(data.detail || 'Failed to claim reward');
      }

      if (data.success) {
        toast.success(`Successfully claimed ${data.reward} Matches!`);
        
        // Cập nhật daily tasks ngay lập tức
        setDailyTasks((prev: any[]) => prev.map(task => 
          task.id === taskId 
            ? { ...task, claimed: true }
            : task
        ));

        // Cập nhật user context
        await checkAuth();

        // Emit websocket event to update waiting room
        websocketService.sendUserUpdate({
          ...user,
          total_point: (user?.total_point || 0) + data.reward
        });
      } else {
        toast.error(data.message || 'Failed to claim reward');
      }
    } catch (error) {
      console.error('Error claiming task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to claim reward');
    } finally {
      setIsClaimingTask(null);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        className="flex items-center space-x-2 hover:bg-primary/10 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 21V5C16 3.89543 15.1046 3 14 3H10C8.89543 3 8 3.89543 8 5V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>Tasks & Box</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-slate-100 z-50"
          >
            <Tabs defaultValue="tasks" className="w-full" onValueChange={setActiveTab}>
              <TabsList className="w-full bg-slate-50 p-1">
                <TabsTrigger value="tasks" className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">Tasks</TabsTrigger>
                <TabsTrigger value="mystery-box" className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">Mystery Box</TabsTrigger>
                <TabsTrigger value="mystery-box-history" className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">History</TabsTrigger>
              </TabsList>

              <TabsContent value="tasks" className="p-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">Daily Tasks</h3>
                  <div className="bg-slate-50 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold mb-2">Daily Tasks</h4>
                    <ul className="space-y-2">
                      {dailyTasks.map((task: any) => (
                        <li key={task.id} className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{task.name}</span>
                            <span className="ml-2 text-primary">+{task.reward} pts</span>
                          </div>
                          {task.claimed ? (
                            <span className="text-green-600 font-semibold">Claimed</span>
                          ) : task.completed ? (
                            <Button
                              size="sm"
                              onClick={() => handleClaimTask(task.id)}
                              disabled={isClaimingTask === task.id}
                            >
                              {isClaimingTask === task.id ? 'Claiming...' : 'Claim'}
                            </Button>
                          ) : (
                            <span className="text-slate-400">Incomplete</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Claim 50 free matches every 5 hours</span>
                      {claimStatus && !claimStatus.can_claim && claimStatus.next_claim && (
                        <span className="text-sm text-slate-500">
                          <CountdownTimer timeLeft={claimStatus.next_claim} />
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={handleClaimMatches}
                      disabled={isClaiming || (claimStatus && !claimStatus.can_claim)}
                      className="w-full"
                    >
                      {isClaiming ? 'Claiming...' : 'Claim now'}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="mystery-box" className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-800">Mystery Box</h3>
                    <span className="text-sm text-slate-500">Level {userLevel}</span>
                  </div>

                  {boxStatus ? (
                    <div className="space-y-4">
                      {lastReward && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4"
                        >
                          <h4 className="font-medium text-green-800 mb-2 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Last Reward
                          </h4>
                          <div className="flex items-center space-x-3">
                            {lastReward.type === 'skill' ? (
                              <>
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                </div>
                                <div className="text-green-700">
                                  <p className="font-medium">New {lastReward.skill_type} Skill:</p>
                                  <p className="text-lg font-semibold">{lastReward.skill_name}</p>
                                  <p className="text-sm text-green-600">Value: {lastReward.skill_value} points</p>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                </div>
                                <div className="text-green-700">
                                  <p className="font-medium">Matches Added:</p>
                                  <p className="text-lg font-semibold">{lastReward.value} Matches</p>
                                </div>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                      
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-lg border border-slate-200">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-700">
                              {boxStatus.can_open 
                                ? "🎉 Box is ready to open!"
                                : "⏳ Next box available in:"}
                            </p>
                          </div>
                          
                          {!boxStatus.can_open && boxStatus.next_open && (
                            <div className="flex justify-center py-2">
                              <CountdownTimer timeLeft={boxStatus.next_open} />
                            </div>
                          )}
                          
                          <div className="bg-white/50 rounded-lg p-3">
                            <p className="text-sm font-medium text-slate-700 mb-2">Possible Rewards:</p>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Matches</span>
                                <span className="text-sm font-medium text-primary">{possibleRewards.shots}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Skill Points</span>
                                <span className="text-sm font-medium text-primary">{possibleRewards.skill}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white font-medium py-2.5"
                        disabled={!boxStatus.can_open || isLoading}
                        onClick={handleOpenBox}
                      >
                        {isLoading ? (
                          <div className="flex items-center space-x-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                            <span>Opening...</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z" />
                            </svg>
                            <span>Open Mystery Box</span>
                          </div>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <Skeleton className="h-32" />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="mystery-box-history" className="p-4">
                {isLoadingHistory ? (
                  <Skeleton className="h-32" />
                ) : Array.isArray(boxHistory) && boxHistory.length > 0 ? (
                  <ul className="space-y-2">
                    {boxHistory.map((item, idx) => (
                      <li key={idx} className="bg-slate-50 rounded p-2 border border-slate-100">
                        <div className="text-sm font-medium">{item.reward_type === 'skill' ? `Skill: ${item.skill_name}` : `Matches: ${item.amount}`}</div>
                        <div className="text-xs text-slate-500">{item.timestamp}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-slate-400 text-sm">No history found.</div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 