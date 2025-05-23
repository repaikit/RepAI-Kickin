import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';

interface BuySkillButtonProps {
  skillType: 'kicker' | 'goalkeeper';
  userPoints: number;
  skillCost: number;
  onSuccess?: () => void;
}

export default function BuySkillButton({ skillType, userPoints, skillCost, onSuccess }: BuySkillButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const requiredPoints = skillType === 'kicker' ? 10 : 5;
  const pointField = skillType === 'kicker' ? 'kicked_win' : 'keep_win';

  const handleBuySkill = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('Please login to buy skills');
        return;
      }

      if (userPoints < skillCost) return;

      setIsLoading(true);
      const response = await fetch(API_ENDPOINTS.skills.buySkill, {
        ...defaultFetchOptions,
        method: 'POST',
        body: JSON.stringify({
          skill_type: skillType,
          points: requiredPoints
        }),
        headers: {
          ...defaultFetchOptions.headers,
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Failed to buy skill');
      }

      if (onSuccess) {
        await onSuccess();
      }
      
      toast.success(`Successfully bought new ${skillType} skill!`);
    } catch (error) {
      console.error('Buy skill error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to buy skill');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        onClick={handleBuySkill}
        disabled={isLoading || userPoints < skillCost}
        className={`w-full ${
          userPoints >= skillCost 
            ? 'bg-green-600 hover:bg-green-700' 
            : 'bg-gray-400 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          'Buying...'
        ) : (
          `Buy New Skill`
        )}
      </Button>
      <p className="text-xs text-gray-500">
        You have {userPoints} {pointField.replace('_', ' ')} points
      </p>
    </div>
  );
} 