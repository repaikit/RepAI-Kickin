import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ExternalLink, Trophy, Star, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AVALANCHE_FUJI_NFT_CONTRACT } from '@/constants/contract';
import VictoryNFTModal from './VictoryNFTModal';

interface NFTInfo {
  token_id: number;
  player: string;
  wins: number;
  milestone: number;
  minted_at: number;
}

interface PlayerNFTHistory {
  player_address: string;
  nfts: NFTInfo[];
  total_nfts: number;
}

interface MilestoneEligibility {
  eligible: boolean;
  milestone?: number;
  total_wins?: number;
  has_nft?: boolean;
  reason?: string;
}

interface VictoryNFTProps {
  userAddress?: string;
  totalWins?: number;
  className?: string;
}

const VictoryNFT: React.FC<VictoryNFTProps> = ({ 
  userAddress, 
  totalWins = 0, 
  className = "" 
}) => {
  const [nftHistory, setNftHistory] = useState<PlayerNFTHistory | null>(null);
  const [eligibility, setEligibility] = useState<MilestoneEligibility | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ total_supply: number } | null>(null);
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);

  // Calculate progress to next milestone
  const nextMilestone = Math.ceil((totalWins + 1) / 10) * 10;
  const progressToNext = totalWins > 0 ? ((totalWins % 10) / 10) * 100 : 0;
  const currentMilestone = Math.floor(totalWins / 10);

  useEffect(() => {
    if (userAddress) {
      fetchNFTHistory();
      checkEligibility();
      fetchStats();
    }
  }, [userAddress, totalWins]);

  useEffect(() => {
    if (eligibility?.eligible) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [eligibility]);

  const fetchNFTHistory = async () => {
    if (!userAddress) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/victory-nft/player/${userAddress}/history`);
      if (response.ok) {
        const data = await response.json();
        setNftHistory(data);
      }
    } catch (error) {
      console.error('Error fetching NFT history:', error);
      toast({
        title: "Error",
        description: "Failed to fetch NFT history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkEligibility = async () => {
    if (!userAddress || totalWins === 0) return;
    
    try {
      const response = await fetch(`/api/victory-nft/player/${userAddress}/eligibility/${totalWins}`);
      if (response.ok) {
        const data = await response.json();
        setEligibility(data);
      }
    } catch (error) {
      console.error('Error checking eligibility:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/victory-nft/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getMilestoneColor = (milestone: number) => {
    if (milestone <= 3) return "bg-green-500";
    if (milestone <= 10) return "bg-blue-500";
    if (milestone <= 25) return "bg-purple-500";
    if (milestone <= 50) return "bg-orange-500";
    return "bg-red-500";
  };

  const getMilestoneRarity = (milestone: number) => {
    if (milestone <= 3) return "Common";
    if (milestone <= 10) return "Uncommon";
    if (milestone <= 25) return "Rare";
    if (milestone <= 50) return "Epic";
    return "Legendary";
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Victory NFT Modal */}
      <VictoryNFTModal
        user={{ address: userAddress, totalWins }}
        isVisible={showModal}
        onClose={() => setShowModal(false)}
      />
      {/* Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Victory NFT Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Current Wins</span>
            <span className="font-bold text-lg">{totalWins}</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress to next milestone</span>
              <span>{Math.floor(progressToNext)}%</span>
            </div>
            <Progress value={progressToNext} className="h-2" />
            <div className="text-center text-sm text-muted-foreground">
              {totalWins > 0 ? (
                <span>
                  {totalWins % 10}/10 wins to milestone {Math.ceil(totalWins / 10)}
                </span>
              ) : (
                <span>10 wins needed for first milestone</span>
              )}
            </div>
          </div>

          {eligibility?.eligible && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-800">
                <Star className="h-4 w-4" />
                <span className="font-medium">Eligible for Victory NFT!</span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                You've reached {totalWins} wins and can mint your Victory NFT.
              </p>
            </div>
          )}

          {eligibility?.has_nft && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-800">
                <Zap className="h-4 w-4" />
                <span className="font-medium">Milestone {eligibility.milestone} NFT already minted!</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* NFT Collection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Your Victory NFT Collection
            {nftHistory && (
              <Badge variant="secondary" className="ml-auto">
                {nftHistory.total_nfts} NFTs
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading your NFTs...</p>
            </div>
          ) : nftHistory?.nfts && nftHistory.nfts.length > 0 ? (
            <div className="grid gap-4">
              {nftHistory.nfts.map((nft) => (
                <div
                  key={nft.token_id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full ${getMilestoneColor(nft.milestone)} flex items-center justify-center text-white font-bold`}>
                        {nft.milestone}
                      </div>
                      <div>
                        <h4 className="font-semibold">Victory NFT #{nft.milestone}</h4>
                        <p className="text-sm text-muted-foreground">
                          {nft.wins} wins • {getMilestoneRarity(nft.milestone)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Minted {new Date(nft.minted_at * 1000).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://testnet.snowtrace.io/token/${AVALANCHE_FUJI_NFT_CONTRACT}?a=${nft.token_id}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No Victory NFTs yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Win matches to earn your first Victory NFT!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contract Stats */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Contract Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total_supply}</div>
                <div className="text-sm text-muted-foreground">Total NFTs Minted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{nftHistory?.total_nfts || 0}</div>
                <div className="text-sm text-muted-foreground">Your NFTs</div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://testnet.snowtrace.io/address/${AVALANCHE_FUJI_NFT_CONTRACT}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View Contract
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VictoryNFT; 