import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import WebSocket, WebSocketDisconnect, APIRouter, Depends
from typing import Dict
import json
from datetime import datetime
from database.database import get_database
from bson import ObjectId
from utils.logger import api_logger
import random
from database.database import get_skills_collection
from utils.time_utils import get_vietnam_time, to_vietnam_time, VIETNAM_TZ
from fastapi.responses import JSONResponse
from utils.level_utils import get_total_point_for_level, get_basic_level, get_legend_level, get_vip_level, update_user_levels
import asyncio
from utils.chainlink_vrf import ChainlinkVRF

# Level-related constants
LEVEL_MILESTONES_BASIC = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800, 9100, 10500, 12000, 13600, 15300, 17100, 19000, 21000, 23100, 25300, 27600, 30000, 32500, 35100, 37800, 40600, 43500, 46500, 49600, 52800, 56100, 59500, 63000, 66600, 70300, 74100, 78000, 82000, 86100, 90300, 94600, 99000, 103500, 108100, 112800, 117600, 122500, 127500, 132600, 137800, 143100, 148500, 154000, 159600, 165300, 171100, 177000, 183000, 189100, 195300, 201600, 208000, 214500, 221100, 227800, 234600, 241500, 248500, 255600, 262800, 270100, 277500, 285000, 292600, 300300, 308100, 316000, 324000, 332100, 340300, 348600, 357000, 365500, 374100, 382800, 391600, 400500, 409500, 418600, 427800, 437100, 446500, 456000, 465600, 475300, 485100, 495000]
LEGEND_STEP = 100
LEGEND_MAX = 10
VIP_LEVELS = [
    ("SILVER", 50),
    ("GOLD", 100),
    ("RUBY", 150),
    ("EMERALD", 200),
    ("DIAMOND", 500)
]

def get_basic_level(total_win):
    for i, milestone in enumerate(LEVEL_MILESTONES_BASIC):
        if total_win < milestone:
            return i
    return len(LEVEL_MILESTONES_BASIC)

def get_legend_level(total_win):
    if total_win < LEVEL_MILESTONES_BASIC[99]:
        return 0
    legend = (total_win - LEVEL_MILESTONES_BASIC[99]) // LEGEND_STEP + 1
    return min(legend, LEGEND_MAX)

def get_vip_level(vip_amount):
    level = "NONE"
    for name, amount in VIP_LEVELS:
        if vip_amount >= amount:
            level = name
    return level

def get_total_point_for_level(user):
    """Calculate total points for level up based on user type"""
    if user.get("is_vip", False):
        return user.get("total_point", 0)
    else:
        week_history_point = sum(w.get("point", 0) for w in user.get("week_history", []))
        return week_history_point + user.get("total_point", 0)

