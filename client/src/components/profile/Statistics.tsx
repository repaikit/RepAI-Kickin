import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

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
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Wallet:</span>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm">{user?.wallet ? `${user.wallet.slice(0, 6)}...${user.wallet.slice(-4)}` : 'N/A'}</span>
                {user?.wallet && user.wallet !== 'N/A' && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleCopyWallet(user.wallet, 'wallet')}
                    className="px-2 py-0 h-auto"
                  >
                    {copiedWallet === 'wallet' ? (
                      <span className="text-green-600 text-xs">Copied!</span>
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                )}
                {user?.evm_address && (
                  <div className="flex items-center space-x-1 text-sm text-gray-500">
                    <span>•</span>
                    {isLoadingNFTs ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
                    ) : (
                      <span className="font-semibold">{nftCount !== null ? `${nftCount} NFTs` : 'N/A'}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
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
            <div className="flex justify-between items-center">
              <span className="text-gray-600">NFTs in Wallet:</span>
              <div className="flex items-center space-x-2">
                {isLoadingNFTs ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                ) : (
                  <span className="font-semibold">{nftCount !== null ? nftCount : 'N/A'}</span>
                )}
                {user?.evm_address && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => fetchNFTs(user.evm_address)}
                    className="p-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 