import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { websocketService } from '@/services/websocket';
import { useApi } from '@/hooks/useApi';

// CountdownTimer component
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
  const { fetchWithCache } = useApi();
  const [isOpen, setIsOpen] = useState(false);
  const [claimStatus, setClaimStatus] = useState<any>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dailyTasks, setDailyTasks] = useState<any[]>([]);
  const [isClaimingTask, setIsClaimingTask] = useState<string | null>(null);
  const [claimStatusRetry, setClaimStatusRetry] = useState(0);
  const [dailyTasksRetry, setDailyTasksRetry] = useState(0);
  const MAX_RETRY = 2;

  // Debounce khi mở dropdown
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (isOpen) {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      debounceTimeout.current = setTimeout(() => {
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
  }, [isOpen]);

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
  }, [checkAuth, fetchDailyTasks, fetchClaimStatus]);

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
        <span>Tasks</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-slate-100 z-50"
          >
            <div className="p-4">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 