import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { fetchUserNFTs } from '@/api/nft';

interface StatisticsProps {
  user: any;
  isLoadingNFTs: boolean;
  nftCount: number | null;
  copiedWallet: string | null;
  handleCopyWallet: (address: string | undefined, type: string) => void;
  fetchNFTs: (walletAddress: string | undefined) => void;
}

export default function Statistics({
  user,
  isLoadingNFTs,
  nftCount,
  copiedWallet,
  handleCopyWallet,
  fetchNFTs
}: StatisticsProps) {
  const [localNFTCount, setLocalNFTCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // // Hàm mới để fetch NFTs
  // const handleFetchNFTs = useCallback(async (walletAddress: string | undefined) => {
  //   if (!walletAddress) return;
    
  //   try {
  //     setIsLoading(true);
  //     const response = await fetchUserNFTs(walletAddress);
  //     setLocalNFTCount(response.total_nfts);
  //     setHasLoaded(true);
  //   } catch (error) {
  //     console.error('Error fetching NFTs:', error);
  //     setLocalNFTCount(null);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // }, []);

  // Fetch NFTs chỉ một lần khi component mount
  // useEffect(() => {
  //   if (user?.evm_address && !hasLoaded) {
  //     handleFetchNFTs(user.evm_address);
  //   }
  // }, [user?.evm_address, hasLoaded, handleFetchNFTs]);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Game Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Kicked:</span>
              <span className="font-semibold">{user?.total_kicked ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Kicked Wins:</span>
              <span className="font-semibold text-green-600">{user?.kicked_win ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Keep:</span>
              <span className="font-semibold">{user?.total_keep ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Keep Wins:</span>
              <span className="font-semibold text-green-600">{user?.keep_win ?? 0}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-gray-600">Overall Win Rate:</span>
              <span className="font-bold text-blue-600">
                {Math.round(((user?.kicked_win ?? 0) + (user?.keep_win ?? 0)) / Math.max((user?.total_kicked ?? 0) + (user?.total_keep ?? 0), 1) * 100)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.created_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Member Since:</span>
                <span className="font-semibold">{format(new Date(user.created_at), 'MMM dd, yyyy')}</span>
              </div>
            )}
            {user?.last_activity && (
              <div className="flex justify-between">
                <span className="text-gray-600">Last Active:</span>
                <span className="font-semibold">{format(new Date(user.last_activity), 'MMM dd, yyyy')}</span>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
} 