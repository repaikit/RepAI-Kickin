import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ChallengesProps {
  challenges: any[];
  isLoading: boolean;
}

export default function Challenges({ challenges, isLoading }: ChallengesProps) {
  const getStatusBadgeClasses = (status: string, theme: string) => {
    const baseClasses = "px-2 py-0.5 rounded-full text-xs font-medium";
    
    if (status === "ongoing") {
      return `${baseClasses} bg-green-50 text-green-700 border border-green-100`;
    }
    
    if (theme === "primary") {
      return `${baseClasses} bg-primary/10 text-primary border border-primary/20`;
    } else if (theme === "secondary") {
      return `${baseClasses} bg-secondary/10 text-secondary border border-secondary/20`;
    } else {
      return `${baseClasses} bg-accent/10 text-accent border border-accent/20`;
    }
  };

  const getIconColor = (theme: string) => {
    if (theme === "primary") return "text-primary";
    if (theme === "secondary") return "text-secondary";
    return "text-accent";
  };

  const getButtonClasses = (theme: string, status: string) => {
    const baseClasses = "px-3 py-1.5 rounded-lg text-xs font-medium flex-1 transition-colors";
    
    if (status === "ongoing") {
      return `${baseClasses} bg-slate-800 hover:bg-slate-700 text-white`;
    }
    
    if (theme === "primary") {
      return `${baseClasses} bg-primary hover:bg-primary/90 text-white`;
    }
    if (theme === "secondary") {
      return `${baseClasses} bg-secondary hover:bg-secondary/90 text-white`;
    }
    return `${baseClasses} bg-accent hover:bg-accent/90 text-white`;
  };

  const getGradientClasses = (theme: string) => {
    if (theme === "primary") return "from-primary/5 to-primary/10 border-primary/20";
    if (theme === "secondary") return "from-secondary/5 to-secondary/10 border-secondary/20";
    return "from-accent/5 to-accent/10 border-accent/20";
  };

  return (
    <section className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Active Challenges</h2>
          <p className="text-sm text-slate-500">Join or track ongoing competitions</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-xs px-3 py-1.5 h-auto">
          <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Challenge
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          // Loading skeletons
          Array(3).fill(0).map((_, index) => (
            <Card key={index} className="overflow-hidden border border-slate-100">
              <Skeleton className="w-full h-32" />
              <CardContent className="p-3">
                <div className="flex justify-between items-start mb-3">
                  <Skeleton className="h-5 w-28 mb-1.5" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="space-y-2 mb-3">
                  {[1, 2, 3].map((_, i) => (
                    <div key={i} className="flex items-center">
                      <Skeleton className="h-4 w-4 mr-2" />
                      <Skeleton className="h-3.5 w-full" />
                    </div>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : challenges.length > 0 ? (
          challenges.map((challenge) => (
            <Card 
              key={challenge.id} 
              className={`bg-gradient-to-br ${getGradientClasses(challenge.theme)} rounded-lg border overflow-hidden hover:shadow-md transition-shadow`}
            >
              <div className="relative">
                <img 
                  src={challenge.image} 
                  alt={challenge.title} 
                  className="w-full h-32 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
              
              <CardContent className="p-3">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-base font-semibold text-slate-800">{challenge.title}</h3>
                  <span className={getStatusBadgeClasses(challenge.status, challenge.theme)}>
                    {challenge.status === "ongoing" ? "Ongoing" : challenge.statusValue || "New"}
                  </span>
                </div>
                
                <div className="space-y-2 mb-3">
                  <div className="flex items-center">
                    <svg className={`${challenge.disabled ? "text-slate-500" : challenge.theme === "accent" ? "text-slate-700" : getIconColor(challenge.theme)} w-4 h-4`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className={`text-xs ml-1.5 ${challenge.theme === "accent" ? "text-slate-700" : challenge.disabled ? "text-slate-500" : "text-slate-600"}`}>{challenge.participants} participants</span>
                  </div>
                  <div className="flex items-center">
                    <svg className={`${challenge.disabled ? "text-slate-500" : challenge.theme === "accent" ? "text-slate-700" : getIconColor(challenge.theme)} w-4 h-4`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className={`text-xs ml-1.5 ${challenge.theme === "accent" ? "text-slate-700" : challenge.disabled ? "text-slate-500" : "text-slate-600"}`}>{challenge.location}</span>
                  </div>
                  <div className="flex items-center">
                    <svg className={`${challenge.disabled ? "text-slate-500" : challenge.theme === "accent" ? "text-slate-700" : getIconColor(challenge.theme)} w-4 h-4`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    <span className={`text-xs ml-1.5 ${challenge.theme === "accent" ? "text-slate-700" : challenge.disabled ? "text-slate-500" : "text-slate-600"}`}>{challenge.prize}</span>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    disabled={challenge.disabled}
                    className={
                      challenge.disabled
                        ? (challenge.theme === "accent"
                            ? "bg-accent/30 text-black cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-medium flex-1 flex items-center justify-center"
                            : "bg-slate-200 text-black cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-medium flex-1 flex items-center justify-center"
                          )
                        : getButtonClasses(challenge.theme, challenge.status)
                    }
                  >
                    {challenge.status === "ongoing" ? "View Stats" : "Join Challenge"}
                  </button>
                  <button className="bg-slate-50 hover:bg-slate-100 text-slate-600 p-1.5 rounded-lg text-xs transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-2 py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-base font-medium text-slate-800 mb-1">No Active Challenges</h3>
            <p className="text-sm text-slate-500 mb-4">Create a new challenge to get started</p>
            <Button className="bg-primary hover:bg-primary/90 text-xs px-3 py-1.5 h-auto">
              <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Challenge
            </Button>
          </div>
        )}
      </div>
      
      {!isLoading && challenges.length > 0 && (
        <div className="mt-4 text-center">
          <button className="text-primary text-xs font-medium hover:underline inline-flex items-center">
            <span>View All Challenges</span>
            <svg className="ml-1 w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}