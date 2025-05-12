import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Circle } from "lucide-react";
// import { type Player, type Skills } from "@shared/schema";

interface SkillsSidebarProps {
  goalkeeper?: any;
  skills?: any;
  isLoading: boolean;
  isKicker?: boolean;
  title?: string;
}

const shootingSkills = [
  { id: 1, name: "Power shot to top left corner", learned: true },
  { id: 2, name: "Curved shot to top left corner", learned: false },
  { id: 3, name: "Soft shot to top left corner", learned: true },
  { id: 4, name: "Left Panenka", learned: false },
  { id: 5, name: "Outside foot shot to top left", learned: true },
  { id: 6, name: "Inside foot shot to bottom left", learned: false },
  { id: 7, name: "Soft curved shot to left", learned: true },
  { id: 8, name: "Ground shot with left spin", learned: false },
  { id: 9, name: "Left ground Panenka", learned: true },
  { id: 10, name: "Left trivela shot", learned: false },
  { id: 11, name: "Power shot to top right corner", learned: true },
  { id: 12, name: "Strong curved shot to right", learned: false },
  { id: 13, name: "Soft chip shot to right", learned: true },
  { id: 14, name: "Fake left then shoot right", learned: false },
  { id: 15, name: "Ground shot to bottom right", learned: true },
  { id: 16, name: "Outside foot ground shot right", learned: false },
  { id: 17, name: "Right toe-poke", learned: true },
  { id: 18, name: "Fake stop then shoot right", learned: false },
  { id: 19, name: "Low shot to right", learned: true },
  { id: 20, name: "Post-hitting shot right", learned: false },
  { id: 21, name: "Power shot to center", learned: true },
  { id: 22, name: "Center Panenka", learned: false },
  { id: 23, name: "No-look shot to center", learned: true },
  { id: 24, name: "Bouncing shot to center", learned: false },
  { id: 25, name: "Deceptive shot to center", learned: true },
  { id: 26, name: "Stop then shoot center", learned: false },
  { id: 27, name: "Weak foot shot to center", learned: true },
  { id: 28, name: "Slow center shot", learned: false },
  { id: 29, name: "Heel shot to center", learned: true },
  { id: 30, name: "Deceptive toe poke to center", learned: false },
  { id: 31, name: "Look left shoot right", learned: true },
  { id: 32, name: "Look right shoot left", learned: false },
  { id: 33, name: "Jump then soft shot", learned: true },
  { id: 34, name: "Step over then shot", learned: false },
  { id: 35, name: "Turn and shoot", learned: true },
  { id: 36, name: "Shot when keeper is down", learned: false },
  { id: 37, name: "Complete stop then shoot", learned: true },
  { id: 38, name: "Shot after turn", learned: false },
  { id: 39, name: "Shot after fake", learned: true },
  { id: 40, name: "One touch then shoot", learned: false },
  { id: 41, name: "Shot after whistle", learned: true },
  { id: 42, name: "Unusual slow shot", learned: false },
  { id: 43, name: "No run-up shot", learned: true },
  { id: 44, name: "First step power shot", learned: false },
  { id: 45, name: "Fast run then soft shot", learned: true },
  { id: 46, name: "Slow run then power shot", learned: false },
  { id: 47, name: "Change speed mid-run", learned: true },
  { id: 48, name: "Long step final shot", learned: false },
  { id: 49, name: "Two-foot jump then shoot", learned: true },
  { id: 50, name: "Shot after sudden stop", learned: false },
  { id: 51, name: "Rabona shot", learned: true },
  { id: 52, name: "Heel shot", learned: false },
  { id: 53, name: "Left curved trivela", learned: true },
  { id: 54, name: "Right curved trivela", learned: false },
  { id: 55, name: "Jump and volley", learned: true },
  { id: 56, name: "Back to goal shot", learned: false },
  { id: 57, name: "Shot after outside foot flick", learned: true },
  { id: 58, name: "Shot with spinning ball", learned: false },
  { id: 59, name: "Shot after ball flip", learned: true },
  { id: 60, name: "Soft shot after flick", learned: false },
  { id: 61, name: "Shot under pressure", learned: true },
  { id: 62, name: "Shot in silence", learned: false },
  { id: 63, name: "Shot after keeper taunt", learned: true },
  { id: 64, name: "Shot with opponent interference", learned: false },
  { id: 65, name: "Calm no-emotion shot", learned: true },
  { id: 66, name: "Shot after slip", learned: false },
  { id: 67, name: "Curved crossbar shot", learned: true },
  { id: 68, name: "Quick low surprise shot", learned: false },
  { id: 69, name: "Straight center with spin", learned: true },
  { id: 70, name: "Deceptive sudden shot", learned: false },
  { id: 71, name: "Extreme power instep shot", learned: true },
  { id: 72, name: "Inside foot to far corner", learned: false },
  { id: 73, name: "Soft curve near post", learned: true },
  { id: 74, name: "Weak foot deception", learned: false },
  { id: 75, name: "Quick shot after signal", learned: true },
  { id: 76, name: "Mid-air direction change", learned: false },
  { id: 77, name: "Lift then ground shot", learned: true },
  { id: 78, name: "Inside foot shot", learned: false },
  { id: 79, name: "Under ball scoop shot", learned: true },
  { id: 80, name: "Shot off standing foot", learned: false },
  { id: 81, name: "Reverse spin shot", learned: true },
  { id: 82, name: "Shot through keeper's legs", learned: false },
  { id: 83, name: "Shot to far corner dead spot", learned: true },
  { id: 84, name: "Soft roll into net", learned: false },
  { id: 85, name: "Bounce off surface shot", learned: true },
  { id: 86, name: "Downward drive shot", learned: false },
  { id: 87, name: "Slip then adjust shot", learned: true },
  { id: 88, name: "Mid-air direction change", learned: false },
  { id: 89, name: "Controlled slow shot", learned: true },
  { id: 90, name: "Three-step deception shot", learned: false },
  { id: 91, name: "Artistic style shot", learned: true },
  { id: 92, name: "Volley after control", learned: false },
  { id: 93, name: "Ankle shot", learned: true },
  { id: 94, name: "Shot after freeze", learned: false },
  { id: 95, name: "Quick shot after short run", learned: true },
  { id: 96, name: "Standing foot to difficult corner", learned: false },
  { id: 97, name: "Shot from turning step", learned: true },
  { id: 98, name: "Shot near post edge", learned: false },
  { id: 99, name: "Cross-foot jump shot", learned: true },
  { id: 100, name: "Body feint then shoot", learned: false }
];

