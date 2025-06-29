import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Gift, ExternalLink, Clock, Zap } from 'lucide-react';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { toast } from 'sonner';

interface VictoryNFTProps {
  user: any;
}

interface VictoryNFTData {
  user_id: string;
  player_address: string;
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
}

interface SupportedChain {
  name: string;
  chain_id: number;
  nft_contract: string;
}

export default function VictoryNFT({ user }: VictoryNFTProps) {
  const [victoryData, setVictoryData] = useState<VictoryNFTData | null>(null);
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState(false);
  const [supportedChains, setSupportedChains] = useState<SupportedChain[]>([]);
  const [selectedDestinationChain, setSelectedDestinationChain] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedDestinationChain') || "43113";
    }
    return "43113";
  });

  useEffect(() => {
    if (user) {
      fetchVictoryNFTData();
      fetchSupportedChains();
    } else {
      setLoading(false); // Nếu không có user, dừng loading để không bị kẹt skeleton
    }
  }, [user]);

  useEffect(() => {
    const savedChain = localStorage.getItem('selectedDestinationChain');
    if (savedChain && savedChain !== selectedDestinationChain) {
      setSelectedDestinationChain(savedChain);
    }
    // eslint-disable-next-line
  }, []);

  const fetchVictoryNFTData = async () => {
    if (!user) return;

    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.warn('No access token found');
        setLoading(false);
        return;
      }

      const response = await fetch(API_ENDPOINTS.victory_nft.history, {
        ...defaultFetchOptions,
        headers: {
          ...defaultFetchOptions.headers,
          'Authorization': `Bearer ${token}`
        }
      });

      let data = null;
      try {
        data = await response.clone().json();
      } catch (e) {
        console.error('Victory NFT API response is not JSON:', e);
      }
      console.log('Victory NFT API response:', response.status, data);

      if (response.ok && data) {
        setVictoryData(data);
      } else {
        setVictoryData(null);
        console.error('Failed to fetch Victory NFT data:', response.status, data);
      }
    } catch (error) {
      setVictoryData(null);
      console.error('Error fetching Victory NFT data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportedChains = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.victory_nft.supported_chains);
      console.log('Supported chains response:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Supported chains data:', data);
        if (data.success) {
          const chains = Object.keys(data.chains).map(key => data.chains[key]);
          console.log('Parsed chains:', chains);
          setSupportedChains(chains as SupportedChain[]);
        }
      }
    } catch (error) {
      console.error('Error fetching supported chains:', error);
    }
  };

  const handleMintNFT = async () => {
    if (!victoryData || !victoryData.player_address) {
      toast.error('No wallet address found');
      return;
    }

    setMinting(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('No access token found');
        return;
      }

      // Get current chain as source (default to Base Sepolia)
      const sourceChainId = 84532; // Base Sepolia
      const destinationChainId = parseInt(selectedDestinationChain);

      const response = await fetch(`${API_ENDPOINTS.victory_nft.mint_cross_chain}?source_chain_id=${sourceChainId}&destination_chain_id=${destinationChainId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`🎉 Victory NFT minted on ${result.destination_chain}!`);
        fetchVictoryNFTData(); // Refresh data
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to mint NFT');
      }
    } catch (error) {
      console.error('Error minting NFT:', error);
      toast.error('Failed to mint NFT');
    } finally {
      setMinting(false);
    }
  };

  const calculateProgress = () => {
    if (!victoryData) return 0;
    const currentWins = victoryData.total_wins;
    const nextMilestone = victoryData.next_milestone;
    const previousMilestone = Math.floor(currentWins / 10) * 10;
    const progress = ((currentWins - previousMilestone) / (nextMilestone - previousMilestone)) * 100;
    return Math.min(progress, 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isEligibleForMint = () => {
    if (!victoryData) return false;
    
    // Check if user has reached an exact milestone (130, 140, 150...)
    const isExactMilestone = victoryData.total_wins % 10 === 0;
    
    if (!isExactMilestone) return false;
    
    // Check if user has already minted NFT for current milestone
    const currentMilestone = victoryData.total_wins / 10;
    const hasMintedForCurrentMilestone = victoryData.victory_nfts.some(
      nft => nft.milestone === currentMilestone
    );
    
    // Debug: log để xem dữ liệu
    console.log('VictoryNFT Debug:', {
      total_wins: victoryData.total_wins,
      wins_to_next: victoryData.wins_to_next,
      milestone_count: victoryData.milestone_count,
      currentMilestone: currentMilestone,
      isExactMilestone: isExactMilestone,
      hasWins: victoryData.total_wins > 0,
      hasMintedForCurrentMilestone: hasMintedForCurrentMilestone,
      eligible: victoryData.total_wins > 0 && isExactMilestone && !hasMintedForCurrentMilestone
    });
    
    // Hiển thị dropdown khi đạt milestone chính xác (130, 140, 150...) và chưa mint NFT cho milestone này
    return victoryData.total_wins > 0 && isExactMilestone && !hasMintedForCurrentMilestone;
  };

  // Thêm log ở render
  console.log('VictoryNFT loading:', loading, 'victoryData:', victoryData);

  // Khi user chọn chain, lưu vào localStorage
  const handleChainChange = (value: string) => {
    setSelectedDestinationChain(value);
    localStorage.setItem('selectedDestinationChain', value);
  };

  if (loading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            <span>Victory NFT</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-2 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!victoryData) {
    return null;
  }

  const progress = calculateProgress();

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="w-5 h-5 text-yellow-600" />
          <span>Victory NFT</span>
          {victoryData.milestone_count > 0 && (
            <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {victoryData.milestone_count} NFTs
            </span>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Wins:</span>
            <span className="font-semibold">{victoryData.total_wins}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Next NFT at:</span>
            <span className="font-semibold">{victoryData.next_milestone} wins</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Wins to next:</span>
            <span className="font-semibold text-blue-600">{victoryData.wins_to_next}</span>
          </div>
          
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span>Progress to next NFT</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {/* Dropdown chọn chain - luôn hiển thị */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Choose Destination Chain:
          </label>
          <Select value={selectedDestinationChain} onValueChange={handleChainChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select chain" />
            </SelectTrigger>
            <SelectContent>
              {supportedChains.map((chain) => (
                <SelectItem key={chain.chain_id} value={chain.chain_id.toString()}>
                  {chain.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mint NFT Section - vẫn giữ điều kiện isEligibleForMint() */}
        {isEligibleForMint() && (
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Gift className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">Ready to Mint Victory NFT!</span>
              </div>
            </div>
            <div className="space-y-3">
              <Button
                onClick={handleMintNFT}
                disabled={minting}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
              >
                {minting ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Minting...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Zap className="w-4 h-4 mr-2" />
                    Mint Victory NFT
                  </div>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Victory NFT History */}
        {victoryData.victory_nfts.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-700">Your Victory NFTs</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {victoryData.victory_nfts.map((nft) => (
                <div key={nft.id} className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center space-x-2">
                    <Gift className="w-4 h-4 text-yellow-600" />
                    <div>
                      <div className="text-sm font-medium">
                        Victory NFT #{nft.milestone}
                      </div>
                      <div className="text-xs text-gray-500">
                        {nft.total_wins} wins • {nft.destination_chain} • {formatDate(nft.minted_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      nft.status === 'minted' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {nft.status}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        // Open transaction on appropriate explorer
                        const explorerUrl = nft.destination_chain === "Avalanche Fuji" 
                          ? `https://testnet.snowtrace.io/tx/${nft.message_id}`
                          : `https://sepolia.basescan.org/tx/${nft.message_id}`;
                        window.open(explorerUrl, '_blank');
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                    <div className="text-[10px] text-gray-400 mt-1">
                      This is the cross-chain message transaction.<br />
                      NFT minting on the destination chain may take a few minutes to appear.
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No NFTs yet */}
        {victoryData.victory_nfts.length === 0 && victoryData.total_wins > 0 && !isEligibleForMint() && (
          <div className="text-center py-4">
            <Trophy className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              Keep winning matches to earn your first Victory NFT!
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Next NFT at {victoryData.next_milestone} wins
            </p>
          </div>
        )}

        {/* No wins yet */}
        {victoryData.total_wins === 0 && (
          <div className="text-center py-4">
            <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              Start playing matches to earn Victory NFTs!
            </p>
            <p className="text-xs text-gray-400 mt-1">
              First NFT at 10 wins
            </p>
          </div>
        )}

        {/* Info */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
            <div className="text-xs text-blue-700">
              <p className="font-medium">Victory NFTs are minted cross-chain using Chainlink CCIP</p>
              <p>Choose your preferred destination chain when minting!</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 