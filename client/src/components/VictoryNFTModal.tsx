import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Gift, Zap, Globe } from 'lucide-react';
import { useVictoryNFT } from '@/hooks/useVictoryNFT';

interface VictoryNFTModalProps {
  user: any;
  isVisible: boolean;
  onClose: () => void;
}

// Available chains for CCIP cross-chain minting
const AVAILABLE_CHAINS = [
  { id: 'base-sepolia', name: 'Base Sepolia', description: 'Ethereum L2 Testnet' },
  { id: 'avalanche-fuji', name: 'Avalanche Fuji', description: 'Avalanche Testnet' }
];

export default function VictoryNFTModal({ user, isVisible, onClose }: VictoryNFTModalProps) {
  const [selectedChain, setSelectedChain] = useState('avalanche-fuji');
  const { 
    isEligible, 
    nextMilestone, 
    progress, 
    isMinting, 
    mintVictoryNFT, 
    hasJustReachedMilestone,
    getVictoryStats 
  } = useVictoryNFT(user);

  if (!isVisible || !hasJustReachedMilestone()) {
    return null;
  }

  const victoryStats = getVictoryStats();

  const handleMint = async () => {
    // Pass selected chain to mint function
    await mintVictoryNFT(selectedChain);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in border-2 border-yellow-300 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-yellow-400 to-orange-500" />
        
        <div className="p-6">
          <div className="flex items-center justify-center mb-4">
            <Trophy className="w-10 h-10 text-yellow-600 mr-3" />
            <h2 className="text-2xl font-bold text-yellow-800">
              🎉 Victory NFT Unlocked!
            </h2>
          </div>
          
          <div className="text-center mb-6">
            <p className="text-lg text-gray-700 mb-2">
              Congratulations! You've reached <span className="font-bold text-yellow-600">{victoryStats.totalWins} wins</span>!
            </p>
            <p className="text-sm text-gray-600">
              Choose your destination chain to mint your exclusive Victory NFT.
            </p>
          </div>
          
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Progress to next NFT:</span>
              <span className="font-semibold">{victoryStats.winsToNextMilestone} wins left</span>
            </div>
            <Progress value={victoryStats.progress} className="h-3" />
            <p className="text-xs text-gray-500 mt-1">
              Next NFT at {victoryStats.nextMilestone} wins
            </p>
          </div>

          {/* Chain Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Globe className="w-4 h-4 inline mr-1" />
              Select Destination Chain
            </label>
            <Select value={selectedChain} onValueChange={setSelectedChain}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose destination chain" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_CHAINS.map((chain) => (
                  <SelectItem key={chain.id} value={chain.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{chain.name}</span>
                      <span className="text-xs text-gray-500">{chain.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Your NFT will be minted on {AVAILABLE_CHAINS.find(c => c.id === selectedChain)?.name}
            </p>
          </div>
          
          <div className="space-y-3">
            <Button
              onClick={handleMint}
              disabled={isMinting}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold h-12"
            >
              {isMinting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Minting NFT...
                </div>
              ) : (
                <div className="flex items-center">
                  <Gift className="w-5 h-5 mr-2" />
                  Mint Victory NFT
                </div>
              )}
            </Button>
            
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full h-10"
            >
              Close
            </Button>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center text-sm text-blue-700">
              <Zap className="w-4 h-4 mr-2" />
              <span>This NFT will be minted cross-chain using Chainlink CCIP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 