const goalkeeperSkills = [
  { id: 1, name: "High dive to left", learned: true },
  { id: 2, name: "Early jump, left hand extension", learned: false },
  { id: 3, name: "Patient wait, high left jump", learned: true },
  { id: 4, name: "Center position with left hand up", learned: false },
  { id: 5, name: "Quick reflex to top left", learned: true },
  { id: 6, name: "Early dive, left hand low", learned: false },
  { id: 7, name: "Left side stretch", learned: true },
  { id: 8, name: "Left side reach, low center", learned: false },
  { id: 9, name: "No jump, wait and catch low left", learned: true },
  { id: 10, name: "Read curved trajectory to left", learned: false },
  { id: 11, name: "High dive to right", learned: true },
  { id: 12, name: "Timed jump to catch top right", learned: false },
  { id: 13, name: "Patient wait then push away", learned: true },
  { id: 14, name: "Not fooled, maintain right direction", learned: false },
  { id: 15, name: "Quick dive to right", learned: true },
  { id: 16, name: "Read right side spin", learned: false },
  { id: 17, name: "Low right reflex", learned: true },
  { id: 18, name: "No early jump, late timing", learned: false },
  { id: 19, name: "Right hand ground grab", learned: true },
  { id: 20, name: "Perfect angle slide catch", learned: false },
  { id: 21, name: "Stand still, use leg/knee block", learned: true },
  { id: 22, name: "Stand and wait without diving", learned: false },
  { id: 23, name: "Maintain center and track ball", learned: true },
  { id: 24, name: "Block with leg or body", learned: false },
  { id: 25, name: "Not fooled by eye contact", learned: true },
  { id: 26, name: "No early dive", learned: false },
  { id: 27, name: "Stay focused, maintain center", learned: true },
  { id: 28, name: "No hasty jump to other direction", learned: false },
  { id: 29, name: "Center goal reflex", learned: true },
  { id: 30, name: "Maintain balance, no early movement", learned: false },
  { id: 31, name: "Ignore eye direction", learned: true },
  { id: 32, name: "Maintain accurate direction", learned: false },
  { id: 33, name: "Time jump, wait and block", learned: true },
  { id: 34, name: "Stay calm, follow plant foot", learned: false },
  { id: 35, name: "Read body position", learned: true },
  { id: 36, name: "No early dive", learned: false },
  { id: 37, name: "Not caught in fake rhythm", learned: true },
  { id: 38, name: "Predict direction change timing", learned: false },
  { id: 39, name: "No jump on player's foot plant", learned: true },
  { id: 40, name: "Maintain position and delayed reflex", learned: false },
  { id: 41, name: "Super fast reflex", learned: true },
  { id: 42, name: "Stay calm, no early dive", learned: false },
  { id: 43, name: "Ready for surprises", learned: true },
  { id: 44, name: "Quick reflex and dive", learned: false },
  { id: 45, name: "Patient with rhythm changes", learned: true },
  { id: 46, name: "Ready for unexpected power", learned: false },
  { id: 47, name: "Not affected by run-up rhythm", learned: true },
  { id: 48, name: "Predict shot from foot movement", learned: false },
  { id: 49, name: "No hesitation, maintain rhythm", learned: true },
  { id: 50, name: "Prepare for next movement", learned: false },
  { id: 51, name: "Track main foot movement", learned: true },
  { id: 52, name: "Stay close, no ball slip", learned: false },
  { id: 53, name: "Read outside foot and direction", learned: true },
  { id: 54, name: "Predict spin from plant foot", learned: false },
  { id: 55, name: "Early jump for high ball", learned: true },
  { id: 56, name: "Maintain goal center", learned: false },
  { id: 57, name: "Read foot flick direction", learned: true },
  { id: 58, name: "Focus on curved trajectory", learned: false },
  { id: 59, name: "Reflex for volley", learned: true },
  { id: 60, name: "Low jump for ground bounce", learned: false },
  { id: 61, name: "Stay focused, no distraction", learned: true },
  { id: 62, name: "No psychological pressure", learned: false },
  { id: 63, name: "Strong mentality, maintain position", learned: true },
  { id: 64, name: "Prepare for all scenarios", learned: false },
  { id: 65, name: "Predict technique from stance", learned: true },
  { id: 66, name: "Reflex even for deflected ball", learned: false },
  { id: 67, name: "High enough jump and rebound reflex", learned: true },
  { id: 68, name: "Ground level hand reflex", learned: false },
  { id: 69, name: "Catch off-center trajectory", learned: true },
  { id: 70, name: "Read plant foot and balance", learned: false },
  { id: 71, name: "Catch powerful shot", learned: true },
  { id: 72, name: "Dive to far corner", learned: false },
  { id: 73, name: "Read light spin", learned: true },
  { id: 74, name: "Anticipate weak foot direction", learned: false },
  { id: 75, name: "Prepare for ultra-fast reflex", learned: true },
  { id: 76, name: "Not fooled by changes", learned: false },
  { id: 77, name: "Track low falling ball", learned: true },
  { id: 78, name: "Block with foot sole", learned: false },
  { id: 79, name: "Hook ball reflex", learned: true },
  { id: 80, name: "React to deflected ball", learned: false },
  { id: 81, name: "Catch reverse spin", learned: true },
  { id: 82, name: "Close legs at right moment", learned: false },
  { id: 83, name: "Dive to dead spot", learned: true },
  { id: 84, name: "No early dive, wait for soft shot", learned: false },
  { id: 85, name: "Catch bounce point", learned: true },
  { id: 86, name: "Grab straight down ball", learned: false },
  { id: 87, name: "React to player slip", learned: true },
  { id: 88, name: "Predict mid-air deflection", learned: false },
  { id: 89, name: "Track slow but tricky ball", learned: true },
  { id: 90, name: "Not fooled by fake moves", learned: false },
  { id: 91, name: "Stay calm before unusual play", learned: true },
  { id: 92, name: "Reflex for volley", learned: false },
  { id: 93, name: "Block with strong wrist", learned: true },
  { id: 94, name: "Predict surprise shot", learned: false },
  { id: 95, name: "React after short run-up", learned: true },
  { id: 96, name: "Read plant foot shot", learned: false },
  { id: 97, name: "Track ball in turn", learned: true },
  { id: 98, name: "Reflex near post", learned: false },
  { id: 99, name: "Catch in awkward position", learned: true },
  { id: 100, name: "Block shot with off-balance run-up", learned: false }
];

