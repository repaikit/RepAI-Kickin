import { useState, useEffect } from 'react';
import { useConnect, useAccount, useChainId, useSwitchChain, useSimulateContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESS, BASE_CHAIN_ID, ABI } from '@/constants/contract';
import { toast } from 'react-hot-toast';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';

export function useWallet(user?: any, handleUpdateProfile?: (data: { wallet: string }) => void) {
  const [isPending, setIsPending] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string>('');
  const [toAddress, setToAddress] = useState<string>('');

  // Wallet connection
  const { connect, connectors, error: connectError } = useConnect({
    mutation: {
      onSuccess: (data) => {
        if (handleUpdateProfile && data?.accounts && data.accounts[0]) {
          handleUpdateProfile({ wallet: data.accounts[0] });
        }
      },
      onError: (error: Error) => {
        console.error('Connection error:', error);
      }
    }
  });

  const { isConnecting, connector: activeConnector, address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isBaseNetwork = chainId === BASE_CHAIN_ID;
  const isSafeWallet = activeConnector?.id === 'safe';

  // Get the appropriate wallet address
  const getWalletAddress = () => {
    // If user has connected their wallet, use that
    if (address) return address;
    // If user has added their own wallet, use that
    if (user?.wallet) return user.wallet;
    // Otherwise use the auto-generated wallet
    return user?.evm_address;
  };

  const walletAddress = getWalletAddress();

  // Contract simulation for regular mint
  const { data: simulateData } = useSimulateContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'mint',
    args: tokenId ? [BigInt(tokenId)] : undefined,
    query: {
      enabled: Boolean(tokenId && walletAddress)
    }
  });

  // Contract simulation for MINTNPASS
  const { data: simulateMintNpasData } = useSimulateContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'mintnpass',
    query: {
      enabled: Boolean(walletAddress)
    }
  });

  // Contract simulation for transfer
  const { data: simulateTransferData } = useSimulateContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'transferFrom',
    args: walletAddress && toAddress && tokenId ? [
      walletAddress as `0x${string}`,
      toAddress as `0x${string}`,
      BigInt(tokenId)
    ] : undefined,
    query: {
      enabled: Boolean(walletAddress && toAddress && tokenId)
    }
  });

  const { writeContract } = useWriteContract();

  // Watch transaction status
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}`,
  });

  // Handle regular mint
  const handleMint = async () => {
    if (!tokenId || !walletAddress || !simulateData) return;
    
    setIsPending(true);
    setMintError(null);
    
    try {
      await writeContract(simulateData.request);
      toast.success(`Minting NFT with ID ${tokenId}. Please check your wallet for confirmation.`);
    } catch (error: any) {
      setMintError(error.message || 'Transaction failed. Please try again later.');
    } finally {
      setIsPending(false);
    }
  };

  // Handle MINTNPASS mint
  const handleMintNpas = async () => {
    if (!walletAddress || !simulateMintNpasData) return;
    
    setIsPending(true);
    setMintError(null);
    setTxHash(null);
    
    try {
      // Check network
      if (!isBaseNetwork) {
        try {
          await switchChain({ chainId: BASE_CHAIN_ID });
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error: any) {
          setMintError('Please switch to Base network to mint NFT');
          setIsPending(false);
          return;
        }
      }

      // Special handling for Safe Wallet
      if (isSafeWallet) {

      }
      
      // Execute mint
      const hash = await writeContract(simulateMintNpasData.request);
      
      if (typeof hash === 'string') {
        setTxHash(hash);
        toast.success('Transaction submitted! Waiting for confirmation...');
      }
    } catch (error: any) {
      if (error.message.includes('chain')) {
        setMintError('Please switch to Base network to mint NFT');
      } else {
        setMintError(error.message || 'Transaction failed. Please try again later.');
      }
    } finally {
      setIsPending(false);
    }
  };

  // Handle transfer
  const handleTransfer = async (recipientAddress: string) => {
    setToAddress(recipientAddress);
    if (!walletAddress || !recipientAddress || !tokenId || !simulateTransferData) return;
    
    setIsPending(true);
    setMintError(null);
    
    try {
      // Check network
      if (!isBaseNetwork) {
        try {
          await switchChain({ chainId: BASE_CHAIN_ID });
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error: any) {
          setMintError('Please switch to Base network to transfer NFT');
          setIsPending(false);
          return;
        }
      }

      const hash = await writeContract(simulateTransferData.request);
      
      if (typeof hash === 'string') {
        setTxHash(hash);
        toast.success('Transfer initiated! Waiting for confirmation...');
      }
    } catch (error: any) {
      if (error.message.includes('chain')) {
        setMintError('Please switch to Base network to transfer NFT');
      } else {
        setMintError(error.message || 'Transfer failed. Please try again later.');
      }
    } finally {
      setIsPending(false);
    }
  };

  // Handle successful mint
  useEffect(() => {
    if (isSuccess) {
      alert('MINTNPASS NFT minted successfully!');
      setTokenId('');
      setTxHash(null);
      // Gọi API tăng số lượng NFT đã mint
      const incrementNftMinted = async () => {
        try {
          const token = localStorage.getItem('access_token');
          await fetch(API_ENDPOINTS.users.incrementNftMinted, {
            method: 'POST',
            headers: {
              ...defaultFetchOptions.headers,
              'Authorization': `Bearer ${token}`,
            },
          });
          // Nếu có hàm checkAuth thì gọi để cập nhật context user
          if (typeof window !== 'undefined' && (window as any).checkAuth) {
            (window as any).checkAuth();
          }
        } catch (err) {
          console.error('Failed to increment nft_minted:', err);
        }
      };
      incrementNftMinted();
    }
  }, [isSuccess]);

  return {
    // Wallet connection
    connect,
    connectors,
    connectError,
    isConnecting,
    activeConnector,
    address,
    isBaseNetwork,
    isSafeWallet,
    walletAddress,

    // Mint functionality
    tokenId,
    setTokenId,
    isPending,
    mintError,
    txHash,
    isConfirming,
    isSuccess,
    handleMint,
    handleMintNpas,
    handleTransfer,
    setToAddress,
  };
} 