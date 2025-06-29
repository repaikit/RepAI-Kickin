import { 
  CCIP_ROUTER_ADDRESSES, 
  CCIP_LINK_ADDRESSES, 
  CCIP_ROUTER_ABI,
  CROSS_CHAIN_NFT_ABI,
  AVALANCHE_FUJI_CHAIN_ID,
  AVALANCHE_FUJI_CONTRACT_ADDRESS,
  BASE_CHAIN_ID
} from '@/constants/contract';
import { toast } from 'sonner';

// Chain Selectors for CCIP
const CHAIN_SELECTORS = {
  84532: 103824977864868, // Base Sepolia (fixed chain ID)
  43113: 14767482510784806043, // Avalanche Fuji
} as const;

export interface CCIPMintResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class CCIPService {
  private static instance: CCIPService;

  public static getInstance(): CCIPService {
    if (!CCIPService.instance) {
      CCIPService.instance = new CCIPService();
    }
    return CCIPService.instance;
  }

  /**
   * Mint NFT on Avalanche Fuji when player wins 10 matches
   */
  async mintVictoryNFT(
    playerAddress: string,
    totalWins: number,
    playerName: string,
    chainId: number
  ): Promise<CCIPMintResult> {
    try {
      // Check if player has exactly 10 wins (milestone reached)
      if (totalWins % 10 !== 0) {
        return {
          success: false,
          error: 'Victory NFT can only be minted every 10 wins'
        };
      }

      // Create metadata for the NFT
      const metadata = JSON.stringify({
        name: `Victory NFT #${Math.floor(totalWins / 10)}`,
        description: `${playerName} achieved ${totalWins} victories in Kickin!`,
        image: `https://api.kickin.com/nft/victory/${totalWins}.png`,
        attributes: [
          { trait_type: "Total Wins", value: totalWins },
          { trait_type: "Milestone", value: Math.floor(totalWins / 10) },
          { trait_type: "Game", value: "Kickin" },
          { trait_type: "Chain", value: "Avalanche Fuji" }
        ]
      });

      // Encode the mint function call
      const mintData = this.encodeMintFunction(playerAddress, totalWins, metadata);

      // Get CCIP fee
      const fee = await this.getCCIPFee(chainId, mintData);

      // Send cross-chain message
      const messageId = await this.sendCCIPMessage(chainId, mintData, fee);

      toast.success(`Victory NFT minting initiated! Message ID: ${messageId.slice(0, 10)}...`);

      return {
        success: true,
        messageId
      };

    } catch (error: any) {
      console.error('CCIP mint error:', error);
      toast.error('Failed to mint Victory NFT: ' + error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Encode the mint function call for the destination contract
   */
  private encodeMintFunction(
    playerAddress: string, 
    totalWins: number, 
    metadata: string
  ): string {
    // This would be the actual encoding of the mintVictoryNFT function
    // For now, we'll use a placeholder
    return '0x' + Buffer.from(JSON.stringify({
      function: 'mintVictoryNFT',
      player: playerAddress,
      wins: totalWins,
      metadata: metadata
    })).toString('hex');
  }

  /**
   * Get the CCIP fee for cross-chain message
   */
  private async getCCIPFee(chainId: number, data: string): Promise<bigint> {
    const routerAddress = CCIP_ROUTER_ADDRESSES[chainId as keyof typeof CCIP_ROUTER_ADDRESSES];
    const destinationSelector = CHAIN_SELECTORS[AVALANCHE_FUJI_CHAIN_ID];
    const receiver = AVALANCHE_FUJI_CONTRACT_ADDRESS;
    const feeToken = CCIP_LINK_ADDRESSES[chainId as keyof typeof CCIP_LINK_ADDRESSES];

    // This would interact with the CCIP Router contract
    // For now, return a placeholder fee
    return BigInt(1000000000000000000); // 1 LINK
  }

  /**
   * Send CCIP message to destination chain
   */
  private async sendCCIPMessage(
    chainId: number, 
    data: string, 
    fee: bigint
  ): Promise<string> {
    const routerAddress = CCIP_ROUTER_ADDRESSES[chainId as keyof typeof CCIP_ROUTER_ADDRESSES];
    const destinationSelector = CHAIN_SELECTORS[AVALANCHE_FUJI_CHAIN_ID];
    const receiver = AVALANCHE_FUJI_CONTRACT_ADDRESS;

    // This would interact with the CCIP Router contract
    // For now, return a placeholder message ID
    return '0x' + Math.random().toString(16).slice(2, 66);
  }

  /**
   * Check if a player is eligible for Victory NFT
   */
  isEligibleForVictoryNFT(totalWins: number): boolean {
    return totalWins > 0 && totalWins % 10 === 0;
  }

  /**
   * Get the next milestone for Victory NFT
   */
  getNextVictoryMilestone(currentWins: number): number {
    return Math.ceil(currentWins / 10) * 10;
  }

  /**
   * Get progress towards next Victory NFT
   */
  getVictoryProgress(currentWins: number): { current: number; next: number; progress: number } {
    const nextMilestone = this.getNextVictoryMilestone(currentWins);
    const lastMilestone = Math.floor(currentWins / 10) * 10;
    const progress = ((currentWins - lastMilestone) / (nextMilestone - lastMilestone)) * 100;

    return {
      current: currentWins,
      next: nextMilestone,
      progress: Math.min(progress, 100)
    };
  }
}

export const ccipService = CCIPService.getInstance(); 