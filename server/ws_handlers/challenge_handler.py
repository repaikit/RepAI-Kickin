import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import WebSocket, WebSocketDisconnect, APIRouter, Depends
from typing import Dict
import json
from datetime import datetime
from database.database import get_users_table, get_skills_table
from utils.logger import api_logger
import random
from utils.time_utils import get_vietnam_time, to_vietnam_time, VIETNAM_TZ
from fastapi.responses import JSONResponse
from utils.level_utils import get_total_point_for_level, get_basic_level, get_legend_level, get_vip_level, update_user_levels
import asyncio

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

class ChallengeManager:
    def __init__(self):
        self.pending_challenges: Dict[str, Dict] = {}  # Store pending challenges

    async def handle_challenge_request(self, websocket: WebSocket, from_id: str, to_id: str, active_connections: Dict[str, WebSocket]):
        """Handle a challenge request from one user to another"""
        print(f"[Challenge] Request from {from_id} to {to_id}. to_id in active_connections: {to_id in active_connections}")
        print(f"[Challenge] active_connections keys: {list(active_connections.keys())}")
        print(f"[Challenge] from_id: {from_id}, to_id: {to_id}, type(from_id): {type(from_id)}, type(to_id): {type(to_id)}")
        
        users_table = await get_users_table()
        response = await users_table.select("*").eq("id", from_id).execute()
        from_user = response.data[0] if response.data else None
        
        # Check if this is a bot challenge
        if to_id == "bot":
            await self.handle_bot_challenge(websocket, from_id, active_connections)
            return
            
        response = await users_table.select("*").eq("id", to_id).execute()
        to_user = response.data[0] if response.data else None
        
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

        users_table = await get_users_table()
        response = await users_table.select("*").eq("id", from_id).execute()
        from_user = response.data[0] if response.data else None
        
        response = await users_table.select("*").eq("id", to_id).execute()
        to_user = response.data[0] if response.data else None
        
        if from_user.get("remaining_matches", 0) <= 0 or to_user.get("remaining_matches", 0) <= 0:
            await websocket.send_json({
                "type": "error",
                "message": "One of the users has no remaining matches."
            })
            return

        if accepted:
            # Randomly assign roles
            roles = ["kicker", "goalkeeper"]
            random.shuffle(roles)
            kicker_id = from_id if roles[0] == "kicker" else to_id
            goalkeeper_id = to_id if roles[0] == "kicker" else from_id

            # Randomly select one skill from each player's corresponding skill list
            response = await users_table.select("*").eq("id", kicker_id).execute()
            kicker = response.data[0] if response.data else None
            
            response = await users_table.select("*").eq("id", goalkeeper_id).execute()
            goalkeeper = response.data[0] if response.data else None

            kicker_skills = kicker.get("kicker_skills", [])
            goalkeeper_skills = goalkeeper.get("goalkeeper_skills", [])

            if not kicker_skills or not goalkeeper_skills:
                return

            selected_kicker_skill = random.choice(kicker_skills)
            selected_goalkeeper_skill = random.choice(goalkeeper_skills)

            # Get kicker skill details from skills collection to check counter
            skills_table = await get_skills_table()
            response = await skills_table.select("*").eq("name", selected_kicker_skill).execute()
            kicker_skill_details = response.data[0] if response.data else None
            
            # Determine winner based on skill counter
            winner_id = None
            if kicker_skill_details and kicker_skill_details.get("counter") == selected_goalkeeper_skill:
                # If goalkeeper's skill is a counter to kicker's skill, goalkeeper wins
                winner_id = goalkeeper_id
            else:
                # Otherwise kicker wins
                winner_id = kicker_id

            # Update match statistics and points
            response = await users_table.select("*").eq("id", winner_id).execute()
            winner = response.data[0] if response.data else None
            
            loser_id = goalkeeper_id if winner_id == kicker_id else kicker_id
            response = await users_table.select("*").eq("id", loser_id).execute()
            loser = response.data[0] if response.data else None

            # Create match history record
            match_history = {
                "match_id": str(datetime.now().timestamp()),  # Generate unique match ID
                "timestamp": get_vietnam_time().isoformat(),  # Format as ISO string
                "kicker_id": kicker_id,
                "goalkeeper_id": goalkeeper_id,
                "kicker_skill": selected_kicker_skill,
                "goalkeeper_skill": selected_goalkeeper_skill,
                "winner_id": winner_id,
                "winner_role": "kicker" if winner_id == kicker_id else "goalkeeper",
                "loser_id": loser_id,
                "loser_role": "goalkeeper" if winner_id == kicker_id else "kicker"
            }

            # Update winner's stats and check for level up
            update_data = {
                "match_history": winner.get("match_history", []) + [match_history]
            }
            
            if winner_id == kicker_id:
                update_data.update({
                    "kicked_win": winner.get("kicked_win", 0) + 1,
                    "total_kicked": winner.get("total_kicked", 0) + 1,
                    "total_point": winner.get("total_point", 0) + 1,
                    "remaining_matches": winner.get("remaining_matches", 0) - 1,
                    "available_skill_points": winner.get("available_skill_points", 0) + 1
                })
            else:
                update_data.update({
                    "keep_win": winner.get("keep_win", 0) + 1,
                    "total_keep": winner.get("total_keep", 0) + 1,
                    "total_point": winner.get("total_point", 0) + 1,
                    "remaining_matches": winner.get("remaining_matches", 0) - 1,
                    "available_skill_points": winner.get("available_skill_points", 0) + 1
                })

            # Update loser's stats
            loser_update_data = {
                "match_history": loser.get("match_history", []) + [match_history],
                "remaining_matches": loser.get("remaining_matches", 0) - 1
            }
            
            if loser_id == kicker_id:
                loser_update_data["total_kicked"] = loser.get("total_kicked", 0) + 1
            else:
                loser_update_data["total_keep"] = loser.get("total_keep", 0) + 1

            # Update users in database
            await users_table.update(update_data).eq("id", winner_id).execute()
            await users_table.update(loser_update_data).eq("id", loser_id).execute()

            # Check for level up
            winner_level_info = await update_user_levels(winner, update_data)
            loser_level_info = await update_user_levels(loser, loser_update_data)

            # Notify both users about the match result
            match_result = {
                "type": "match_result",
                "kicker_id": kicker_id,
                "goalkeeper_id": goalkeeper_id,
                "kicker_skill": selected_kicker_skill,
                "goalkeeper_skill": selected_goalkeeper_skill,
                "winner_id": winner_id,
                "winner_role": "kicker" if winner_id == kicker_id else "goalkeeper",
                "loser_id": loser_id,
                "loser_role": "goalkeeper" if winner_id == kicker_id else "kicker",
                "timestamp": get_vietnam_time().isoformat(),
                "timezone": "Asia/Ho_Chi_Minh"
            }

            # Add level up information if applicable
            if winner_level_info and winner_level_info.get("can_level_up"):
                match_result["winner_level_up"] = winner_level_info
            if loser_level_info and loser_level_info.get("can_level_up"):
                match_result["loser_level_up"] = loser_level_info

            # Send match result to both users
            if winner_id in active_connections:
                await active_connections[winner_id].send_json(match_result)
            if loser_id in active_connections:
                await active_connections[loser_id].send_json(match_result)

        # Remove the challenge from pending challenges
        if challenge_key in self.pending_challenges:
            del self.pending_challenges[challenge_key]

    def cleanup_user_challenges(self, user_id: str):
        """Remove all pending challenges involving a user"""
        challenges_to_remove = []
        for challenge_id, challenge in self.pending_challenges.items():
            if challenge["from_id"] == user_id or challenge["to_id"] == user_id:
                challenges_to_remove.append(challenge_id)
        
        for challenge_id in challenges_to_remove:
            del self.pending_challenges[challenge_id]

    async def send_message(self, active_connections: Dict[str, WebSocket], user_id: str, message: dict):
        """Send a message to a specific user"""
        if user_id in active_connections:
            await active_connections[user_id].send_json(message)

    def calculate_reward(self, user):
        """Calculate reward based on user's stats"""
        total_matches = user.get("total_kicked", 0) + user.get("total_keep", 0)
        win_rate = (user.get("kicked_win", 0) + user.get("keep_win", 0)) / total_matches if total_matches > 0 else 0
        return {
            "total_matches": total_matches,
            "win_rate": win_rate,
            "reward_multiplier": min(1.5, 1 + win_rate)
        }

    async def handle_bot_challenge(self, websocket: WebSocket, from_id: str, active_connections: Dict[str, WebSocket]):
        """Handle challenge against bot"""
        users_table = await get_users_table()
        response = await users_table.select("*").eq("id", from_id).execute()
        from_user = response.data[0] if response.data else None
        
        if from_user.get("remaining_matches", 0) <= 0:
            await websocket.send_json({
                "type": "error",
                "message": "You have no remaining matches."
            })
            return

        # Get bot's skills
        skills_table = await get_skills_table()
        response = await skills_table.select("*").eq("type", "goalkeeper").execute()
        bot_skills = [skill["name"] for skill in response.data]

        if not bot_skills:
            await websocket.send_json({
                "type": "error",
                "message": "Bot has no skills available."
            })
            return

        # Randomly select roles
        roles = ["kicker", "goalkeeper"]
        random.shuffle(roles)
        is_player_kicker = roles[0] == "kicker"

        # Get player's skills based on role
        player_skills = from_user.get("kicker_skills" if is_player_kicker else "goalkeeper_skills", [])
        if not player_skills:
            await websocket.send_json({
                "type": "error",
                "message": "You have no skills available for this role."
            })
            return

        # Select random skills
        selected_player_skill = random.choice(player_skills)
        selected_bot_skill = random.choice(bot_skills)

        # Determine winner
        if is_player_kicker:
            # Check if bot's skill counters player's skill
            response = await skills_table.select("*").eq("name", selected_player_skill).execute()
            player_skill_details = response.data[0] if response.data else None
            
            if player_skill_details and player_skill_details.get("counter") == selected_bot_skill:
                winner_id = "bot"
            else:
                winner_id = from_id
        else:
            # Check if player's skill counters bot's skill
            response = await skills_table.select("*").eq("name", selected_bot_skill).execute()
            bot_skill_details = response.data[0] if response.data else None
            
            if bot_skill_details and bot_skill_details.get("counter") == selected_player_skill:
                winner_id = from_id
            else:
                winner_id = "bot"

        # Create match history record
        match_history = {
            "match_id": str(datetime.now().timestamp()),
            "timestamp": get_vietnam_time().isoformat(),
            "kicker_id": from_id if is_player_kicker else "bot",
            "goalkeeper_id": "bot" if is_player_kicker else from_id,
            "kicker_skill": selected_player_skill if is_player_kicker else selected_bot_skill,
            "goalkeeper_skill": selected_bot_skill if is_player_kicker else selected_player_skill,
            "winner_id": winner_id,
            "winner_role": "kicker" if (winner_id == from_id and is_player_kicker) or (winner_id == "bot" and not is_player_kicker) else "goalkeeper",
            "loser_id": "bot" if winner_id == from_id else from_id,
            "loser_role": "goalkeeper" if (winner_id == from_id and is_player_kicker) or (winner_id == "bot" and not is_player_kicker) else "kicker"
        }

        # Update player's stats if they won
        if winner_id == from_id:
            update_data = {
                "match_history": from_user.get("match_history", []) + [match_history]
            }
            
            if is_player_kicker:
                update_data.update({
                    "kicked_win": from_user.get("kicked_win", 0) + 1,
                    "total_kicked": from_user.get("total_kicked", 0) + 1,
                    "total_point": from_user.get("total_point", 0) + 1,
                    "remaining_matches": from_user.get("remaining_matches", 0) - 1,
                    "available_skill_points": from_user.get("available_skill_points", 0) + 1
                })
            else:
                update_data.update({
                    "keep_win": from_user.get("keep_win", 0) + 1,
                    "total_keep": from_user.get("total_keep", 0) + 1,
                    "total_point": from_user.get("total_point", 0) + 1,
                    "remaining_matches": from_user.get("remaining_matches", 0) - 1,
                    "available_skill_points": from_user.get("available_skill_points", 0) + 1
                })

            # Update user in database
            await users_table.update(update_data).eq("id", from_id).execute()

            # Check for level up
            level_info = await update_user_levels(from_user, update_data)

            # Send match result with level up info if applicable
            match_result = {
                "type": "match_result",
                "kicker_id": from_id if is_player_kicker else "bot",
                "goalkeeper_id": "bot" if is_player_kicker else from_id,
                "kicker_skill": selected_player_skill if is_player_kicker else selected_bot_skill,
                "goalkeeper_skill": selected_bot_skill if is_player_kicker else selected_player_skill,
                "winner_id": from_id,
                "winner_role": "kicker" if is_player_kicker else "goalkeeper",
                "loser_id": "bot",
                "loser_role": "goalkeeper" if is_player_kicker else "kicker",
                "timestamp": get_vietnam_time().isoformat(),
                "timezone": "Asia/Ho_Chi_Minh"
            }

            if level_info and level_info.get("can_level_up"):
                match_result["winner_level_up"] = level_info

            await websocket.send_json(match_result)
        else:
            # Update player's stats for loss
            update_data = {
                "match_history": from_user.get("match_history", []) + [match_history],
                "remaining_matches": from_user.get("remaining_matches", 0) - 1
            }
            
            if is_player_kicker:
                update_data["total_kicked"] = from_user.get("total_kicked", 0) + 1
            else:
                update_data["total_keep"] = from_user.get("total_keep", 0) + 1

            # Update user in database
            await users_table.update(update_data).eq("id", from_id).execute()

            # Check for level up
            level_info = await update_user_levels(from_user, update_data)

            # Send match result
            match_result = {
                "type": "match_result",
                "kicker_id": from_id if is_player_kicker else "bot",
                "goalkeeper_id": "bot" if is_player_kicker else from_id,
                "kicker_skill": selected_player_skill if is_player_kicker else selected_bot_skill,
                "goalkeeper_skill": selected_bot_skill if is_player_kicker else selected_player_skill,
                "winner_id": "bot",
                "winner_role": "kicker" if not is_player_kicker else "goalkeeper",
                "loser_id": from_id,
                "loser_role": "goalkeeper" if is_player_kicker else "kicker",
                "timestamp": get_vietnam_time().isoformat(),
                "timezone": "Asia/Ho_Chi_Minh"
            }

            if level_info and level_info.get("can_level_up"):
                match_result["loser_level_up"] = level_info

            await websocket.send_json(match_result)

# Create router for level up endpoint
router = APIRouter()

@router.post("/user/level-up")
async def level_up(user_id: str):
    """Force level up for a user"""
    users_table = await get_users_table()
    response = await users_table.select("*").eq("id", user_id).execute()
    user = response.data[0] if response.data else None
    
    if not user:
        return JSONResponse(
            status_code=404,
            content={"message": "User not found"},
        )

    # Update user's level
    level_info = await update_user_levels(user)
    
    if not level_info:
        return JSONResponse(
            status_code=400,
            content={"message": "Failed to update user level"},
        )

    return JSONResponse(
        status_code=200,
        content=level_info,
    )

# Create a singleton instance
challenge_manager = ChallengeManager() 