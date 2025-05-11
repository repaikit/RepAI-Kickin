import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RadarChart } from "@/components/ui/radar-chart";
import { type Player, type Skills } from "@shared/schema";

interface SkillsSidebarProps {
  goalkeeper?: Player;
  skills?: Skills;
  isLoading: boolean;
  isKicker?: boolean;
  title?: string;
}

export default function SkillsSidebar({ 
  goalkeeper, 
  skills, 
  isLoading, 
  isKicker = false, 
  title = "Player Skills" 
}: SkillsSidebarProps) {
  
  // Different radar chart data based on player type
  const radarData = skills ? [
    { name: "Reflexes", current: skills.reflexes, previous: 89 },
    { name: "Positioning", current: skills.positioning, previous: 85 },
    { name: "One-on-Ones", current: skills.oneOnOnes, previous: 87 },
    { name: "Command of Area", current: skills.commandOfArea, previous: 83 },
    { name: "Distribution", current: skills.distribution, previous: 80 },
    { name: "Handling", current: skills.handling, previous: 84 },
  ] : isKicker ? [
    { name: "Speed", current: 92, previous: 89 },
    { name: "Shooting", current: 94, previous: 91 },
    { name: "Passing", current: 88, previous: 85 },
    { name: "Dribbling", current: 90, previous: 87 },
    { name: "Physical", current: 85, previous: 82 },
    { name: "Agility", current: 87, previous: 84 },
  ] : [];

  // Performance data based on player type
  const performanceData = isKicker ? [
    { name: "Goals Scored", value: 9.2 },
    { name: "Assists", value: 7.4 },
    { name: "Shot Accuracy", value: 8.5 },
  ] : [
    { name: "Reflexes", value: 9.2 },
    { name: "Positioning", value: 8.7 },
    { name: "Leadership", value: 9.5 },
  ];

  // Background color based on player type
  const themeColor = isKicker ? "secondary" : "primary";
  const bgColorClass = isKicker ? "bg-secondary/10" : "bg-primary/10";
  const textColorClass = isKicker ? "text-secondary" : "text-primary";
  const borderColorClass = isKicker ? "border-secondary" : "border-primary";

  // Player role
  const role = isKicker ? "Forward" : "Goalkeeper";

  // Stats label
  const statsLabel = isKicker ? "Goal Conversion" : "Save Rate";
  const statsValue = isKicker ? "78%" : "92%";

  return (
    <div className="bg-white rounded-xl shadow-md p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        <div className={`${bgColorClass} ${textColorClass} px-3 py-1 rounded-full text-sm font-medium`}>
          {role}
        </div>
      </div>
      
      {/* Player Profile */}
      <div className="flex flex-col items-center mb-8">
        {isLoading ? (
          <>
            <Skeleton className="w-32 h-32 rounded-full mb-4" />
            <Skeleton className="h-6 w-32 mb-1" />
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-4 w-16" />
          </>
        ) : goalkeeper ? (
          <>
            <img 
              src={goalkeeper.avatar} 
              alt={`${goalkeeper.name} Profile`} 
              className={`w-32 h-32 rounded-full object-cover border-4 ${borderColorClass} mb-4`}
            />
            <h3 className="text-lg font-bold text-slate-800">{goalkeeper.name}</h3>
            <p className="text-slate-500 text-sm">Professional {role}</p>
            <div className="flex items-center mt-2">
              <span className="text-success font-bold">{statsValue} </span>
              <span className="text-slate-500 text-sm ml-1">{statsLabel}</span>
            </div>
          </>
        ) : (
          <div className="text-center text-slate-500">
            No player data available
          </div>
        )}
      </div>

      {/* Skills Chart */}
      <div className="mb-8">
        <h3 className="text-md font-bold text-slate-700 mb-4">Skills Assessment</h3>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : goalkeeper ? (
          <div className="h-64 w-full">
            <RadarChart data={radarData} />
          </div>
        ) : (
          <div className="h-64 w-full flex items-center justify-center text-slate-500">
            No skills data available
          </div>
        )}
      </div>

      {/* Recent Performance */}
      <div>
        <h3 className="text-md font-bold text-slate-700 mb-4">Recent Performance</h3>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : goalkeeper ? (
          <div className="space-y-3">
            {performanceData.map((item, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">Last match rating</p>
                </div>
                <div className={`text-lg font-bold ${textColorClass}`}>{item.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-slate-500 py-4">
            No performance data available
          </div>
        )}
      </div>
    </div>
  );
}
