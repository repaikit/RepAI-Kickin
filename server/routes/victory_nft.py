from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from database.database import get_database
from bson import ObjectId
from utils.logger import api_logger
from typing import List, Dict, Any
from pydantic import BaseModel
from services.victory_nft_service import victory_nft_service
from routes.users import get_current_user
from models.user import User
import logging
from utils.time_utils import get_vietnam_time
import asyncio
from services.ccip_service import ccip_service
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/victory_nft", tags=["Victory NFT"])

class MintRequest(BaseModel):
    player_address: str
    wins: int
    metadata: Dict[str, Any]

class MintResponse(BaseModel):
    success: bool
    token_id: int = None
    transaction_hash: str = None
    error: str = None
    milestone: int = None

class NFTInfo(BaseModel):
    token_id: int
    player: str
    wins: int
    milestone: int
    minted_at: int

class PlayerNFTHistory(BaseModel):
    player_address: str
    nfts: List[NFTInfo]
    total_nfts: int

class MilestoneEligibility(BaseModel):
    eligible: bool
    milestone: int = None
    total_wins: int = None
    has_nft: bool = None
    reason: str = None

class VictoryNFTMintRequest(BaseModel):
    player_address: str
    total_wins: int
    source_chain_id: int = 84532  # Default: Base Sepolia
    destination_chain_id: int = 43113  # Default: Avalanche Fuji
    test_mode: bool = False  # Enable test mode for free minting

