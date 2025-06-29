import os
import json
import asyncio
from web3 import Web3
from eth_account import Account
from typing import Optional, Dict, Any
from utils.logger import api_logger
from utils.time_utils import get_vietnam_time
from config.settings import settings

# CCIP Configuration
CCIP_CONFIG = {
    # Base Sepolia
    84532: {
        "router": "0xD0daae2231E9CB96b94C8512223533293C3693Bf",  # Updated router address
        "link_token": "0x779877A7B0D9E8603169DdbD7836e478b4624789",
        "chain_selector": 103824977864868,
        "rpc_url": os.getenv('BASE_SEPOLIA_RPC_URL', 'https://sepolia.base.org'),
        "nft_contract": settings.BASE_SEPOLIA_NFT_CONTRACT,
        "name": "Base Sepolia"
    },
    # Avalanche Fuji
    43113: {
        "router": "0x554472a2720E5E7D5D3C817529aBA05EEd5F82D8", 
        "link_token": "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846",
        "chain_selector": 14767482510784806043,
        "rpc_url": os.getenv('AVALANCHE_FUJI_RPC_URL', 'https://api.avax-test.network/ext/bc/C/rpc'),
        "nft_contract": settings.AVALANCHE_FUJI_NFT_CONTRACT,
        "name": "Avalanche Fuji"
    }
}

# CCIP Router ABI (Updated for new CCIP Router)
CCIP_ROUTER_ABI = [
    {
        "inputs": [
            {"internalType": "uint64", "name": "destinationChainSelector", "type": "uint64"},
            {"internalType": "tuple[]", "name": "receivers", "type": "tuple[]", "components": [
                {"internalType": "address", "name": "receiver", "type": "address"},
                {"internalType": "bytes", "name": "data", "type": "bytes"}
            ]},
            {"internalType": "bytes", "name": "data", "type": "bytes"},
            {"internalType": "tuple", "name": "extraArgs", "type": "tuple", "components": [
                {"internalType": "address", "name": "feeToken", "type": "address"},
                {"internalType": "uint256", "name": "feeAmount", "type": "uint256"}
            ]}
        ],
        "name": "ccipSend",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "uint64", "name": "destinationChainSelector", "type": "uint64"},
            {"internalType": "tuple[]", "name": "receivers", "type": "tuple[]", "components": [
                {"internalType": "address", "name": "receiver", "type": "address"},
                {"internalType": "bytes", "name": "data", "type": "bytes"}
            ]},
            {"internalType": "bytes", "name": "data", "type": "bytes"},
            {"internalType": "tuple", "name": "extraArgs", "type": "tuple", "components": [
                {"internalType": "address", "name": "feeToken", "type": "address"},
                {"internalType": "uint256", "name": "feeAmount", "type": "uint256"}
            ]}
        ],
        "name": "getFee",
        "outputs": [{"internalType": "uint256", "name": "fee", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

# Cross-Chain NFT Contract ABI
CROSS_CHAIN_NFT_ABI = [
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
    }
]

# CCIP Message Encoder ABI (for encoding data to send to CCIP receiver)
CCIP_MESSAGE_ENCODER_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "player", "type": "address"},
            {"internalType": "uint256", "name": "wins", "type": "uint256"},
            {"internalType": "string", "name": "metadata", "type": "string"}
        ],
        "name": "encodeMintData",
        "outputs": [{"internalType": "bytes", "name": "", "type": "bytes"}],
        "stateMutability": "pure",
        "type": "function"
    }
]

