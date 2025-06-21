"use client";

import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, Pause } from "lucide-react";

interface AutoPlayVIPProps {
  onMatchResult?: (result: any) => void;
}

export default function AutoPlayVIP({ onMatchResult }: AutoPlayVIPProps) {
  const { user } = useAuth();
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [lastMatchTime, setLastMatchTime] = useState<Date | null>(null);
  const [matchResult, setMatchResult] = useState<any>(null);
  const MATCH_DELAY = 3000; // 3 seconds delay between matches

  const { sendMessage, sendChallengeRequest } = useWebSocket({
    onUserList: (message) => {
      if (isAutoPlaying && user?.is_vip) {
        const availableOpponents = message.users.filter(
          (u: any) =>
            u.id !== user._id &&
            u.remaining_matches > 0 &&
            (!lastMatchTime ||
              new Date().getTime() - lastMatchTime.getTime() >= MATCH_DELAY)
        );

        if (availableOpponents.length > 0) {
          // Randomly select an opponent
          const randomOpponent =
            availableOpponents[
              Math.floor(Math.random() * availableOpponents.length)
            ];
          sendChallengeRequest(randomOpponent.id);
        }
      }
    },
    onChallengeResult: (message) => {
      if (isAutoPlaying) {
        setMatchResult(message);
        onMatchResult?.(message);
        setLastMatchTime(new Date());

        // Auto hide result after 2 seconds
        setTimeout(() => {
          setMatchResult(null);
          onMatchResult?.(null);
        }, 2000);
      }
    },
  });

  const toggleAutoPlay = useCallback(() => {
    if (!user?.is_vip) {
      toast.error("Auto-play is only available for VIP users");
      return;
    }

    setIsAutoPlaying((prev) => !prev);
    if (!isAutoPlaying) {
      toast.success("Auto-play started");
      // Trigger first match
      sendMessage({ type: "get_user_list" });
    } else {
      toast.info("Auto-play stopped");
    }
  }, [user, isAutoPlaying, sendMessage]);

  // Request user list periodically when auto-playing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoPlaying && user?.is_vip) {
      interval = setInterval(() => {
        sendMessage({ type: "get_user_list" });
      }, MATCH_DELAY);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying, user, sendMessage]);

  if (!user?.is_vip) return null;

  return (
    <div className="fixed bottom-6 right-24 z-30">
      <Button
        onClick={toggleAutoPlay}
        className={`${
          isAutoPlaying
            ? "bg-red-500 hover:bg-red-600"
            : "bg-green-500 hover:bg-green-600"
        } text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg`}
        title={isAutoPlaying ? "Stop Auto-play" : "Start Auto-play"}
      >
        {isAutoPlaying ? (
          <Pause className="w-6 h-6" />
        ) : (
          <Play className="w-6 h-6" />
        )}
      </Button>
    </div>
  );
}
