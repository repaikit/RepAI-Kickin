import { useState, useEffect, useCallback } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { ccipService, CCIPMintResult } from '@/services/ccip';
import { AVALANCHE_FUJI_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID } from '@/constants/contract';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { toast } from 'sonner';

interface VictoryNFTState {
  isEligible: boolean;
  nextMilestone: number;
  progress: number;
  isMinting: boolean;
  lastMintedWins: number;
}

interface VictoryNFTData {
  user_id: string;
  player_address: string | null;
  player_name: string;
  total_wins: number;
  milestone_count: number;
  next_milestone: number;
  wins_to_next: number;
  victory_nfts: Array<{
    id: string;
    milestone: number;
    total_wins: number;
    message_id: string;
    destination_chain: string;
    contract_address: string;
    status: string;
    minted_at: string;
  }>;
  message?: string;
}

export function useVictoryNFT(user: any) {
  const [state, setState] = useState<VictoryNFTState>({
    isEligible: false,
    nextMilestone: 10,
    progress: 0,
    isMinting: false,
    lastMintedWins: 0
  });

  const [victoryNFTData, setVictoryNFTData] = useState<VictoryNFTData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // Calculate total wins
  const totalWins = (user?.kicked_win || 0) + (user?.keep_win || 0);

  // Fetch Victory NFT data from API
  const fetchVictoryNFTData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      console.log('🔍 Debug - Access token:', token ? 'Found' : 'Not found');
      
      if (!token) {
        console.warn('No access token found');
        return;
      }

      const headers = {
        ...defaultFetchOptions.headers,
        'Authorization': `Bearer ${token}`
      };
      
      console.log('🔍 Debug - Request headers:', headers);
      console.log('🔍 Debug - API URL:', API_ENDPOINTS.victory_nft.history);

      const response = await fetch(API_ENDPOINTS.victory_nft.history, {
        ...defaultFetchOptions,
        headers
      });

      console.log('🔍 Debug - Response status:', response.status);
      console.log('🔍 Debug - Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data: VictoryNFTData = await response.json();
        console.log('🔍 Debug - Response data:', data);
        setVictoryNFTData(data);
        
        // Update state based on API data
        setState(prev => ({
          ...prev,
          isEligible: data.wins_to_next === 0 && data.total_wins > 0,
          nextMilestone: data.next_milestone,
          progress: data.total_wins > 0 ? ((data.total_wins % 10) / 10) * 100 : 0,
          lastMintedWins: data.milestone_count * 10
        }));
      } else {
        console.error('Failed to fetch Victory NFT data:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error fetching Victory NFT data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch data on mount and when user changes
  useEffect(() => {
    fetchVictoryNFTData();
  }, [fetchVictoryNFTData]);

  // Update state when user data changes (fallback)
  useEffect(() => {
    if (user && !victoryNFTData) {
      const isEligible = ccipService.isEligibleForVictoryNFT(totalWins);
      const nextMilestone = ccipService.getNextVictoryMilestone(totalWins);
      const progress = ccipService.getVictoryProgress(totalWins);

      setState(prev => ({
        ...prev,
        isEligible,
        nextMilestone,
        progress: progress.progress,
        lastMintedWins: Math.floor(totalWins / 10) * 10
      }));
    }
  }, [user, totalWins, victoryNFTData]);

  /**
   * Mint Victory NFT when player reaches milestone
   */
  const mintVictoryNFT = useCallback(async (destinationChain?: string): Promise<CCIPMintResult> => {
    if (!user || !address) {
      toast.error('Please connect your wallet first');
      return { success: false, error: 'Wallet not connected' };
    }

    if (!state.isEligible) {
      toast.error('You need exactly 10 wins to mint a Victory NFT');
      return { success: false, error: 'Not eligible for Victory NFT' };
    }

    setState(prev => ({ ...prev, isMinting: true }));

    try {
      // Use selected chain or default to Avalanche Fuji
      const targetChainId = destinationChain === 'base-sepolia' ? BASE_SEPOLIA_CHAIN_ID : AVALANCHE_FUJI_CHAIN_ID;
      
      // Switch to target chain if needed
      if (chainId !== targetChainId) {
        try {
          await switchChain({ chainId: targetChainId });
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for chain switch
        } catch (error: any) {
          setState(prev => ({ ...prev, isMinting: false }));
          toast.error(`Please switch to ${destinationChain === 'base-sepolia' ? 'Base Sepolia' : 'Avalanche Fuji'} testnet to mint Victory NFT`);
          return { success: false, error: 'Failed to switch network' };
        }
      }

      // Mint the Victory NFT
      const result = await ccipService.mintVictoryNFT(
        address,
        totalWins,
        user.name || 'Anonymous Player',
        targetChainId
      );

      if (result.success) {
        toast.success(`🎉 Victory NFT minted successfully on ${destinationChain === 'base-sepolia' ? 'Base Sepolia' : 'Avalanche Fuji'}! You've won ${totalWins} matches!`);
        
        // Refresh data after successful mint
        await fetchVictoryNFTData();
        
        // Update state to reflect the mint
        setState(prev => ({
          ...prev,
          isEligible: false,
          lastMintedWins: totalWins,
          isMinting: false
        }));
      } else {
        toast.error(result.error || 'Failed to mint Victory NFT');
      }

      return result;

    } catch (error: any) {
      console.error('Victory NFT mint error:', error);
      toast.error('Failed to mint Victory NFT: ' + error.message);
      
      setState(prev => ({ ...prev, isMinting: false }));
      
      return {
        success: false,
        error: error.message
      };
    }
  }, [user, address, chainId, switchChain, totalWins, state.isEligible, fetchVictoryNFTData]);

  /**
   * Check if player just reached a milestone
   */
  const hasJustReachedMilestone = useCallback((): boolean => {
    // TEMPORARY: For testing dropdown, always return true if user has wins
    // TODO: Remove this after testing
    if (totalWins > 0) return true;
    
    return totalWins > 0 && totalWins % 10 === 0 && totalWins > state.lastMintedWins;
  }, [totalWins, state.lastMintedWins]);

  /**
   * Get Victory NFT stats
   */
  const getVictoryStats = useCallback(() => {
    if (victoryNFTData) {
      return {
        totalWins: victoryNFTData.total_wins,
        milestoneCount: victoryNFTData.milestone_count,
        nextMilestone: victoryNFTData.next_milestone,
        progress: victoryNFTData.total_wins > 0 ? ((victoryNFTData.total_wins % 10) / 10) * 100 : 0,
        winsToNextMilestone: victoryNFTData.wins_to_next
      };
    }

    // Fallback to calculated values
    const milestoneCount = Math.floor(totalWins / 10);
    const nextMilestone = ccipService.getNextVictoryMilestone(totalWins);
    const progress = ccipService.getVictoryProgress(totalWins);

    return {
      totalWins,
      milestoneCount,
      nextMilestone,
      progress: progress.progress,
      winsToNextMilestone: nextMilestone - totalWins
    };
  }, [totalWins, victoryNFTData]);

  return {
    ...state,
    totalWins,
    victoryNFTData,
    isLoading,
    mintVictoryNFT,
    hasJustReachedMilestone,
    getVictoryStats,
    refreshData: fetchVictoryNFTData
  };
} 