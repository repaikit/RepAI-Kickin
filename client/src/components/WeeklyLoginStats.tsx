import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO, startOfWeek, endOfWeek, addWeeks, isToday, isPast, isFuture } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, ChevronLeft, ChevronRight, Trophy, Flame, Star } from 'lucide-react';

interface DateStats {
  date: string;
  points: number;
  has_login: boolean;
}

interface WeekStats {
  week: string;
  dates: DateStats[];
  total_points: number;
}

export default function WeeklyLoginStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<WeekStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);

  useEffect(() => {
    const fetchWeeklyStats = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          setError('No access token found');
          return;
        }

        const response = await fetch(API_ENDPOINTS.users.weeklyStats, {
          ...defaultFetchOptions,
          headers: {
            ...defaultFetchOptions.headers,
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch weekly stats');
        }

        const data = await response.json();
        setStats(data.stats || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch weekly stats');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchWeeklyStats();
    }
  }, [user]);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-lg">
            <Calendar className="w-5 h-5 text-blue-500" />
            <span>Weekly Login</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto"></div>
            <div className="grid grid-cols-7 gap-2">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !stats.length) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-lg">
            <Calendar className="w-5 h-5 text-blue-500" />
            <span>Weekly Login</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              {error || 'No login data available'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentWeek = stats[currentWeekIndex];
  if (!currentWeek) return null;

  const getDayName = (dateString: string) => {
    return format(parseISO(dateString), 'EEE');
  };

  const getDayNumber = (dateString: string) => {
    return format(parseISO(dateString), 'd');
  };

  const getWeekRange = (dates: DateStats[]) => {
    if (!dates.length) return '';
    const start = parseISO(dates[0].date);
    const end = parseISO(dates[dates.length - 1].date);
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`;
  };

  const getStreakCount = (dates: DateStats[]) => {
    let streak = 0;
    for (let i = dates.length - 1; i >= 0; i--) {
      if (dates[i].has_login) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const loginDays = currentWeek.dates.filter(d => d.has_login).length;
  const streakCount = getStreakCount(currentWeek.dates);

  return (
    <Card className="w-full bg-gradient-to-br from-blue-50 to-purple-50 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2 text-lg">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <span>Weekly Login</span>
          </CardTitle>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentWeekIndex(Math.max(0, currentWeekIndex - 1))}
              disabled={currentWeekIndex === 0}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentWeekIndex(Math.min(stats.length - 1, currentWeekIndex + 1))}
              disabled={currentWeekIndex === stats.length - 1}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Week Info */}
        <div className="text-center">
          <h3 className="font-semibold text-gray-700 mb-1">
            {getWeekRange(currentWeek.dates)}
          </h3>
          <div className="flex justify-center space-x-4 text-xs text-gray-500">
            <span>{currentWeekIndex + 1} of {stats.length}</span>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center bg-white/60 rounded-lg p-3">
            <div className="flex items-center justify-center mb-1">
              <Trophy className="w-4 h-4 text-yellow-500 mr-1" />
            </div>
            <div className="text-lg font-bold text-gray-700">{currentWeek.total_points}</div>
            <div className="text-xs text-gray-500">Points</div>
          </div>
          <div className="text-center bg-white/60 rounded-lg p-3">
            <div className="flex items-center justify-center mb-1">
              <Star className="w-4 h-4 text-blue-500 mr-1" />
            </div>
            <div className="text-lg font-bold text-gray-700">{loginDays}/7</div>
            <div className="text-xs text-gray-500">Days</div>
          </div>
          <div className="text-center bg-white/60 rounded-lg p-3">
            <div className="flex items-center justify-center mb-1">
              <Flame className="w-4 h-4 text-orange-500 mr-1" />
            </div>
            <div className="text-lg font-bold text-gray-700">{streakCount}</div>
            <div className="text-xs text-gray-500">Streak</div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="space-y-2">
          {/* Day names header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {currentWeek.dates.map((date) => (
              <div key={`header-${date.date}`} className="text-center text-xs font-medium text-gray-500 py-1">
                {getDayName(date.date)}
              </div>
            ))}
          </div>
          
          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {currentWeek.dates.map((date) => {
              const dateObj = parseISO(date.date);
              const isCurrentDay = isToday(dateObj);
              const isPastDay = isPast(dateObj) && !isCurrentDay;
              const isFutureDay = isFuture(dateObj);
              
              return (
                <TooltipProvider key={date.date}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <div className={`
                          aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-medium transition-all duration-200 cursor-default
                          ${date.has_login 
                            ? 'bg-gradient-to-br from-green-400 to-green-500 text-white shadow-md hover:shadow-lg' 
                            : isPastDay 
                              ? 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              : isCurrentDay
                                ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 hover:bg-blue-200'
                                : 'bg-gray-50 text-gray-300'
                          }
                        `}>
                          <span className="text-xs font-bold">
                            {getDayNumber(date.date)}
                          </span>
                          {date.has_login && (
                            <div className="text-xs mt-1 opacity-90">
                              +{date.points}
                            </div>
                          )}
                        </div>
                        
                        {/* Login indicator dot */}
                        {date.has_login && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>
                        )}
                        
                        {/* Today indicator */}
                        {isCurrentDay && !date.has_login && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow-sm animate-pulse"></div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-900 text-white">
                      <div className="text-center">
                        <p className="font-medium">{format(dateObj, 'EEEE, MMMM d')}</p>
                        {date.has_login ? (
                          <p className="text-green-300">✓ Logged in (+{date.points} points)</p>
                        ) : isPastDay ? (
                          <p className="text-gray-400">No login</p>
                        ) : isCurrentDay ? (
                          <p className="text-blue-300">Today - Login to earn points!</p>
                        ) : (
                          <p className="text-gray-400">Future date</p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Weekly Progress</span>
            <span>{loginDays}/7 days</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(loginDays / 7) * 100}%` }}
            ></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}