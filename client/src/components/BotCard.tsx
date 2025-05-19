import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Infinity } from 'lucide-react';

interface BotCardProps {
  onPlayWithBot: () => void;
}

export default function BotCard({ onPlayWithBot }: BotCardProps) {
  return (
    <Card className="w-full max-w-sm bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-indigo-200 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          <Avatar className="h-12 w-12 border-2 border-indigo-500 shadow-md">
            <AvatarImage src="/bot-avatar.png" alt="Bot" />
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500">
              <Bot className="h-6 w-6 text-white" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Bot Player</h3>
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-600 border border-indigo-200">
                AI
              </Badge>
            </div>
            <p className="text-sm text-indigo-600/80">Practice mode - No points awarded</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center space-x-2 text-indigo-700">
            <Infinity className="h-5 w-5 text-indigo-500" />
            <p className="text-sm font-medium">Unlimited matches available</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-indigo-100">
            <p className="text-sm text-indigo-700/90">
              Play against our AI bot to practice your skills. Matches against the bot:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-indigo-600/80">
              <li>• Do not count towards your daily matches</li>
              <li>• Do not affect your ranking or points</li>
              <li>• Are perfect for skill practice</li>
            </ul>
          </div>
        </div>

        <Button 
          onClick={onPlayWithBot}
          className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-300"
        >
          Play Practice Match
        </Button>
      </CardContent>
    </Card>
  );
} 