@router.get("/history")
async def get_victory_nft_history(current_user: User = Depends(get_current_user)):
    """Get Victory NFT minting history for the authenticated user"""
    try:
        api_logger.info(f"Victory NFT history request for user: {current_user.get('name', 'Unknown')}")
        
        db = await get_database()
        
        # Get user info from token
        user_id = str(current_user["_id"])
        api_logger.info(f"User ID: {user_id}")
        
        # Get user's wallet address
        player_address = current_user.get("wallet") or current_user.get("evm_address")
        api_logger.info(f"Player address: {player_address}")
        
        if not player_address:
            api_logger.warning("No wallet address found for user")
            return {
                "user_id": user_id,
                "player_address": None,
                "player_name": current_user.get("name", "Anonymous"),
                "total_wins": (current_user.get("kicked_win", 0) + current_user.get("keep_win", 0)),
                "milestone_count": 0,
                "next_milestone": 10,
                "wins_to_next": 10,
                "victory_nfts": [],
                "message": "No wallet address found"
            }
        
        # Get Victory NFT history
        victory_nfts = await db.victory_nfts.find(
            {"player_address": player_address}
        ).sort("minted_at", -1).to_list(length=50)
        
        api_logger.info(f"Found {len(victory_nfts)} Victory NFTs for player")
        
        # Calculate current stats
        total_wins = current_user.get("kicked_win", 0) + current_user.get("keep_win", 0)
        milestone_count = total_wins // 10
        next_milestone = ((total_wins // 10) + 1) * 10
        wins_to_next = next_milestone - total_wins
        
        api_logger.info(f"Stats - Total wins: {total_wins}, Milestone: {milestone_count}, Next: {next_milestone}")
        
        result = {
            "user_id": user_id,
            "player_address": player_address,
            "player_name": current_user.get("name", "Anonymous"),
            "total_wins": total_wins,
            "milestone_count": milestone_count,
            "next_milestone": next_milestone,
            "wins_to_next": wins_to_next,
            "victory_nfts": [
                {
                    "id": str(nft["_id"]),
                    "milestone": nft["milestone"],
                    "total_wins": nft["total_wins"],
                    "message_id": nft["message_id"],
                    "destination_chain": nft["destination_chain"],
                    "contract_address": nft["contract_address"],
                    "status": nft["status"],
                    "minted_at": nft["minted_at"]
                }
                for nft in victory_nfts
            ]
        }
        
        api_logger.info("Victory NFT history request completed successfully")
        return result
        
    except Exception as e:
        api_logger.error(f"Error getting Victory NFT history for user: {str(e)}")
        api_logger.error(f"Exception type: {type(e)}")
        import traceback
        api_logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/stats")
async def get_victory_nft_stats():
    """Get global Victory NFT statistics"""
    try:
        db = await get_database()
        
        # Get total Victory NFTs minted
        total_minted = await db.victory_nfts.count_documents({})
        
        # Get unique players who have minted
        unique_players = await db.victory_nfts.distinct("player_address")
        
        # Get recent mints (last 24 hours)
        from datetime import datetime, timedelta
        from utils.time_utils import get_vietnam_time
        
        yesterday = get_vietnam_time() - timedelta(days=1)
        recent_mints = await db.victory_nfts.count_documents({
            "minted_at": {"$gte": yesterday.isoformat()}
        })
        
        # Get top milestones
        pipeline = [
            {"$group": {"_id": "$milestone", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        top_milestones = await db.victory_nfts.aggregate(pipeline).to_list(length=10)
        
        return {
            "total_minted": total_minted,
            "unique_players": len(unique_players),
            "recent_mints_24h": recent_mints,
            "top_milestones": [
                {
                    "milestone": item["_id"],
                    "count": item["count"]
                }
                for item in top_milestones
            ]
        }
        
    except Exception as e:
        api_logger.error(f"Error getting Victory NFT stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/leaderboard")
async def get_victory_nft_leaderboard():
    """Get Victory NFT leaderboard (players with most NFTs)"""
    try:
        db = await get_database()
        
        # Aggregate players by number of Victory NFTs
        pipeline = [
            {"$group": {
                "_id": "$player_address", 
                "nft_count": {"$sum": 1},
                "total_wins": {"$max": "$total_wins"},
                "last_mint": {"$max": "$minted_at"}
            }},
            {"$sort": {"nft_count": -1, "total_wins": -1}},
            {"$limit": 20}
        ]
        
        leaderboard = await db.victory_nfts.aggregate(pipeline).to_list(length=20)
        
        # Get user details for each player
        result = []
        for item in leaderboard:
            player_address = item["_id"]
            
            # Find user by wallet address
            user = await db.users.find_one({
                "$or": [
                    {"wallet": player_address},
                    {"evm_address": player_address}
                ]
            })
            
            result.append({
                "player_address": player_address,
                "player_name": user.get("name", "Anonymous") if user else "Unknown",
                "nft_count": item["nft_count"],
                "total_wins": item["total_wins"],
                "last_mint": item["last_mint"]
            })
        
        return {"leaderboard": result}
        
    except Exception as e:
        api_logger.error(f"Error getting Victory NFT leaderboard: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/mint")
async def mint_victory_nft(
    request: VictoryNFTMintRequest,
    current_user: User = Depends(get_current_user)
):
    """Mint Victory NFT for player milestone"""
    try:
        # Check if test mode is enabled
        test_mode = request.test_mode if hasattr(request, 'test_mode') else False
        
        if test_mode:
            # Use test mint mode
            from test_mint_mode import TestMintMode
            test_mint = TestMintMode()
            
            result = await test_mint.test_mint_victory_nft(
                player_address=request.player_address,
                total_wins=request.total_wins,
                player_name=current_user.username,
                source_chain="Base Sepolia",
                destination_chain="Avalanche Fuji"
            )
        else:
            # Use real CCIP minting
            result = await ccip_service.mint_victory_nft(
                player_address=request.player_address,
                total_wins=request.total_wins,
                player_name=current_user.username,
                source_chain_id=request.source_chain_id,
                destination_chain_id=request.destination_chain_id
            )
        
        if result["success"]:
            return {
                "success": True,
                "message": "Victory NFT minted successfully",
                "data": result
            }
        else:
            return {
                "success": False,
                "error": result["error"]
            }
            
    except Exception as e:
        api_logger.error(f"Failed to mint Victory NFT: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@router.get("/player/{player_address}/tokens", response_model=List[int])
async def get_player_tokens(player_address: str):
    """
    Get all token IDs owned by a player
    """
    try:
        tokens = await victory_nft_service.get_player_tokens(player_address)
        return tokens
    except Exception as e:
        logger.error(f"Error getting player tokens: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/token/{token_id}", response_model=NFTInfo)
async def get_token_info(token_id: int):
    """
    Get mint info for a specific token
    """
    try:
        info = await victory_nft_service.get_mint_info(token_id)
        if not info:
            raise HTTPException(status_code=404, detail="Token not found")
        
        return NFTInfo(
            token_id=token_id,
            player=info["player"],
            wins=info["wins"],
            milestone=info["milestone"],
            minted_at=info["minted_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting token info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/player/{player_address}/history", response_model=PlayerNFTHistory)
async def get_player_nft_history(player_address: str):
    """
    Get complete NFT history for a player
    """
    try:
        history = await victory_nft_service.get_player_nft_history(player_address)
        
        nfts = []
        for item in history:
            nfts.append(NFTInfo(
                token_id=item["token_id"],
                player=item["player"],
                wins=item["wins"],
                milestone=item["milestone"],
                minted_at=item["minted_at"]
            ))
        
        return PlayerNFTHistory(
            player_address=player_address,
            nfts=nfts,
            total_nfts=len(nfts)
        )
    except Exception as e:
        logger.error(f"Error getting player NFT history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/player/{player_address}/eligibility/{total_wins}", response_model=MilestoneEligibility)
async def check_milestone_eligibility(player_address: str, total_wins: int):
    """
    Check if player is eligible for a new Victory NFT
    """
    try:
        eligibility = await victory_nft_service.check_milestone_eligibility(player_address, total_wins)
        
        return MilestoneEligibility(
            eligible=eligibility["eligible"],
            milestone=eligibility.get("milestone"),
            total_wins=eligibility.get("total_wins"),
            has_nft=eligibility.get("has_nft"),
            reason=eligibility.get("reason")
        )
    except Exception as e:
        logger.error(f"Error checking milestone eligibility: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_victory_nft_stats():
    """
    Get Victory NFT contract statistics
    """
    try:
        total_supply = await victory_nft_service.get_total_supply()
        
        return {
            "total_supply": total_supply,
            "contract_address": victory_nft_service.contract_address,
            "network": "Avalanche Fuji Testnet"
        }
    except Exception as e:
        logger.error(f"Error getting Victory NFT stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/milestone/{milestone}/players")
async def get_players_with_milestone(milestone: int):
    """
    Get all players who have NFT for a specific milestone
    """
    try:
        # This would require additional contract function or database query
        # For now, return empty list
        return {
            "milestone": milestone,
            "players": [],
            "count": 0
        }
    except Exception as e:
        logger.error(f"Error getting players with milestone: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Background task for automatic minting
async def auto_mint_victory_nft(player_address: str, total_wins: int):
    """
    Background task to automatically mint Victory NFT when player reaches milestone
    """
    try:
        # Check eligibility
        eligibility = await victory_nft_service.check_milestone_eligibility(player_address, total_wins)
        
        if eligibility["eligible"]:
            # Create metadata
            metadata = {
                "name": f"Victory NFT #{eligibility['milestone']}",
                "description": f"Player achieved {total_wins} victories in Kickin!",
                "image": f"https://api.kickin.com/nft/victory/{total_wins}.png",
                "attributes": [
                    {"trait_type": "Total Wins", "value": total_wins},
                    {"trait_type": "Milestone", "value": eligibility["milestone"]},
                    {"trait_type": "Game", "value": "Kickin"},
                    {"trait_type": "Chain", "value": "Avalanche Fuji"}
                ]
            }
            
            # Mint NFT
            result = await victory_nft_service.mint_victory_nft(
                player_address,
                total_wins,
                metadata
            )
            
            if result["success"]:
                logger.info(f"Auto-minted Victory NFT: Token ID {result['token_id']} for player {player_address}")
            else:
                logger.error(f"Auto-mint failed: {result['error']}")
                
    except Exception as e:
        logger.error(f"Error in auto_mint_victory_nft: {str(e)}")

@router.post("/trigger-mint/{user_id}")
async def trigger_victory_nft_mint(user_id: str, current_user: User = Depends(get_current_user)):
    """Manually trigger Victory NFT minting for existing milestones (admin only)"""
    try:
        # Check if user is admin - temporarily disabled for testing
        # if current_user.get("role") != "admin":
        #     raise HTTPException(status_code=403, detail="Admin access required")
        
        db = await get_database()
        
        # Get user info
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's wallet address
        player_address = user.get("wallet") or user.get("evm_address")
        if not player_address:
            raise HTTPException(status_code=400, detail="User has no wallet address")
        
        # Calculate total wins
        total_wins = user.get("kicked_win", 0) + user.get("keep_win", 0)
        
        if total_wins < 10:
            raise HTTPException(status_code=400, detail="User needs at least 10 wins")
        
        # Check for all eligible milestones
        eligible_milestones = []
        for milestone in range(1, (total_wins // 10) + 1):
            milestone_wins = milestone * 10
            eligibility = await victory_nft_service.check_milestone_eligibility(player_address, milestone_wins)
            if eligibility["eligible"]:
                eligible_milestones.append(milestone)
        
        if not eligible_milestones:
            return {
                "success": True,
                "message": "No eligible milestones found",
                "total_wins": total_wins,
                "eligible_milestones": []
            }
        
        # Mint NFTs for all eligible milestones
        minted_nfts = []
        for milestone in eligible_milestones:
            milestone_wins = milestone * 10
            
            logger.info(f"Attempting to mint NFT for milestone {milestone} ({milestone_wins} wins) for player {player_address}")
            
            # Create metadata
            metadata = {
                "name": f"Victory NFT #{milestone}",
                "description": f"Player {user.get('name', 'Anonymous')} achieved {milestone_wins} victories in Kickin!",
                "image": f"https://api.kickin.com/nft/victory/{milestone_wins}.png",
                "attributes": [
                    {"trait_type": "Total Wins", "value": milestone_wins},
                    {"trait_type": "Milestone", "value": milestone},
                    {"trait_type": "Player Name", "value": user.get('name', 'Anonymous')},
                    {"trait_type": "Game", "value": "Kickin"},
                    {"trait_type": "Chain", "value": "Avalanche Fuji"}
                ]
            }
            
            # Mint NFT
            result = await victory_nft_service.mint_victory_nft(player_address, milestone_wins, metadata)
            
            logger.info(f"Mint result for milestone {milestone}: {result}")
            
            if result["success"]:
                minted_nfts.append({
                    "milestone": milestone,
                    "wins": milestone_wins,
                    "token_id": result["token_id"],
                    "transaction_hash": result["transaction_hash"]
                })
                
                # Log to database
                victory_mint = {
                    "player_address": player_address,
                    "total_wins": milestone_wins,
                    "milestone": milestone,
                    "message_id": result["transaction_hash"],
                    "destination_chain": "Avalanche Fuji",
                    "contract_address": victory_nft_service.contract_address,
                    "minted_at": get_vietnam_time().isoformat(),
                    "status": "minted"
                }
                await db.victory_nfts.insert_one(victory_mint)
                
                logger.info(f"Manually minted Victory NFT: Token ID {result['token_id']} for player {player_address} at milestone {milestone}")
            else:
                logger.error(f"Failed to mint Victory NFT for milestone {milestone}: {result.get('error', 'Unknown error')}")
                # Add error to response
                minted_nfts.append({
                    "milestone": milestone,
                    "wins": milestone_wins,
                    "error": result.get('error', 'Unknown error')
                })
        
        return {
            "success": True,
            "message": f"Minted {len(minted_nfts)} Victory NFTs",
            "total_wins": total_wins,
            "eligible_milestones": eligible_milestones,
            "minted_nfts": minted_nfts
        }
        
    except Exception as e:
        logger.error(f"Error in trigger_victory_nft_mint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/test-user")
async def test_current_user(current_user: User = Depends(get_current_user)):
    """Test route to check current user information"""
    return {
        "user_id": str(current_user.get("_id")),
        "name": current_user.get("name"),
        "role": current_user.get("role"),
        "is_admin": current_user.get("is_admin"),
        "user_type": current_user.get("user_type"),
        "all_fields": current_user
    }

@router.post("/test-auto-mint/{user_id}")
async def test_auto_mint(user_id: str, current_user: User = Depends(get_current_user)):
    """Test automatic Victory NFT minting by simulating a win"""
    try:
        # Check if user is admin - temporarily disabled for testing
        # if current_user.get("role") != "admin":
        #     raise HTTPException(status_code=403, detail="Admin access required")
        
        db = await get_database()
        
        # Get user info
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's wallet address
        player_address = user.get("wallet") or user.get("evm_address")
        if not player_address:
            raise HTTPException(status_code=400, detail="User has no wallet address")
        
        # Calculate current wins
        current_wins = user.get("kicked_win", 0) + user.get("keep_win", 0)
        current_milestone = current_wins // 10
        
        # Simulate reaching next milestone
        next_milestone = current_milestone + 1
        next_milestone_wins = next_milestone * 10
        
        # Check if user is eligible for next milestone
        eligibility = await victory_nft_service.check_milestone_eligibility(player_address, next_milestone_wins)
        
        if not eligibility["eligible"]:
            return {
                "success": False,
                "message": f"User not eligible for milestone {next_milestone}",
                "reason": eligibility.get("reason", "Unknown"),
                "current_wins": current_wins,
                "next_milestone": next_milestone_wins
            }
        
        # Trigger automatic minting
        from ws_handlers.challenge_handler import challenge_manager
        await challenge_manager._mint_victory_nft_async(
            player_address, 
            next_milestone_wins, 
            user.get('name', 'Anonymous'), 
            user_id
        )
        
        return {
            "success": True,
            "message": f"Triggered automatic minting for milestone {next_milestone}",
            "current_wins": current_wins,
            "next_milestone": next_milestone_wins,
            "player_address": player_address
        }
        
    except Exception as e:
        logger.error(f"Error in test_auto_mint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/test-service")
async def test_victory_nft_service():
    """Test Victory NFT service configuration"""
    try:
        # Check service configuration
        config = {
            "contract_address": victory_nft_service.contract_address,
            "rpc_url": victory_nft_service.w3.provider.endpoint_uri,
            "deployer_address": victory_nft_service.deployer_address,
            "has_private_key": bool(victory_nft_service.private_key),
            "network_id": victory_nft_service.w3.eth.chain_id,
            "latest_block": victory_nft_service.w3.eth.block_number
        }
        
        # Test contract connection
        try:
            total_supply = await victory_nft_service.get_total_supply()
            config["total_supply"] = total_supply
            config["contract_connected"] = True
        except Exception as e:
            config["contract_connected"] = False
            config["contract_error"] = str(e)
        
        return config
        
    except Exception as e:
        logger.error(f"Error testing Victory NFT service: {str(e)}")
        return {"error": str(e)}

@router.post("/add-minted-nft")
async def add_minted_nft_to_db(current_user: User = Depends(get_current_user)):
    """Add the already minted NFT (Token ID 9) to database"""
    try:
        db = await get_database()
        
        # Get user info
        user_id = str(current_user["_id"])
        player_address = current_user.get("wallet") or current_user.get("evm_address")
        player_name = current_user.get("name", "Anonymous")
        
        if not player_address:
            raise HTTPException(status_code=400, detail="User has no wallet address")
        
        # Add the already minted NFT (Token ID 9, milestone 4, 40 wins)
        victory_mint = {
            "player_address": player_address,
            "total_wins": 40,
            "milestone": 4,
            "message_id": "0x59750241d21753ce04ffc1af4057dedbb448f36a887c94270a3a72172f6e8633",
            "destination_chain": "Avalanche Fuji",
            "contract_address": victory_nft_service.contract_address,
            "minted_at": get_vietnam_time().isoformat(),
            "status": "minted"
        }
        
        # Check if already exists
        existing = await db.victory_nfts.find_one({
            "player_address": player_address,
            "milestone": 4
        })
        
        if existing:
            return {
                "success": True,
                "message": "NFT for milestone 4 already exists in database"
            }
        
        await db.victory_nfts.insert_one(victory_mint)
        
        return {
            "success": True,
            "message": "Added minted NFT (Token ID 9) to database",
            "milestone": 4,
            "total_wins": 40,
            "transaction_hash": "0x59750241d21753ce04ffc1af4057dedbb448f36a887c94270a3a72172f6e8633"
        }
        
    except Exception as e:
        logger.error(f"Error adding minted NFT to database: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/simulate-win/{user_id}")
async def simulate_win_match(user_id: str, current_user: User = Depends(get_current_user)):
    """Simulate winning a match to test automatic Victory NFT minting"""
    try:
        # Check if user is admin - temporarily disabled for testing
        # if current_user.get("role") != "admin":
        #     raise HTTPException(status_code=403, detail="Admin access required")
        
        db = await get_database()
        
        # Get user info
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get current wins
        current_kicked_win = user.get("kicked_win", 0)
        current_keep_win = user.get("keep_win", 0)
        current_total_win = current_kicked_win + current_keep_win
        current_milestone = current_total_win // 10
        
        # Simulate winning a match (add 1 win)
        new_kicked_win = current_kicked_win + 1
        new_total_win = new_kicked_win + current_keep_win
        new_milestone = new_total_win // 10
        
        # Update user wins
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"kicked_win": new_kicked_win}}
        )
        
        # Check if reached new milestone
        milestone_reached = new_milestone > current_milestone
        
        result = {
            "success": True,
            "message": f"Simulated win for user {user.get('name', 'Anonymous')}",
            "previous_wins": current_total_win,
            "new_wins": new_total_win,
            "previous_milestone": current_milestone,
            "new_milestone": new_milestone,
            "milestone_reached": milestone_reached
        }
        
        # If milestone reached, trigger automatic minting
        if milestone_reached and new_milestone > 0:
            player_address = user.get("wallet") or user.get("evm_address")
            player_name = user.get("name", "Anonymous")
            
            if player_address:
                milestone_wins = new_milestone * 10
                result["milestone_wins"] = milestone_wins
                result["message"] += f" - Reached milestone {new_milestone} ({milestone_wins} wins)"
                
                # Trigger automatic minting
                from ws_handlers.challenge_handler import challenge_manager
                asyncio.create_task(
                    challenge_manager._mint_victory_nft_async(
                        player_address, 
                        milestone_wins, 
                        player_name, 
                        user_id
                    )
                )
            else:
                result["error"] = "No wallet address found"
        
        return result
        
    except Exception as e:
        logger.error(f"Error in simulate_win_match: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test-cross-chain-mint/{user_id}")
async def test_cross_chain_mint(
    user_id: str, 
    source_chain_id: int = 84532,  # Base Sepolia
    destination_chain_id: int = 43113,  # Avalanche Fuji
    current_user: User = Depends(get_current_user)
):
    """Test cross-chain Victory NFT minting with custom chain selection"""
    try:
        # Check if current user is admin
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        db = await get_database()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's wallet address
        player_address = user.get("wallet") or user.get("evm_address")
        if not player_address:
            raise HTTPException(status_code=400, detail="User has no wallet address")
        
        # Calculate total wins
        total_wins = user.get("kicked_win", 0) + user.get("keep_win", 0)
        
        # Check if eligible for milestone
        if total_wins < 10 or total_wins % 10 != 0:
            # Simulate milestone by setting wins to next milestone
            milestone = (total_wins // 10) + 1
            total_wins = milestone * 10
        
        player_name = user.get("name", "Anonymous Player")
        
        # Mint Victory NFT cross-chain
        result = await ccip_service.mint_victory_nft(
            player_address,
            total_wins,
            player_name,
            source_chain_id,
            destination_chain_id
        )
        
        if result["success"]:
            # Update user's wins to milestone for testing
            if total_wins > (user.get("kicked_win", 0) + user.get("keep_win", 0)):
                await db.users.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$set": {"kicked_win": total_wins}}
                )
            
            return {
                "success": True,
                "message": f"Cross-chain Victory NFT minted successfully!",
                "user_id": user_id,
                "player_name": player_name,
                "total_wins": total_wins,
                "milestone": result["milestone"],
                "source_chain": result["source_chain"],
                "destination_chain": result["destination_chain"],
                "message_id": result["message_id"],
                "destination_contract": result["destination_contract"]
            }
        else:
            raise HTTPException(status_code=500, detail=f"Minting failed: {result.get('error', 'Unknown error')}")
            
    except Exception as e:
        api_logger.error(f"Error in test cross-chain mint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/supported-chains")
async def get_supported_chains():
    """Get list of supported chains for cross-chain minting"""
    try:
        chains = ccip_service.get_supported_chains()
        return {
            "success": True,
            "chains": chains,
            "message": "Supported chains for cross-chain Victory NFT minting"
        }
    except Exception as e:
        api_logger.error(f"Error getting supported chains: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/mint-cross-chain")
async def mint_cross_chain_nft(
    source_chain_id: int = 84532,  # Base Sepolia
    destination_chain_id: int = 43113,  # Avalanche Fuji
    current_user: User = Depends(get_current_user)
):
    """Mint Victory NFT cross-chain for current user"""
    try:
        # If source and destination are the same, auto-select the other chain as source
        if source_chain_id == destination_chain_id:
            if destination_chain_id == 84532:
                source_chain_id = 43113  # Avalanche Fuji
            else:
                source_chain_id = 84532  # Base Sepolia
            api_logger.info(f"Auto-selected source_chain_id: {source_chain_id} for destination_chain_id: {destination_chain_id}")
        
        db = await get_database()
        user = await db.users.find_one({"_id": ObjectId(current_user["_id"])})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's wallet address
        player_address = user.get("wallet") or user.get("evm_address")
        if not player_address:
            raise HTTPException(status_code=400, detail="User has no wallet address")
        
        # Calculate total wins
        total_wins = user.get("kicked_win", 0) + user.get("keep_win", 0)
        
        # Check if eligible for milestone
        if total_wins < 10 or total_wins % 10 != 0:
            raise HTTPException(status_code=400, detail="User not eligible for Victory NFT. Must have wins that are multiples of 10.")
        
        # Check if already minted for this milestone
        milestone = total_wins // 10
        existing_nft = await db.victory_nfts.find_one({
            "player_address": player_address,
            "milestone": milestone
        })
        
        if existing_nft:
            raise HTTPException(status_code=400, detail=f"Victory NFT for milestone {milestone} already minted")
        
        player_name = user.get("name", "Anonymous Player")
        
        # Mint Victory NFT cross-chain
        result = await ccip_service.mint_victory_nft(
            player_address,
            total_wins,
            player_name,
            source_chain_id,
            destination_chain_id
        )
        
        if result["success"]:
            return {
                "success": True,
                "message": f"Cross-chain Victory NFT minted successfully!",
                "user_id": str(user["_id"]),
                "player_name": player_name,
                "total_wins": total_wins,
                "milestone": result["milestone"],
                "source_chain": result["source_chain"],
                "destination_chain": result["destination_chain"],
                "message_id": result["message_id"],
                "destination_contract": result["destination_contract"]
            }
        else:
            raise HTTPException(status_code=500, detail=f"Minting failed: {result.get('error', 'Unknown error')}")
            
    except Exception as e:
        api_logger.error(f"Error in mint cross-chain: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/test-mint")
async def test_mint_victory_nft(
    current_user: User = Depends(get_current_user)
):
    """Test mint Victory NFT (free, no blockchain transaction)"""
    try:
        # Get user's wallet address
        player_address = current_user.get("wallet") or current_user.get("evm_address")
        if not player_address:
            return {
                "success": False,
                "error": "No wallet address found"
            }
        
        # Get total wins
        total_wins = current_user.get("kicked_win", 0) + current_user.get("keep_win", 0)
        
        # Check eligibility
        if total_wins % 10 != 0 or total_wins == 0:
            return {
                "success": False,
                "error": f"Victory NFT can only be minted every 10 wins. Current wins: {total_wins}"
            }
        
        # Use test mint mode
        from test_mint_mode import TestMintMode
        test_mint = TestMintMode()
        
        result = await test_mint.test_mint_victory_nft(
            player_address=player_address,
            total_wins=total_wins,
            player_name=current_user.get("name", "Anonymous"),
            source_chain="Base Sepolia",
            destination_chain="Avalanche Fuji"
        )
        
        if result["success"]:
            return {
                "success": True,
                "message": "Test Victory NFT minted successfully (FREE)",
                "data": result
            }
        else:
            return {
                "success": False,
                "error": result["error"]
            }
            
    except Exception as e:
        api_logger.error(f"Failed to test mint Victory NFT: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/mint-direct")
async def mint_direct_nft(
    current_user: User = Depends(get_current_user)
):
    """Mint Victory NFT directly on Base Sepolia (no cross-chain)"""
    try:
        db = await get_database()
        user = await db.users.find_one({"_id": ObjectId(current_user["_id"])})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's wallet address
        player_address = user.get("wallet") or user.get("evm_address")
        if not player_address:
            raise HTTPException(status_code=400, detail="User has no wallet address")
        
        # Calculate total wins
        total_wins = user.get("kicked_win", 0) + user.get("keep_win", 0)
        
        # Check if eligible for milestone
        if total_wins < 10 or total_wins % 10 != 0:
            raise HTTPException(status_code=400, detail="User not eligible for Victory NFT. Must have wins that are multiples of 10.")
        
        # Check if already minted for this milestone
        milestone = total_wins // 10
        existing_nft = await db.victory_nfts.find_one({
            "player_address": player_address,
            "milestone": milestone
        })
        
        if existing_nft:
            raise HTTPException(status_code=400, detail=f"Victory NFT for milestone {milestone} already minted")
        
        player_name = user.get("name", "Anonymous Player")
        
        # Create metadata
        metadata = {
            "name": f"Victory NFT #{milestone}",
            "description": f"{player_name} achieved {total_wins} victories in Kickin!",
            "image": f"https://api.kickin.com/nft/victory/{total_wins}.png",
            "attributes": [
                {"trait_type": "Total Wins", "value": total_wins},
                {"trait_type": "Milestone", "value": milestone},
                {"trait_type": "Game", "value": "Kickin"},
                {"trait_type": "Chain", "value": "Base Sepolia"},
                {"trait_type": "Minted At", "value": get_vietnam_time().isoformat()}
            ]
        }
        
        # Use VictoryNFTService for direct minting
        from services.victory_nft_service import victory_nft_service
        
        result = await victory_nft_service.mint_victory_nft(
            player_address,
            total_wins,
            metadata
        )
        
        if result["success"]:
            # Log the mint
            await db.victory_nfts.insert_one({
                "player_address": player_address,
                "total_wins": total_wins,
                "milestone": milestone,
                "transaction_hash": result["transaction_hash"],
                "destination_chain": "Base Sepolia",
                "contract_address": settings.BASE_SEPOLIA_NFT_CONTRACT,
                "minted_at": get_vietnam_time().isoformat(),
                "status": "minted"
            })
            
            return {
                "success": True,
                "message": f"Victory NFT minted successfully on Base Sepolia!",
                "user_id": str(user["_id"]),
                "player_name": player_name,
                "total_wins": total_wins,
                "milestone": milestone,
                "transaction_hash": result["transaction_hash"],
                "destination_chain": "Base Sepolia",
                "destination_contract": settings.BASE_SEPOLIA_NFT_CONTRACT
            }
        else:
            raise HTTPException(status_code=500, detail=f"Minting failed: {result.get('error', 'Unknown error')}")
            
    except Exception as e:
        api_logger.error(f"Error in direct mint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") 