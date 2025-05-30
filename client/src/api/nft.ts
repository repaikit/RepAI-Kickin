import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';

export interface NFT {
    token_address?: string;
    token_id?: string;
    contract_type?: string;
    name?: string;
    symbol?: string;
    metadata?: string;
}

export interface NFTResponse {
    address: string;
    total_nfts: number;
    nfts: NFT[];
}

export async function fetchUserNFTs(walletAddress: string, maxNFTs: number = 300) {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            throw new Error('No token found');
        }
        const response = await fetch(
            API_ENDPOINTS.nft.getNFTs(walletAddress) + `?max_nfts=${maxNFTs}`,
            {
                ...defaultFetchOptions,
                headers: {
                    ...defaultFetchOptions.headers,
                    'Authorization': `Bearer ${token}`,
                },
                method: 'GET',
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch NFTs');
        }

        const data: NFTResponse = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching NFTs:', error);
        throw error;
    }
} 