class CCIPService:
    def __init__(self):
        self.private_key = settings.CCIP_PRIVATE_KEY
        if not self.private_key:
            api_logger.warning("CCIP_PRIVATE_KEY not set - Victory NFT minting disabled")
            self.enabled = False
        else:
            self.account = Account.from_key(self.private_key)
            self.enabled = True

    async def mint_victory_nft(
        self, 
        player_address: str, 
        total_wins: int, 
        player_name: str,
        source_chain_id: int = 84532,  # Default: Base Sepolia
        destination_chain_id: int = 43113  # Default: Avalanche Fuji
    ) -> Dict[str, Any]:
        """
        Mint Victory NFT for player milestone
        SERVER pays all gas fees - player gets NFT for FREE
        """
        if not self.account:
            return {
                "success": False,
                "error": "CCIP service not configured"
            }

        try:
            if total_wins % 10 != 0 or total_wins == 0:
                return {
                    "success": False,
                    "error": f"Victory NFT can only be minted every 10 wins. Current wins: {total_wins}"
                }

            # Validate chain IDs
            if source_chain_id not in CCIP_CONFIG or destination_chain_id not in CCIP_CONFIG:
                return {
                    "success": False,
                    "error": f"Invalid chain ID. Supported: {list(CCIP_CONFIG.keys())}"
                }

            # Log chain configuration
            api_logger.info(f"CCIP Configuration:")
            api_logger.info(f"  Source Chain ID: {source_chain_id} ({CCIP_CONFIG[source_chain_id]['name']})")
            api_logger.info(f"  Destination Chain ID: {destination_chain_id} ({CCIP_CONFIG[destination_chain_id]['name']})")
            api_logger.info(f"  Source Router: {CCIP_CONFIG[source_chain_id]['router']}")
            api_logger.info(f"  Destination Contract: {CCIP_CONFIG[destination_chain_id]['nft_contract']}")
            api_logger.info(f"  Source Chain Selector: {CCIP_CONFIG[source_chain_id]['chain_selector']}")
            api_logger.info(f"  Destination Chain Selector: {CCIP_CONFIG[destination_chain_id]['chain_selector']}")

            # Initialize Web3 connections for source and destination chains
            source_config = CCIP_CONFIG[source_chain_id]
            destination_config = CCIP_CONFIG[destination_chain_id]
            
            source_w3 = Web3(Web3.HTTPProvider(source_config["rpc_url"]))
            destination_w3 = Web3(Web3.HTTPProvider(destination_config["rpc_url"]))
            
            # Check SERVER wallet balance (not player wallet)
            server_balance = source_w3.eth.get_balance(self.account.address)
            
            # Optimize gas settings for cost reduction
            current_gas_price = source_w3.eth.gas_price
            # Try to use a lower gas price if possible (within 10% of current)
            optimized_gas_price = int(current_gas_price * 0.9)  # 10% reduction
            
            # Estimate gas usage for CCIP transaction
            try:
                # Create a temporary router contract for estimation
                temp_router = source_w3.eth.contract(
                    address=Web3.to_checksum_address(source_config["router"]),
                    abi=CCIP_ROUTER_ABI
                )
                
                # Prepare temporary data for estimation
                temp_receivers = [{
                    "receiver": Web3.to_checksum_address(destination_config["nft_contract"]),
                    "data": "0x"  # Minimal data for estimation
                }]
                temp_extra_args = {
                    "feeToken": Web3.to_checksum_address(source_config["link_token"]),
                    "feeAmount": 0
                }
                
                estimated_gas = temp_router.functions.ccipSend(
                    destination_config["chain_selector"],
                    temp_receivers,
                    "0x",
                    temp_extra_args
                ).estimate_gas({
                    'from': self.account.address,
                    'value': Web3.to_wei(0.001, 'ether')  # Estimated fee
                })
                estimated_gas = int(estimated_gas * 1.2)  # Add 20% buffer
                api_logger.info(f"Estimated gas for CCIP: {estimated_gas}")
            except Exception as e:
                api_logger.warning(f"Gas estimation failed, using fallback: {e}")
                estimated_gas = 300000  # Fallback gas limit
            
            required_gas = estimated_gas * optimized_gas_price
            
            api_logger.info(f"Current gas price: {Web3.from_wei(current_gas_price, 'gwei')} gwei")
            api_logger.info(f"Optimized gas price: {Web3.from_wei(optimized_gas_price, 'gwei')} gwei")
            api_logger.info(f"Estimated gas: {estimated_gas}")
            api_logger.info(f"Required gas cost: {Web3.from_wei(required_gas, 'ether')} ETH")
            
            if server_balance < required_gas:
                return {
                    "success": False,
                    "error": f"Server wallet insufficient funds. Need {Web3.from_wei(required_gas, 'ether')} ETH, have {Web3.from_wei(server_balance, 'ether')} ETH"
                }
            
            api_logger.info(f"Server wallet balance: {Web3.from_wei(server_balance, 'ether')} ETH")
            
            # Initialize contracts
            source_router = source_w3.eth.contract(
                address=Web3.to_checksum_address(source_config["router"]),
                abi=CCIP_ROUTER_ABI
            )
            
            destination_nft_contract = destination_w3.eth.contract(
                address=Web3.to_checksum_address(destination_config["nft_contract"]),
                abi=CROSS_CHAIN_NFT_ABI
            )

            # Create metadata
            metadata = self._create_nft_metadata(player_name, total_wins, destination_config["name"])
            
            # Encode data for CCIP message (not function call)
            # The CCIP receiver will decode this data and call mintVictoryNFT
            mint_data = self._encode_ccip_message_data(source_w3, player_address, total_wins, metadata)
            
            # Get CCIP fee
            fee = await self._get_ccip_fee(source_router, destination_config["chain_selector"], 
                                         destination_config["nft_contract"], mint_data, source_config["link_token"])
            
            # Send cross-chain message (SERVER pays all fees)
            message_id = await self._send_ccip_message(
                source_w3, source_router, source_config, destination_config, mint_data, fee
            )
            
            # Log the mint
            await self._log_victory_mint(player_address, total_wins, message_id, destination_config["name"], 
                                       destination_config["nft_contract"])
            
            api_logger.info(f"Victory NFT cross-chain minted: {source_config['name']} → {destination_config['name']} for {player_name} ({player_address}) with {total_wins} wins - SERVER PAID ALL FEES")
            
            return {
                "success": True,
                "message_id": message_id,
                "player_address": player_address,
                "total_wins": total_wins,
                "milestone": total_wins // 10,
                "source_chain": source_config["name"],
                "destination_chain": destination_config["name"],
                "destination_contract": destination_config["nft_contract"],
                "server_paid_fees": True,
                "gas_cost": Web3.from_wei(required_gas, 'ether')
            }

        except Exception as e:
            api_logger.error(f"Failed to mint Victory NFT cross-chain for {player_address}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def _create_nft_metadata(self, player_name: str, total_wins: int, chain_name: str) -> str:
        """Create metadata for the Victory NFT"""
        metadata = {
            "name": f"Victory NFT #{total_wins // 10}",
            "description": f"{player_name} achieved {total_wins} victories in Kickin!",
            "image": f"https://api.kickin.com/nft/victory/{total_wins}.png",
            "attributes": [
                {"trait_type": "Total Wins", "value": total_wins},
                {"trait_type": "Milestone", "value": total_wins // 10},
                {"trait_type": "Game", "value": "Kickin"},
                {"trait_type": "Chain", "value": chain_name},
                {"trait_type": "Minted At", "value": get_vietnam_time().isoformat()}
            ]
        }
        return json.dumps(metadata)

    def _encode_ccip_message_data(self, w3, player_address: str, total_wins: int, metadata: str) -> str:
        from eth_abi import encode
        return '0x' + encode(['address', 'uint256', 'string'], [player_address, total_wins, metadata]).hex()

    async def _get_ccip_fee(self, source_router, destination_selector: int, receiver: str, data: str, fee_token: str) -> int:
        """Get CCIP fee for cross-chain message"""
        try:
            # Prepare receivers array
            receivers = [{
                "receiver": Web3.to_checksum_address(receiver),
                "data": data
            }]
            
            # Prepare extraArgs
            extra_args = {
                "feeToken": Web3.to_checksum_address(fee_token),
                "feeAmount": 0
            }
            
            # Get fee
            fee = source_router.functions.getFee(
                destination_selector,
                receivers,
                "0x",  # No additional data
                extra_args
            ).call()
            
            api_logger.info(f"CCIP fee: {Web3.from_wei(fee, 'ether')} ETH")
            return fee
            
        except Exception as e:
            api_logger.error(f"Error getting CCIP fee: {e}")
            # Fallback to estimated fee
            return Web3.to_wei(0.001, 'ether')  # 0.001 ETH as fallback

    async def _send_ccip_message(self, source_w3, source_router, source_config: dict, destination_config: dict, data: str, fee: int) -> str:
        """Send CCIP message to destination chain"""
        try:
            # Prepare receivers array
            receivers = [{
                "receiver": Web3.to_checksum_address(destination_config["nft_contract"]),
                "data": data
            }]
            
            # Prepare extraArgs
            extra_args = {
                "feeToken": Web3.to_checksum_address(source_config["link_token"]),
                "feeAmount": 0
            }
            
            # Optimize gas settings for cost reduction
            current_gas_price = source_w3.eth.gas_price
            optimized_gas_price = int(current_gas_price * 0.9)  # 10% reduction
            
            # Try to estimate actual gas usage
            try:
                estimated_gas = source_router.functions.ccipSend(
                    destination_config["chain_selector"],
                    receivers,
                    "0x",  # No additional data
                    extra_args
                ).estimate_gas({
                    'from': self.account.address,
                    'value': fee
                })
                # Add 20% buffer to estimated gas
                estimated_gas = int(estimated_gas * 1.2)
                api_logger.info(f"Actual gas estimation: {estimated_gas}")
            except Exception as e:
                api_logger.warning(f"Gas estimation failed, using fallback: {e}")
                estimated_gas = 300000  # Fallback gas limit
            
            # Use the lower of estimated gas or our hardcoded limit
            final_gas = min(estimated_gas, 300000)
            
            api_logger.info(f"Sending CCIP message with optimized gas price: {Web3.from_wei(optimized_gas_price, 'gwei')} gwei")
            api_logger.info(f"Final gas limit: {final_gas}")
            
            # Build transaction
            transaction = source_router.functions.ccipSend(
                destination_config["chain_selector"],
                receivers,
                "0x",  # No additional data
                extra_args
            ).build_transaction({
                'from': self.account.address,
                'value': fee,
                'gas': final_gas,  # Use optimized gas limit
                'gasPrice': optimized_gas_price,  # Use optimized gas price
                'nonce': source_w3.eth.get_transaction_count(self.account.address)
            })
            
            # Sign and send transaction
            signed_txn = source_w3.eth.account.sign_transaction(transaction, self.private_key)
            api_logger.info(f"DEBUG signed_txn type: {type(signed_txn)}, dir: {dir(signed_txn)}")
            tx_hash = source_w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            
            # Wait for transaction receipt
            receipt = source_w3.eth.wait_for_transaction_receipt(tx_hash)
            
            api_logger.info(f"CCIP message sent: {receipt['transactionHash'].hex()}")
            return receipt['transactionHash'].hex()
            
        except Exception as e:
            api_logger.error(f"Error sending CCIP message: {e}")
            raise e

    async def _log_victory_mint(self, player_address: str, total_wins: int, message_id: str, destination_chain: str, contract_address: str):
        """Log Victory NFT mint to database"""
        try:
            from database.database import get_database
            db = await get_database()
            
            victory_mint = {
                "player_address": player_address,
                "total_wins": total_wins,
                "milestone": total_wins // 10,
                "message_id": message_id,
                "destination_chain": destination_chain,
                "contract_address": contract_address,
                "minted_at": get_vietnam_time().isoformat(),
                "status": "minted"
            }
            
            await db.victory_nfts.insert_one(victory_mint)
            
        except Exception as e:
            api_logger.error(f"Failed to log Victory NFT mint: {str(e)}")

    def is_eligible_for_victory_nft(self, total_wins: int) -> bool:
        """Check if player is eligible for Victory NFT"""
        return total_wins > 0 and total_wins % 10 == 0

    def get_next_victory_milestone(self, current_wins: int) -> int:
        """Get the next milestone for Victory NFT"""
        return ((current_wins // 10) + 1) * 10

    def get_supported_chains(self) -> Dict[str, Any]:
        """Get list of supported chains for cross-chain minting"""
        return {
            chain_id: {
                "name": config["name"],
                "chain_id": chain_id,
                "nft_contract": config["nft_contract"]
            }
            for chain_id, config in CCIP_CONFIG.items()
        }

# Create service instance
ccip_service = CCIPService() 