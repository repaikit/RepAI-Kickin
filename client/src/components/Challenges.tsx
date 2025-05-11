import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type Challenge } from "@shared/schema";

interface ChallengesProps {
  challenges: Challenge[];
  isLoading: boolean;
}

export default function Challenges({ challenges, isLoading }: ChallengesProps) {
  const getStatusBadgeClasses = (status: string, theme: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    
    if (status === "ongoing") {
      return `${baseClasses} bg-success/20 text-success`;
    }
    
    if (theme === "primary") {
      return `${baseClasses} bg-accent/20 text-accent`;
    } else if (theme === "secondary") {
      return `${baseClasses} bg-success/20 text-success`;
    } else {
      return `${baseClasses} bg-accent/20 text-accent`;
    }
  };

  const getIconColor = (theme: string) => {
    if (theme === "primary") return "text-primary";
    if (theme === "secondary") return "text-secondary";
    return "text-accent";
  };

  const getButtonClasses = (theme: string) => {
    const baseClasses = "hover:bg-opacity-90 text-white px-3 py-2 rounded-lg text-sm flex-1 transition-colors";
    
    if (theme === "primary") return `${baseClasses} bg-primary`;
    if (theme === "secondary") return `${baseClasses} bg-secondary`;
    return `${baseClasses} bg-accent`;
  };

  const getGradientClasses = (theme: string) => {
    if (theme === "primary") return "from-primary/5 to-primary/10 border-primary/20";
    if (theme === "secondary") return "from-secondary/5 to-secondary/10 border-secondary/20";
    return "from-accent/5 to-accent/10 border-accent/20";
  };

  return (
    <section className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Active Challenges</h2>
          <p className="text-slate-500">Join or track ongoing competitions</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Challenge
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          // Loading skeletons
          Array(3).fill(0).map((_, index) => (
            <div key={index} className="rounded-xl overflow-hidden">
              <Skeleton className="w-full h-40" />
              <div className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="space-y-3 mb-4">
                  {[1, 2, 3].map((_, i) => (
                    <div key={i} className="flex items-center">
                      <Skeleton className="h-5 w-5 mr-2" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-10" />
                </div>
              </div>
            </div>
          ))
        ) : (
          challenges.map((challenge) => (
            <Card 
              key={challenge.id} 
              className={`bg-gradient-to-br ${getGradientClasses(challenge.theme)} rounded-xl border overflow-hidden`}
            >
              <div className="relative">
                <img 
                  src={challenge.image} 
                  alt={challenge.title} 
                  className="w-full h-40 object-cover"
                />
              </div>
              
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-slate-800">{challenge.title}</h3>
                  <span className={getStatusBadgeClasses(challenge.status, challenge.theme)}>
                    {challenge.statusValue}
                  </span>
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="flex items-center">
                    <svg className={`${getIconColor(challenge.theme)} w-5 h-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-sm text-slate-600 ml-2">{challenge.participants} participants</span>
                  </div>
                  <div className="flex items-center">
                    <svg className={`${getIconColor(challenge.theme)} w-5 h-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm text-slate-600 ml-2">{challenge.location}</span>
                  </div>
                  <div className="flex items-center">
                    <svg className={`${getIconColor(challenge.theme)} w-5 h-5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    <span className="text-sm text-slate-600 ml-2">{challenge.prize}</span>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button className={getButtonClasses(challenge.theme)}>
                    {challenge.status === "ongoing" ? "View Stats" : "Join Challenge"}
                  </button>
                  <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      
      {!isLoading && (
        <div className="mt-6 text-center">
          <button className="text-primary hover:text-primary/80 font-medium flex items-center justify-center mx-auto transition-colors">
            <span>View All Challenges</span>
            <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
