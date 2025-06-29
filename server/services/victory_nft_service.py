import json
import asyncio
from typing import Optional, Dict, Any
from web3 import Web3
from web3.exceptions import ContractLogicError, TransactionNotFound
import logging
from config.settings import settings

logger = logging.getLogger(__name__)

class VictoryNFTService:
    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(settings.AVALANCHE_FUJI_RPC_URL))
        self.contract_address = settings.AVALANCHE_FUJI_NFT_CONTRACT
        self.private_key = settings.CCIP_PRIVATE_KEY or settings.PRIVATE_KEY
        
        # Contract ABI (simplified for Victory NFT)
        self.contract_abi = [
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
                "inputs": [{"internalType": "address", "name": "player", "type": "address"}],
                "name": "getPlayerTokens",
                "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
                "name": "getMintInfo",
                "outputs": [
                    {"internalType": "address", "name": "player", "type": "address"},
                    {"internalType": "uint256", "name": "wins", "type": "uint256"},
                    {"internalType": "uint256", "name": "milestone", "type": "uint256"},
                    {"internalType": "uint256", "name": "mintedAt", "type": "uint256"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "totalSupply",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "address", "name": "player", "type": "address"},
                    {"internalType": "uint256", "name": "milestone", "type": "uint256"}
                ],
                "name": "hasMilestoneNFT",
                "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
                "stateMutability": "view",
                "type": "function"
            }
        ]
        
        self.contract = self.w3.eth.contract(
            address=self.contract_address,
            abi=self.contract_abi
        )
        
        # Get deployer account
        if self.private_key:
            self.account = self.w3.eth.account.from_key(self.private_key)
            self.deployer_address = self.account.address
            logger.info(f"VictoryNFTService using deployer/server address: {self.deployer_address}")
        else:
            self.deployer_address = None
            logger.warning("No private key provided for Victory NFT service")

    async def mint_victory_nft(self, player_address: str, wins: int, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Mint Victory NFT for a player
        """
        try:
            # Log chain info
            logger.info(f"Minting on chain: {self.w3.provider.endpoint_uri}")
            logger.info(f"Contract address: {self.contract_address}")
            chain_id = self.w3.eth.chain_id
            logger.info(f"Current chainId: {chain_id}")
            logger.info(f"Deployer address: {self.deployer_address}")

            # Validate inputs
            if not self.w3.is_address(player_address):
                raise ValueError("Invalid player address")
            
            if wins <= 0 or wins % 10 != 0:
                raise ValueError("Wins must be a positive multiple of 10")
            
            # Check if player already has NFT for this milestone
            milestone = wins // 10
            has_nft = await self.has_milestone_nft(player_address, milestone)
            if has_nft:
                return {
                    "success": False,
                    "error": f"Player already has NFT for milestone {milestone}",
                    "milestone": milestone
                }
            
            # Prepare metadata
            metadata_json = json.dumps(metadata)
            
            # Build transaction
            nonce = self.w3.eth.get_transaction_count(self.deployer_address)
            
            # Estimate gas
            gas_estimate = self.contract.functions.mintVictoryNFT(
                player_address,
                wins,
                metadata_json
            ).estimate_gas({'from': self.deployer_address})
            
            # Build transaction
            transaction = self.contract.functions.mintVictoryNFT(
                player_address,
                wins,
                metadata_json
            ).build_transaction({
                'from': self.deployer_address,
                'nonce': nonce,
                'gas': int(gas_estimate * 1.2),  # Add 20% buffer
                'gasPrice': self.w3.eth.gas_price
            })
            
            # Sign and send transaction
            logger.info(f"Signing transaction for player {player_address}, wins {wins}")
            signed_txn = self.w3.eth.account.sign_transaction(transaction, self.private_key)
            logger.info(f"Transaction signed successfully, signed_txn type: {type(signed_txn)}")
            logger.info(f"Signed transaction attributes: {dir(signed_txn)}")
            
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            logger.info(f"Transaction sent, hash: {tx_hash.hex()}")
            
            # Wait for transaction receipt
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if tx_receipt.status == 1:
                # Get the minted token ID (it's the latest token)
                total_supply = await self.get_total_supply()
                token_id = total_supply - 1  # Since we just minted
                
                return {
                    "success": True,
                    "token_id": token_id,
                    "transaction_hash": tx_hash.hex(),
                    "player_address": player_address,
                    "wins": wins,
                    "milestone": milestone,
                    "metadata": metadata
                }
            else:
                return {
                    "success": False,
                    "error": "Transaction failed",
                    "transaction_hash": tx_hash.hex()
                }
                
        except Exception as e:
            logger.error(f"Error minting Victory NFT: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def get_player_tokens(self, player_address: str) -> list:
        """
        Get all tokens owned by a player
        """
        try:
            tokens = self.contract.functions.getPlayerTokens(player_address).call()
            return [token for token in tokens]
        except Exception as e:
            logger.error(f"Error getting player tokens: {str(e)}")
            return []

    async def get_mint_info(self, token_id: int) -> Optional[Dict[str, Any]]:
        """
        Get mint info for a specific token
        """
        try:
            info = self.contract.functions.getMintInfo(token_id).call()
            return {
                "player": info[0],
                "wins": info[1],
                "milestone": info[2],
                "minted_at": info[3]
            }
        except Exception as e:
            logger.error(f"Error getting mint info: {str(e)}")
            return None

    async def get_total_supply(self) -> int:
        """
        Get total number of tokens minted
        """
        try:
            return self.contract.functions.totalSupply().call()
        except Exception as e:
            logger.error(f"Error getting total supply: {str(e)}")
            return 0

    async def has_milestone_nft(self, player_address: str, milestone: int) -> bool:
        """
        Check if player has NFT for specific milestone
        """
        try:
            return self.contract.functions.hasMilestoneNFT(player_address, milestone).call()
        except Exception as e:
            logger.error(f"Error checking milestone NFT: {str(e)}")
            return False

    async def get_player_nft_history(self, player_address: str) -> list:
        """
        Get complete NFT history for a player
        """
        try:
            tokens = await self.get_player_tokens(player_address)
            history = []
            
            for token_id in tokens:
                mint_info = await self.get_mint_info(token_id)
                if mint_info:
                    history.append({
                        "token_id": token_id,
                        **mint_info
                    })
            
            return sorted(history, key=lambda x: x["minted_at"])
        except Exception as e:
            logger.error(f"Error getting player NFT history: {str(e)}")
            return []

    async def check_milestone_eligibility(self, player_address: str, total_wins: int) -> Dict[str, Any]:
        """
        Check if player is eligible for a new Victory NFT
        """
        try:
            if total_wins < 10 or total_wins % 10 != 0:
                return {
                    "eligible": False,
                    "reason": "Wins must be a multiple of 10"
                }
            
            milestone = total_wins // 10
            has_nft = await self.has_milestone_nft(player_address, milestone)
            
            return {
                "eligible": not has_nft,
                "milestone": milestone,
                "total_wins": total_wins,
                "has_nft": has_nft
            }
        except Exception as e:
            logger.error(f"Error checking milestone eligibility: {str(e)}")
            return {
                "eligible": False,
                "error": str(e)
            }

# Create service instance
victory_nft_service = VictoryNFTService() 