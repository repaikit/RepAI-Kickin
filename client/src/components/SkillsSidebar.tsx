import React, { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Circle } from "lucide-react";
import BuySkillButton from "./BuySkillButton";

interface Skill {
  _id: string;
  name: string;
  type: string;
  description: string;
  point: number;
}

interface SkillsSidebarProps {
  skills: Skill[];
  userSkills: string[];
  title: string;
  isLoading: boolean;
  userPoints: number;
  kickedWin?: number;
  keepWin?: number;
  onSkillBought?: () => void;
}

export default function SkillsSidebar({
  skills = [],
  userSkills = [],
  title = "Player Skills",
  isLoading,
  userPoints,
  kickedWin = 0,
  keepWin = 0,
  onSkillBought
}: SkillsSidebarProps) {
  // Check if user has learned a skill by comparing skill names
  const hasLearnedSkill = (skillName: string) => {
    return userSkills.includes(skillName);
  };

  // Sort skills - learned skills first, then alphabetically
  const sortedSkills = [...skills].sort((a, b) => {
    const aLearned = hasLearnedSkill(a.name);
    const bLearned = hasLearnedSkill(b.name);
    if (aLearned && !bLearned) return -1;
    if (!aLearned && bLearned) return 1;
    return a.name.localeCompare(b.name);
  });

  // Determine skill type from title
  const skillType = title.toLowerCase().includes('kicker') ? 'kicker' : 'goalkeeper';

  // Tổng skill_point
  const skillPoint = kickedWin + keepWin;

  // Giá skill cố định cho cả hai loại
  const skillCost = 10;

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      </div>
      {/* Skills List */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
            {skills.filter(s => hasLearnedSkill(s.name)).length} / {skills.length}
          </div>
          <div className="text-xs text-blue-600 font-semibold flex items-center gap-2">
            Skill Points: {skillPoint}
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-purple-600">Cost: {skillCost}</span>
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-1.5">
            {[1, 2, 3, 4, 5].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1.5 custom-scrollbar">
            {sortedSkills.map((skill) => {
              const isLearned = hasLearnedSkill(skill.name);
              return (
                <div
                  key={skill.name}
                  className={`flex items-center justify-between p-2 rounded-md transition-all duration-200 ${
                    isLearned
                      ? "bg-green-50 border border-green-100 hover:bg-green-100/50 hover:border-green-200"
                      : "bg-slate-50 border border-slate-100 hover:bg-slate-100/50 hover:border-slate-200"
                  }`}
                >
                  <span className={`text-xs ${
                    isLearned ? "text-green-800 font-medium" : "text-slate-500"
                  }`}>
                    {skill.name}
                  </span>
                  {isLearned ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Buy Skill Button */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <BuySkillButton 
          skillType={skillType}
          userPoints={skillPoint}
          skillCost={skillCost}
          onSuccess={onSkillBought}
        />
        <div className="text-xs text-slate-500 mt-2 text-center">
          Each skill purchase (Kicker or Goalkeeper) costs <span className="font-semibold text-purple-600">10</span> skill points.
        </div>
      </div>
    </div>
  );
}
