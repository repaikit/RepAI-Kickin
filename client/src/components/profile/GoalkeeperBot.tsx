import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";

export interface BotGoalkeeper {
  skill: string[];
  energy: number;
  feed_quota: number;
}

interface GoalkeeperBotProps {
  bot: BotGoalkeeper | null;
  loading: boolean;
  error: string | null;
}

export default function GoalkeeperBot({ bot, loading, error }: GoalkeeperBotProps) {
  const [showSkills, setShowSkills] = useState(false);

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mt-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-left">
          <ShieldCheck className="w-5 h-5 text-indigo-500" />
          <span>Goalkeeper Bot</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2 text-sm text-gray-700">
        {loading ? (
          <p className="text-gray-500">Đang tải dữ liệu bot...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : bot ? (
          <>
            <p><strong>⚡ Năng lượng:</strong> {bot.energy.toFixed(1)}%</p>
            <p><strong>🍗 Lượt cho ăn còn lại:</strong> {bot.feed_quota}</p>

            <div>
              <button
                onClick={() => setShowSkills(!showSkills)}
                className="flex items-center space-x-1 text-indigo-600 hover:underline"
              >
                <span>{showSkills ? "Ẩn danh sách kỹ năng" : "Hiện danh sách kỹ năng"}</span>
                {showSkills ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showSkills && (
                <ul className="list-disc list-inside mt-2 text-sm text-gray-800">
                  {bot.skill.length > 0 ? (
                    bot.skill.map((s, i) => <li key={i}>{s}</li>)
                  ) : (
                    <li>Chưa có kỹ năng</li>
                  )}
                </ul>
              )}
            </div>
          </>
        ) : (
          <p className="text-gray-500">Không có dữ liệu bot.</p>
        )}
      </CardContent>
    </Card>
  );
}