export default function SkillsSidebar({ 
  goalkeeper, 
  skills, 
  isLoading, 
  isKicker = false, 
  title = "Player Skills" 
}: SkillsSidebarProps) {
  // Background color based on player type
  const themeColor = isKicker ? "secondary" : "primary";
  const bgColorClass = isKicker ? "bg-secondary/10" : "bg-primary/10";
  const textColorClass = isKicker ? "text-secondary" : "text-primary";
  const borderColorClass = isKicker ? "border-secondary" : "border-primary";

  // Player role
  const role = isKicker ? "Forward" : "Goalkeeper";

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <div className={`${bgColorClass} ${textColorClass} px-2.5 py-1 rounded-full text-xs font-medium`}>
          {role}
        </div>
      </div>
      
      {/* Player Profile */}
      <div className="flex flex-col items-center mb-5">
        {isLoading ? (
          <>
            <Skeleton className="w-20 h-20 rounded-full mb-2.5" />
            <Skeleton className="h-4 w-28 mb-1" />
            <Skeleton className="h-3.5 w-20" />
          </>
        ) : goalkeeper ? (
          <>
            <div className="relative mb-2.5">
              <img 
                src={goalkeeper.avatar} 
                alt={`${goalkeeper.name} Profile`} 
                className={`w-20 h-20 rounded-full object-cover border-2 ${borderColorClass} shadow-sm`}
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-0.5">{goalkeeper.name}</h3>
            <p className="text-xs text-slate-500">{role}</p>
          </>
        ) : (
          <div className="text-center text-slate-500 py-3">
            <p className="text-sm">No player data available</p>
          </div>
        )}
      </div>

      {/* Skills List */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-700">
            {isKicker ? "Shooting Skills" : "Goalkeeper Skills"}
          </h3>
          <div className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
            {(isKicker ? shootingSkills : goalkeeperSkills).filter(s => s.learned).length} / 100
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-1.5">
            {[1, 2, 3, 4, 5].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto pr-1.5 custom-scrollbar">
            {(isKicker ? shootingSkills : goalkeeperSkills)
              .sort((a, b) => (b.learned ? 1 : 0) - (a.learned ? 1 : 0))
              .map((skill) => (
                <div 
                  key={skill.id} 
                  className={`flex items-center justify-between p-2 rounded-md transition-all duration-200 ${
                    skill.learned 
                      ? "bg-green-50 border border-green-100 hover:bg-green-100/50 hover:border-green-200" 
                      : "bg-slate-50 border border-slate-100 hover:bg-slate-100/50 hover:border-slate-200"
                  }`}
                >
                  <span className={`text-xs ${
                    skill.learned ? "text-green-800 font-medium" : "text-slate-500"
                  }`}>
                    {skill.name}
                  </span>
                  {skill.learned ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
