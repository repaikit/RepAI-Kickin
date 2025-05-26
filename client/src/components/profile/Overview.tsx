import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowUp, 
  Package, 
  Gift, 
  Trophy, 
  Star, 
  Gamepad2, 
  Award,
  Zap
} from 'lucide-react';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { toast } from "sonner";
import { websocketService } from '@/services/websocket';
import { useApi } from '@/hooks/useApi';

interface OverviewProps {
  user: any;
  currentPoint: number;
  nextMilestone: number;
  isLevelingUp: boolean;
  handleLevelUp: () => void;
  handleMysteryBox: (reward: Reward) => void;
}

interface BoxStatus {
  regular: {
    can_open: boolean;
    next_open: string | null;
    time_until_open: number;
  };
  level_up: {
    can_open: boolean;
    next_open: string | null;
    time_until_open: number;
    shots: number;
    available: boolean;
  };
}

interface Reward {
  type: 'skill' | 'remaining_matches';
  value: string | number;
  skill_type?: 'kicker' | 'goalkeeper';
  skill_name?: string;
  skill_value?: number;
}

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
        <div className="bg-white/20 rounded-lg px-2 py-1 min-w-[2.5rem] text-center">
          <span className="text-lg font-semibold text-white">{hours.toString().padStart(2, '0')}</span>
        </div>
        <span className="text-white/70">:</span>
        <div className="bg-white/20 rounded-lg px-2 py-1 min-w-[2.5rem] text-center">
          <span className="text-lg font-semibold text-white">{minutes.toString().padStart(2, '0')}</span>
        </div>
        <span className="text-white/70">:</span>
        <div className="bg-white/20 rounded-lg px-2 py-1 min-w-[2.5rem] text-center">
          <span className="text-lg font-semibold text-white">{seconds.toString().padStart(2, '0')}</span>
        </div>
      </div>
    </div>
  );
});

export default function Overview({ 
  user, 
  currentPoint, 
  nextMilestone, 
  isLevelingUp, 
  handleLevelUp, 
  handleMysteryBox 
}: OverviewProps) {
  const { fetchWithCache } = useApi();
  const [boxStatus, setBoxStatus] = useState<BoxStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLevelUpLoading, setIsLevelUpLoading] = useState(false);
  const [lastReward, setLastReward] = useState<Reward | null>(null);

  // Fetch box status
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
      }
    } catch (error) {
      console.error('Error fetching box status:', error);
    }
  }, [fetchWithCache]);

  // Wrap handleLevelUp to refresh box status after level up
  const handleLevelUpWithBoxRefresh = async () => {
    await handleLevelUp();
    await fetchBoxStatus(true);
  };

  // Open mystery box
  const handleOpenBox = async (boxType: "regular" | "level_up") => {
    if ((boxType === "level_up" ? isLevelUpLoading : isLoading) || 
        (boxType === "level_up" ? !boxStatus?.level_up?.can_open : !boxStatus?.regular?.can_open)) return;
    
    if (boxType === "level_up") {
      setIsLevelUpLoading(true);
    } else {
      setIsLoading(true);
    }

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
        body: JSON.stringify({ is_free: true, box_type: boxType })
      });

      if (!response.ok) {
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
        
        // Update box status
        setBoxStatus((prev: BoxStatus | null) => {
          if (!prev) return null;
          return {
            ...prev,
            regular: {
              ...prev.regular,
              can_open: boxType === "regular" ? false : prev.regular.can_open,
              next_open: boxType === "regular" ? data.data.next_open : prev.regular.next_open
            },
            level_up: {
              ...prev.level_up,
              can_open: boxType === "level_up" ? false : prev.level_up.can_open,
              next_open: boxType === "level_up" ? data.data.next_open : prev.level_up.next_open
            }
          };
        });

        // Refresh user data and show reward
        handleMysteryBox(reward);
      } else {
        toast.error(data.message || 'Failed to open box');
      }
    } catch (error) {
      console.error('Error opening box:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to open box');
    } finally {
      if (boxType === "level_up") {
        setIsLevelUpLoading(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  // Fetch box status on mount
  useEffect(() => {
    fetchBoxStatus();
  }, [fetchBoxStatus]);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Level Up Card */}
        <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ArrowUp className="w-5 h-5" />
              <span>Level Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-4">
              <p className={`text-sm mb-2 ${user?.can_level_up ? 'text-yellow-300' : 'text-white/70'}`}>
                {user?.can_level_up
                  ? "🎉 Ready to level up!"
                  : "Keep earning points to level up!"}
              </p>
              <div className="text-2xl font-bold mb-4">
                {currentPoint} / {nextMilestone} EXP
              </div>
            </div>
            <Button
              onClick={handleLevelUpWithBoxRefresh}
              disabled={!user?.can_level_up || isLevelingUp}
              className={`w-full bg-white/20 hover:bg-white/30 text-white border-white/30 ${!user?.can_level_up ? 'opacity-50 cursor-not-allowed' : 'animate-pulse'}`}
            >
              {isLevelingUp ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Leveling Up...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Zap className="mr-2 h-4 w-4" />
                  Level Up Now!
                </div>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Mystery Box Card */}
        <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="w-5 h-5" />
              <span>Mystery Box (5 Hours)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">📦</div>
              <p className="text-sm text-white/80 mb-4">
                Open mystery boxes every 5 hours to earn bonus rewards!
              </p>
              {boxStatus && !boxStatus.regular?.can_open && boxStatus.regular?.next_open && (
                <div className="flex justify-center mb-4">
                  <CountdownTimer timeLeft={boxStatus.regular.next_open} />
                </div>
              )}
            </div>
            <Button
              onClick={() => handleOpenBox("regular")}
              disabled={!boxStatus?.regular?.can_open || isLoading}
              className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Opening...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Gift className="mr-2 h-4 w-4" />
                  {boxStatus?.regular?.can_open ? 'Open Mystery Box' : 'Next box in 5 hours'}
                </div>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Mystery Box Level Up Card */}
      <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="w-5 h-5" />
            <span>Mystery Box Level Up</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">🎁</div>
            <p className="text-sm text-white/80 mb-4">
              Unlock special mystery boxes with exclusive rewards!
            </p>
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-sm">Higher chance of rare skills</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-sm">More matches per box</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-sm">Exclusive rewards</span>
              </div>
            </div>
          </div>
          <Button
            onClick={() => handleOpenBox("level_up")}
            disabled={
              !boxStatus?.level_up?.can_open || isLevelUpLoading || !boxStatus?.level_up?.available
            }
            className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            {isLevelUpLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Opening...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Gift className="mr-2 h-4 w-4" />
                {boxStatus?.level_up?.can_open
                  ? 'Open Level Up Box'
                  : (boxStatus?.level_up?.available
                      ? 'Level up to open box'
                      : 'Level up to open box')}
              </div>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-4 text-center">
            <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
            <div className="font-bold text-lg">{user?.legend_level ?? 0}</div>
            <div className="text-sm text-gray-600">Legend Level</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-4 text-center">
            <Star className="w-8 h-8 mx-auto mb-2 text-purple-500" />
            <div className="font-bold text-lg">{user?.vip_level ?? 'NONE'}</div>
            <div className="text-sm text-gray-600">VIP Level</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-4 text-center">
            <Gamepad2 className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <div className="font-bold text-lg">{user?.remaining_matches ?? 0}</div>
            <div className="text-sm text-gray-600">Matches Left</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-4 text-center">
            <Award className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <div className="font-bold text-lg">{user?.total_point ?? 0}</div>
            <div className="text-sm text-gray-600">Total Points</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 