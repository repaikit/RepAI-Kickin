import React, { useState, useEffect, useRef } from 'react';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";

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

const CountdownTimer = ({ timeLeft }: { timeLeft: string }) => {
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
};

export default function TaskMysteryBoxDropdown() {
  const { user, checkAuth } = useAuth();
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

  // Get user's level
  const userLevel = (user as User)?.level || 1;

  const getPossibleRewards = () => {
    const level = userLevel >= 4 ? 4 : userLevel;
    return {
      shots: MYSTERY_BOX_REWARDS.shots[level as keyof typeof MYSTERY_BOX_REWARDS.shots],
      skill: MYSTERY_BOX_REWARDS.skill[level as keyof typeof MYSTERY_BOX_REWARDS.skill]
    };
  };

  // Fetch box status
  const fetchBoxStatus = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('No access token found');
        return;
      }

      const response = await fetch(API_ENDPOINTS.mystery_box.getStatus, {
        ...defaultFetchOptions,
        headers: {
          ...defaultFetchOptions.headers,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try to refresh
          await checkAuth();
          return;
        }
        throw new Error('Failed to fetch box status');
      }

      const result = await response.json();
      if (result.success) {
        setBoxStatus(result.data);
      }
    } catch (error) {
      console.error('Error fetching box status:', error);
      toast.error('Failed to fetch box status');
    }
  };

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
        
        // Refresh auth and box status
        await checkAuth();
        await fetchBoxStatus();
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

  // Fetch status when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchBoxStatus();
    }
  }, [isOpen]);

  const fetchClaimStatus = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const res = await fetch(API_ENDPOINTS.task_claim_matches.getStatus, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) setClaimStatus(data.data);
  };

  const handleClaimMatches = async () => {
    setIsClaiming(true);
    const token = localStorage.getItem('access_token');
    const res = await fetch(API_ENDPOINTS.task_claim_matches.claimMatches, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      toast.success('You have claimed 50 free matches!');
      fetchClaimStatus();
      await checkAuth(); // update user info
    } else {
      toast.error(data.message || 'You need to wait before claiming again!');
    }
    setIsClaiming(false);
  };

  useEffect(() => {
    if (isOpen) fetchClaimStatus();
  }, [isOpen]);

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

  const fetchDailyTasks = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('No access token found');
        return;
      }
      
      const response = await fetch(API_ENDPOINTS.daily_tasks.get, {
        ...defaultFetchOptions,
        headers: {
          ...defaultFetchOptions.headers,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try to refresh
          await checkAuth();
          return;
        }
        throw new Error('Failed to fetch daily tasks');
      }

      const data = await response.json();
      if (data.success) {
        setDailyTasks(data.data);
      } else {
        toast.error(data.message || 'Failed to fetch daily tasks');
      }
    } catch (error) {
      console.error('Error fetching daily tasks:', error);
      toast.error('Failed to fetch daily tasks');
    }
  };

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
        toast.success(`Successfully claimed ${data.reward} points!`);
        // Refresh tasks and user data
        await fetchDailyTasks();
        await checkAuth();
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

  useEffect(() => {
    if (isOpen) fetchDailyTasks();
  }, [isOpen]);

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
            <Tabs defaultValue="tasks" className="w-full">
              <TabsList className="w-full bg-slate-50 p-1">
                <TabsTrigger value="tasks" className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">Tasks</TabsTrigger>
                <TabsTrigger value="mystery-box" className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">Mystery Box</TabsTrigger>
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
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-slate-500">Complete daily tasks to earn rewards!</p>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Play 5 matches</span>
                        <span className="text-sm font-medium text-primary">+10 points</span>
                      </div>
                      <Progress value={0} className="h-2" />
                    </div>
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
                                <span className="text-sm font-medium text-primary">{getPossibleRewards().shots}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Skill Points</span>
                                <span className="text-sm font-medium text-primary">{getPossibleRewards().skill}</span>
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
            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 