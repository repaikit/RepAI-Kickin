import React from 'react';
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

interface OverviewProps {
  user: any;
  currentPoint: number;
  nextMilestone: number;
  isLevelingUp: boolean;
  handleLevelUp: () => void;
  handleMysteryBox: () => void;
}

export default function Overview({ 
  user, 
  currentPoint, 
  nextMilestone, 
  isLevelingUp, 
  handleLevelUp, 
  handleMysteryBox 
}: OverviewProps) {
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
              onClick={handleLevelUp}
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
              <span>Mystery Box</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">📦</div>
              <p className="text-sm text-white/80 mb-4">
                Open mystery boxes to earn bonus rewards!
              </p>
            </div>
            <Button
              onClick={handleMysteryBox}
              className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <Gift className="mr-2 h-4 w-4" />
              Open Mystery Box
            </Button>
          </CardContent>
        </Card>
      </div>

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