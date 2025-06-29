import { Address } from 'viem';

export const CONTRACT_ADDRESS = '0xe0aBf4b49eFBA23C5888cF19E8a8033e03893CEc' as Address;
export const BASE_CHAIN_ID = 84532; // Base Sepolia
export const BASE_SEPOLIA_CHAIN_ID = 84532; // Base Sepolia Testnet
export const BASE_SEPOLIA_CONTRACT_ADDRESS = '0xe0aBf4b49eFBA23C5888cF19E8a8033e03893CEc' as Address;

// Avalanche Fuji Testnet (new)
export const AVALANCHE_FUJI_CHAIN_ID = 43113;
export const AVALANCHE_FUJI_CONTRACT_ADDRESS = '0x0200B2469eEF9713F7Ae8226D1BDee838B42676e' as Address; // Will be deployed
export const AVALANCHE_FUJI_NFT_CONTRACT = "0x0200B2469eEF9713F7Ae8226D1BDee838B42676e";
// CCIP Router Addresses
export const CCIP_ROUTER_ADDRESSES = {
  [BASE_CHAIN_ID]: '0xD0daae2231E9CB96b94C8512223533293C3693Bf' as Address, // Base Sepolia
  [AVALANCHE_FUJI_CHAIN_ID]: '0x554472a2720E5E7D5D3C817529aBA05EEd5F82D8' as Address, // Avalanche Fuji
} as const;

// CCIP Link Token Addresses
export const CCIP_LINK_ADDRESSES = {
  [BASE_CHAIN_ID]: '0x779877A7B0D9E8603169DdbD7836e478b4624789' as Address, // Base Sepolia
  [AVALANCHE_FUJI_CHAIN_ID]: '0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846' as Address, // Avalanche Fuji
} as const;

export const ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "mint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "mintnpass",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "from", "type": "address"},
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"}
    ],
    "name": "transferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// CCIP Router ABI
export const CCIP_ROUTER_ABI = [
  {
    "inputs": [
      {"internalType": "uint64", "name": "destinationChainSelector", "type": "uint64"},
      {"internalType": "address", "name": "receiver", "type": "address"},
      {"internalType": "bytes", "name": "data", "type": "bytes"},
      {"internalType": "address", "name": "token", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"},
      {"internalType": "bool", "name": "feeTokenInSrc", "type": "bool"}
    ],
    "name": "ccipSend",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint64", "name": "destinationChainSelector", "type": "uint64"},
      {"internalType": "address", "name": "receiver", "type": "address"},
      {"internalType": "bytes", "name": "data", "type": "bytes"},
      {"internalType": "address", "name": "feeToken", "type": "address"},
      {"internalType": "bool", "name": "allowNativeFunds", "type": "bool"}
    ],
    "name": "getFee",
    "outputs": [{"internalType": "uint256", "name": "fee", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Cross-Chain NFT Contract ABI (for Avalanche Fuji)
export const CROSS_CHAIN_NFT_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "player", "type": "address"},
      {"internalType": "uint256", "name": "wins", "type": "uint256"},
      {"internalType": "string", "name": "metadata", "type": "string"}
    ],
    "name": "mintVictoryNFT",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "tokenURI",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const; 