async def update_user_levels(user_id: str, db):
    """Update user's level, legend level, and VIP level based on their stats"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return None

    # Tính tổng điểm thực sự để lên level
    total_point_for_level = get_total_point_for_level(user)
    current_level = user.get("level", 1)
    new_level = get_basic_level(total_point_for_level)
    
    # Kiểm tra xem có đủ điểm lên level không
    can_level_up = new_level > current_level
    
    is_pro = new_level >= 100
    if is_pro:
        new_level = 100
        legend_level = get_legend_level(total_point_for_level)
    else:
        legend_level = 0
    vip_amount = user.get("vip_amount", 0)
    vip_level = get_vip_level(vip_amount)

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "level": new_level,
            "is_pro": is_pro,
            "legend_level": legend_level,
            "vip_level": vip_level
        }}
    )

    return {
        "level": new_level,
        "is_pro": is_pro,
        "legend_level": legend_level,
        "vip_level": vip_level,
        "total_point_for_level": total_point_for_level,
        "can_level_up": can_level_up
    }

class ChallengeManager:
    def __init__(self):
        self.pending_challenges: Dict[str, Dict] = {}  # Store pending challenges

    async def handle_challenge_request(self, websocket: WebSocket, from_id: str, to_id: str, active_connections: Dict[str, WebSocket]):
        """Handle a challenge request from one user to another"""
        print(f"[Challenge] Request from {from_id} to {to_id}. to_id in active_connections: {to_id in active_connections}")
        print(f"[Challenge] active_connections keys: {list(active_connections.keys())}")
        print(f"[Challenge] from_id: {from_id}, to_id: {to_id}, type(from_id): {type(from_id)}, type(to_id): {type(to_id)}")
        db = await get_database()
        from_user = await db.users.find_one({"_id": ObjectId(from_id)})
        
        # Check if this is a bot challenge
        if to_id == "bot":
            await self.handle_bot_challenge(websocket, from_id, active_connections)
            return
            
        to_user = await db.users.find_one({"_id": ObjectId(to_id)})
        if from_user.get("remaining_matches", 0) <= 0 or to_user.get("remaining_matches", 0) <= 0:
            await websocket.send_json({
                "type": "error",
                "message": "One of the users has no remaining matches."
            })
            return
        if to_id not in active_connections:
            await websocket.send_json({
                "type": "error",
                "message": "Target user is not online"
            })
            return

        # Check for mutual challenge
        reverse_challenge_id = f"{to_id}_{from_id}"
        if reverse_challenge_id in self.pending_challenges:
            # If there's a mutual challenge, automatically accept it
            await self.handle_challenge_response(websocket, from_id, to_id, True, active_connections)
            return

        # Store the challenge request with Vietnam timezone
        challenge_id = f"{from_id}_{to_id}"
        vietnam_time = get_vietnam_time().astimezone(VIETNAM_TZ)
        self.pending_challenges[challenge_id] = {
            "from_id": from_id,
            "to_id": to_id,
            "timestamp": vietnam_time.isoformat(),
            "timezone": "Asia/Ho_Chi_Minh"
        }

        # Get user details for the notification
        print(f"[Challenge] Sending challenge_invite from {from_id} ({from_user.get('name', 'Anonymous')}) to {to_id}")
        await active_connections[to_id].send_json({
            "type": "challenge_invite",
            "from": from_id,
            "from_name": from_user.get("name", "Anonymous"),
            "timestamp": vietnam_time.isoformat(),
            "timezone": "Asia/Ho_Chi_Minh"
        })

    async def handle_challenge_response(self, websocket: WebSocket, from_id: str, to_id: str, accepted: bool, active_connections: Dict[str, WebSocket]):
        """Handle challenge response (accept/decline)"""
        # Check both possible challenge keys
        challenge_key1 = f"{from_id}_{to_id}"
        challenge_key2 = f"{to_id}_{from_id}"
        challenge_key = None
        if challenge_key1 in self.pending_challenges:
            challenge_key = challenge_key1
        elif challenge_key2 in self.pending_challenges:
            challenge_key = challenge_key2
        else:
            return

        challenge = self.pending_challenges[challenge_key]
        if challenge["to_id"] != from_id:
            return

        db = await get_database()
        from_user = await db.users.find_one({"_id": ObjectId(from_id)})
        to_user = await db.users.find_one({"_id": ObjectId(to_id)})
        if from_user.get("remaining_matches", 0) <= 0 or to_user.get("remaining_matches", 0) <= 0:
            await websocket.send_json({
                "type": "error",
                "message": "One of the users has no remaining matches."
            })
            return

        if accepted:
            # Randomly assign roles
            roles = ["kicker", "goalkeeper"]
            # Nếu 1 trong 2 là VIP thì dùng VRF để random roles
            from_user_is_vip = from_user.get("is_vip", False)
            to_user_is_vip = to_user.get("is_vip", False)
            vrf_random_role = None
            if from_user_is_vip or to_user_is_vip:
                vrf_random_role = await chainlink_vrf.get_random_int(2)
                kicker_id = from_id if vrf_random_role == 0 else to_id
                goalkeeper_id = to_id if vrf_random_role == 0 else from_id
            else:
                random.shuffle(roles)
                kicker_id = from_id if roles[0] == "kicker" else to_id
                goalkeeper_id = to_id if roles[0] == "kicker" else from_id

            # Randomly select one skill from each player's corresponding skill list
            kicker = await db.users.find_one({"_id": ObjectId(kicker_id)})
            goalkeeper = await db.users.find_one({"_id": ObjectId(goalkeeper_id)})

            kicker_skills = kicker.get("kicker_skills", [])
            goalkeeper_skills = goalkeeper.get("goalkeeper_skills", [])

            if not kicker_skills or not goalkeeper_skills:
                return

            # Nếu là VIP thì dùng VRF để random skill
            kicker_skill_idx = None
            goalkeeper_skill_idx = None
            vrf_random_kicker_skill = None
            vrf_random_goalkeeper_skill = None
            if kicker.get("is_vip", False):
                kicker_skill_idx = await chainlink_vrf.get_random_int(len(kicker_skills))
                selected_kicker_skill = kicker_skills[kicker_skill_idx]
                vrf_random_kicker_skill = kicker_skill_idx
            else:
                selected_kicker_skill = random.choice(kicker_skills)
            if goalkeeper.get("is_vip", False):
                goalkeeper_skill_idx = await chainlink_vrf.get_random_int(len(goalkeeper_skills))
                selected_goalkeeper_skill = goalkeeper_skills[goalkeeper_skill_idx]
                vrf_random_goalkeeper_skill = goalkeeper_skill_idx
            else:
                selected_goalkeeper_skill = random.choice(goalkeeper_skills)

            # Get kicker skill details from skills collection to check counter
            skills_collection = await get_skills_collection()
            kicker_skill_details = await skills_collection.find_one({"name": selected_kicker_skill})
            
            # Determine winner based on skill counter
            winner_id = None
            if kicker_skill_details and kicker_skill_details.get("counter") == selected_goalkeeper_skill:
                # If goalkeeper's skill is a counter to kicker's skill, goalkeeper wins
                winner_id = goalkeeper_id
            else:
                # Otherwise kicker wins
                winner_id = kicker_id

            # Update match statistics and points
            winner = await db.users.find_one({"_id": ObjectId(winner_id)})
            loser_id = goalkeeper_id if winner_id == kicker_id else kicker_id
            loser = await db.users.find_one({"_id": ObjectId(loser_id)})

            # Create match history record
            match_history = {
                "match_id": str(ObjectId()),  # Generate new ObjectId for match
                "timestamp": get_vietnam_time().isoformat(),  # Format as ISO string
                "kicker_id": kicker_id,
                "goalkeeper_id": goalkeeper_id,
                "kicker_skill": selected_kicker_skill,
                "goalkeeper_skill": selected_goalkeeper_skill,
                "winner_id": winner_id,
                "winner_role": "kicker" if winner_id == kicker_id else "goalkeeper",
                "loser_id": loser_id,
                "loser_role": "goalkeeper" if winner_id == kicker_id else "kicker",
                # Lưu lại số random minh bạch nếu có
                "vrf_random_role": vrf_random_role,
                "vrf_random_kicker_skill": vrf_random_kicker_skill,
                "vrf_random_goalkeeper_skill": vrf_random_goalkeeper_skill
            }

            # Update winner's stats and check for level up
            update_fields = {
                "$push": {"match_history": match_history}
            }
            if winner_id == kicker_id:
                update_fields["$inc"] = {
                    "kicked_win": 1, 
                    "total_kicked": 1, 
                    "total_point": 1, 
                    "available_skill_points": 1  # Add 1 skill point for winning
                }
                # Only decrease remaining_matches if not VIP
                if not winner.get("is_vip", False):
                    update_fields["$inc"]["remaining_matches"] = -1
            else:
                update_fields["$inc"] = {
                    "keep_win": 1, 
                    "total_keep": 1, 
                    "total_point": 1, 
                    "available_skill_points": 1  # Add 1 skill point for winning
                }
                # Only decrease remaining_matches if not VIP
                if not winner.get("is_vip", False):
                    update_fields["$inc"]["remaining_matches"] = -1
            await db.users.update_one({"_id": ObjectId(winner_id)}, update_fields)

            # Update loser's stats
            loser_update_fields = {"$push": {"match_history": match_history}}
            if winner_id == kicker_id:
                loser_update_fields["$inc"] = {"total_keep": 1}
                # Only decrease remaining_matches if not VIP
                if not loser.get("is_vip", False):
                    loser_update_fields["$inc"]["remaining_matches"] = -1
            else:
                loser_update_fields["$inc"] = {"total_kicked": 1}
                # Only decrease remaining_matches if not VIP
                if not loser.get("is_vip", False):
                    loser_update_fields["$inc"]["remaining_matches"] = -1
            await db.users.update_one({"_id": ObjectId(loser_id)}, loser_update_fields)

            # Update levels for winner
            new_levels = await update_user_levels(winner_id, db)
            if new_levels:
                level_up = new_levels["level"] > winner.get("level", 1)
                new_skills = []
                if level_up and not new_levels["is_pro"]:
                    # Add new skills based on role
                    if winner_id == kicker_id:
                        new_skills = [f"kicker_skill_level_{new_levels['level']}"]
                    else:
                        new_skills = [f"goalkeeper_skill_level_{new_levels['level']}"]
                    await db.users.update_one(
                        {"_id": ObjectId(winner_id)},
                        {"$push": {
                            "kicker_skills" if winner_id == kicker_id else "goalkeeper_skills": {
                                "$each": new_skills
                            }
                        }}
                    )

            # Get updated user data
            updated_winner = await db.users.find_one({"_id": ObjectId(winner_id)})
            updated_loser = await db.users.find_one({"_id": ObjectId(loser_id)})

            # Prepare match result message
            result_message = {
                "type": "challenge_result",
                "kicker_id": kicker_id,
                "goalkeeper_id": goalkeeper_id,
                "kicker_skill": selected_kicker_skill,
                "goalkeeper_skill": selected_goalkeeper_skill,
                "winner_id": winner_id,
                "match_stats": {
                    "winner": {
                        "id": str(updated_winner["_id"]),
                        "name": updated_winner.get("name", "Anonymous"),
                        "role": "kicker" if winner_id == kicker_id else "goalkeeper",
                        "total_point": updated_winner.get("total_point", 0),
                        "remaining_matches": updated_winner.get("remaining_matches", 0),
                        "is_pro": updated_winner.get("is_pro", False),
                        "legend_level": updated_winner.get("legend_level", 0),
                        "level": updated_winner.get("level", 1),
                        "level_up": level_up,
                        "new_skills": new_skills if level_up and not new_levels["is_pro"] else [],
                        "can_level_up": new_levels.get("can_level_up", False),
                        "total_point_for_level": new_levels.get("total_point_for_level", 0),
                        "available_skill_points": updated_winner.get("available_skill_points", 0)  # Add available skill points
                    },
                    "loser": {
                        "id": str(updated_loser["_id"]),
                        "name": updated_loser.get("name", "Anonymous"),
                        "role": "goalkeeper" if winner_id == kicker_id else "kicker",
                        "total_point": updated_loser.get("total_point", 0),
                        "remaining_matches": updated_loser.get("remaining_matches", 0),
                        "is_pro": updated_loser.get("is_pro", False),
                        "legend_level": updated_loser.get("legend_level", 0),
                        "level": updated_loser.get("level", 1),
                        "available_skill_points": updated_loser.get("available_skill_points", 0)  # Add available skill points
                    }
                }
            }

            # Send result to both players
            await self.send_message(active_connections, kicker_id, result_message)
            await self.send_message(active_connections, goalkeeper_id, result_message)

            # Update user levels first
            total_win = updated_winner.get("kicked_win", 0) + updated_winner.get("keep_win", 0)
            new_level = get_basic_level(total_win)
            is_pro = new_level >= 100
            if is_pro:
                new_level = 100
                legend_level = get_legend_level(total_win)
            else:
                legend_level = 0
            vip_amount = updated_winner.get("vip_amount", 0)
            vip_level = get_vip_level(vip_amount)

            # Update all user data in database
            await db.users.update_one(
                {"_id": ObjectId(winner_id)},
                {"$set": {
                    "level": new_level,
                    "is_pro": is_pro,
                    "legend_level": legend_level,
                    "vip_level": vip_level
                }}
            )

            # Wait a bit longer to ensure database updates are complete
            import time as _time
            await asyncio.sleep(0.5)

            # Now fetch fresh data for leaderboard
            from ws_handlers.waiting_room import manager
            leaderboard_users = await db.users.find().sort("total_point", -1).limit(5).to_list(length=5)
            leaderboard_data = [
                {
                    "id": str(u["_id"]),
                    "name": u.get("name", "Anonymous"),
                    "avatar": u.get("avatar", ""),
                    "level": u.get("level", 1),
                    "total_kicked": u.get("total_kicked", 0),
                    "kicked_win": u.get("kicked_win", 0),
                    "total_keep": u.get("total_keep", 0),
                    "keep_win": u.get("keep_win", 0),
                    "total_point": u.get("total_point", 0),
                    "bonus_point": u.get("bonus_point", 0.0),
                    "is_pro": u.get("is_pro", False),
                    "is_vip": u.get("is_vip", False),
                    "extra_point": u.get("extra_point", 0),
                }
                for u in leaderboard_users
            ]
            await manager.broadcast({
                "type": "leaderboard_update",
                "leaderboard": leaderboard_data
            })

            await manager.broadcast_user_list()

        else:
            # Notify the challenger that the challenge was declined
            decline_message = {
                "type": "challenge_declined",
                "from_id": from_id,
                "to_id": to_id
            }
            await self.send_message(active_connections, to_id, decline_message)

        # Clean up the challenge
        del self.pending_challenges[challenge_key]

    def cleanup_user_challenges(self, user_id: str):
        """Remove any pending challenges involving a user"""
        self.pending_challenges = {
            k: v for k, v in self.pending_challenges.items()
            if v['from_id'] != user_id and v['to_id'] != user_id
        }

    async def send_message(self, active_connections: Dict[str, WebSocket], user_id: str, message: dict):
        """Send a message to a user via their WebSocket connection"""
        if user_id in active_connections:
            try:
                await active_connections[user_id].send_json(message)
            except Exception as e:
                api_logger.error(f"Error sending message to {user_id}: {str(e)}")

    def calculate_reward(self, user):
        total_point = user.get('total_point', 0)
        if user.get('is_vip'):
            return (total_point // 30) * 20
        elif user.get('is_pro'):
            return (total_point // 20) * 10
        else:
            return (total_point // 10) * 1

    async def handle_bot_challenge(self, websocket: WebSocket, from_id: str, active_connections: Dict[str, WebSocket]):
        """Handle a challenge against the bot"""
        try:
            db = await get_database()
            from_user = await db.users.find_one({"_id": ObjectId(from_id)})
            bot = await db.bots.find_one({"username": "bot"})
            
            if not bot:
                await websocket.send_json({
                    "type": "error",
                    "message": "Bot is not available at the moment."
                })
                return

            # Randomly assign roles
            roles = ["kicker", "goalkeeper"]
            random.shuffle(roles)
            is_player_kicker = roles[0] == "kicker"
            
            # Get player's skills based on role
            player_skills = from_user.get("kicker_skills" if is_player_kicker else "goalkeeper_skills", [])
            bot_skills = bot.get("kicker_skills" if not is_player_kicker else "goalkeeper_skills", [])

            if not player_skills or not bot_skills:
                await websocket.send_json({
                    "type": "error",
                    "message": "Missing required skills for the match."
                })
                return

            # Randomly select one skill from each
            player_skill = random.choice(player_skills)
            bot_skill = random.choice(bot_skills)

            # Get skill details from skills collection to check counter
            skills_collection = await get_skills_collection()
            
            # Determine winner based on skill counter
            winner_id = None
            if is_player_kicker:
                # If player is kicker, check if bot's skill counters player's skill
                player_skill_details = await skills_collection.find_one({"name": player_skill})
                if player_skill_details and player_skill_details.get("counter") == bot_skill:
                    winner_id = "bot"  # Bot wins if it has the counter skill
                else:
                    winner_id = from_id  # Player wins if bot doesn't have counter
            else:
                # If player is goalkeeper, check if player's skill counters bot's skill
                bot_skill_details = await skills_collection.find_one({"name": bot_skill})
                if bot_skill_details and bot_skill_details.get("counter") == player_skill:
                    winner_id = from_id  # Player wins if they have the counter skill
                else:
                    winner_id = "bot"  # Bot wins if player doesn't have counter
            
            # Prepare match result message (without match history)
            result_message = {
                "type": "challenge_result",
                "kicker_id": from_id if is_player_kicker else "bot",
                "goalkeeper_id": "bot" if is_player_kicker else from_id,
                "kicker_skill": player_skill if is_player_kicker else bot_skill,
                "goalkeeper_skill": bot_skill if is_player_kicker else player_skill,
                "winner_id": winner_id,
                "match_stats": {
                    "winner": {
                        "id": str(winner_id),
                        "name": from_user.get("name", "Anonymous") if winner_id == from_id else "Bot",
                        "role": "kicker" if (winner_id == from_id and is_player_kicker) or (winner_id == "bot" and not is_player_kicker) else "goalkeeper",
                    },
                    "loser": {
                        "id": "bot" if winner_id == from_id else str(from_id),
                        "name": "Bot" if winner_id == from_id else from_user.get("name", "Anonymous"),
                        "role": "goalkeeper" if (winner_id == from_id and is_player_kicker) or (winner_id == "bot" and not is_player_kicker) else "kicker",
                    }
                }
            }

            # Send result to player
            await self.send_message(active_connections, from_id, result_message)
            
        except Exception as e:
            api_logger.error(f"Error in bot challenge: {str(e)}")
            await websocket.send_json({
                "type": "error",
                "message": "An error occurred during the bot match."
            })

# Create a singleton instance
challenge_manager = ChallengeManager()

# --- API cho user bấm nút Level Up ---
router = APIRouter()

@router.post("/user/level-up")
async def level_up(user_id: str):
    db = await get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return JSONResponse(status_code=404, content={"error": "User not found"})
    # Tính tổng điểm lên level realtime
    total_point_for_level = get_total_point_for_level(user)
    from ws_handlers.challenge_handler import get_basic_level, get_legend_level, get_vip_level
    new_level = get_basic_level(total_point_for_level)
    is_pro = new_level >= 100
    if is_pro:
        new_level = 100
        legend_level = get_legend_level(total_point_for_level)
    else:
        legend_level = 0
    vip_amount = user.get("vip_amount", 0)
    vip_level = get_vip_level(vip_amount)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "level": new_level,
            "is_pro": is_pro,
            "legend_level": legend_level,
            "vip_level": vip_level
        }}
    )
    return {"level": new_level, "is_pro": is_pro, "legend_level": legend_level, "vip_level": vip_level, "total_point_for_level": total_point_for_level}

# Khởi tạo VRF instance toàn cục
chainlink_vrf = ChainlinkVRF() 