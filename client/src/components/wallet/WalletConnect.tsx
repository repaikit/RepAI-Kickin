import React from 'react';
import { Button } from "@/components/ui/button";
import { useWallet } from '@/hooks/useWallet';
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function WalletConnect() {
  const {
    connect,
    connectors,
    connectError,
    isConnecting,
    activeConnector,
    address,
    isBaseNetwork,
    tokenId,
    setTokenId,
    isPending,
    mintError,
    isConfirming,
    handleMint,
    handleMintNpas,
  } = useWallet();

  return (
    <div className="space-y-6">
      {/* Wallet Connection */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Connect Wallet</h2>
        {!activeConnector ? (
          <div className="grid gap-4">
            {connectors.map((connector) => (
              <Button
                key={connector.id}
                onClick={() => connect({ connector })}
                disabled={isConnecting}
                className="w-full"
              >
                {isConnecting ? 'Connecting...' : `Connect ${connector.name}`}
              </Button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
              <span className="font-mono">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <span className={`px-2 py-1 text-sm rounded ${
                isBaseNetwork ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {isBaseNetwork ? 'Base Network' : 'Wrong Network'}
              </span>
            </div>
          </div>
        )}

        {connectError && (
          <Alert variant="destructive">
            <AlertDescription>{connectError.message}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Mint Section */}
      {activeConnector && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Mint NFT</h2>
          
          {/* Regular Mint */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Regular Mint</h3>
            <div className="flex gap-4">
              <Input
                type="number"
                placeholder="Enter Token ID"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleMint}
                disabled={isPending || !tokenId || !isBaseNetwork}
              >
                {isPending ? 'Minting...' : 'Mint NFT'}
              </Button>
            </div>
          </div>

          {/* MINTNPASS */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">MINTNPASS</h3>
            <Button
              onClick={handleMintNpas}
              disabled={isPending || !isBaseNetwork}
              className="w-full"
            >
              {isPending ? 'Minting...' : 'Mint MINTNPASS'}
            </Button>
          </div>

          {/* Status Messages */}
          {mintError && (
            <Alert variant="destructive">
              <AlertDescription>{mintError}</AlertDescription>
            </Alert>
          )}

          {isConfirming && (
            <Alert>
              <AlertDescription>Transaction is being confirmed...</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
} 