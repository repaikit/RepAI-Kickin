import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RadarChart } from "@/components/ui/radar-chart";
import { type Player, type Skills } from "@shared/schema";

interface SkillsSidebarProps {
  goalkeeper?: Player;
  skills?: Skills;
  isLoading: boolean;
}

export default function SkillsSidebar({ goalkeeper, skills, isLoading }: SkillsSidebarProps) {
  // Data for the radar chart
  const radarData = skills ? [
    { name: "Reflexes", current: skills.reflexes, previous: 89 },
    { name: "Positioning", current: skills.positioning, previous: 85 },
    { name: "One-on-Ones", current: skills.oneOnOnes, previous: 87 },
    { name: "Command of Area", current: skills.commandOfArea, previous: 83 },
    { name: "Distribution", current: skills.distribution, previous: 80 },
    { name: "Handling", current: skills.handling, previous: 84 },
  ] : [];

  const performanceData = [
    { name: "Reflexes", value: 9.2 },
    { name: "Positioning", value: 8.7 },
    { name: "Leadership", value: 9.5 },
  ];

  return (
    <aside className="lg:w-1/4 bg-white rounded-xl shadow-md p-6 order-2 lg:order-1">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">Goalkeeper Skills</h2>
        <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
          Position
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
              className="w-32 h-32 rounded-full object-cover border-4 border-primary mb-4"
            />
            <h3 className="text-lg font-bold text-slate-800">{goalkeeper.name}</h3>
            <p className="text-slate-500 text-sm">Professional Goalkeeper</p>
            <div className="flex items-center mt-2">
              <span className="text-success font-bold">92% </span>
              <span className="text-slate-500 text-sm ml-1">Save Rate</span>
            </div>
          </>
        ) : (
          <div className="text-center text-slate-500">
            No goalkeeper data available
          </div>
        )}
      </div>

      {/* Skills Chart */}
      <div className="mb-8">
        <h3 className="text-md font-bold text-slate-700 mb-4">Skills Assessment</h3>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : skills ? (
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
                <div className="text-lg font-bold text-primary">{item.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-slate-500 py-4">
            No performance data available
          </div>
        )}
      </div>
    </aside>
  );
}
