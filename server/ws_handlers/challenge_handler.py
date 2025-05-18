from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict
import json
from datetime import datetime
from database.database import get_database
from bson import ObjectId
from utils.logger import api_logger
import random

class ChallengeManager:
    def __init__(self):
        self.pending_challenges: Dict[str, Dict] = {}  # Store pending challenges

    async def handle_challenge_request(self, websocket: WebSocket, from_id: str, to_id: str, active_connections: Dict[str, WebSocket]):
        """Handle a challenge request from one user to another"""
        api_logger.info(f"[Challenge] Request from {from_id} to {to_id}. to_id in active_connections: {to_id in active_connections}")
        print(f"[Challenge] Request from {from_id} to {to_id}. to_id in active_connections: {to_id in active_connections}")
        api_logger.info(f"[Challenge] active_connections keys: {list(active_connections.keys())}")
        print(f"[Challenge] active_connections keys: {list(active_connections.keys())}")
        api_logger.info(f"[Challenge] from_id: {from_id}, to_id: {to_id}, type(from_id): {type(from_id)}, type(to_id): {type(to_id)}")
        print(f"[Challenge] from_id: {from_id}, to_id: {to_id}, type(from_id): {type(from_id)}, type(to_id): {type(to_id)}")
        db = await get_database()
        from_user = await db.users.find_one({"_id": ObjectId(from_id)})
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

        # Store the challenge request
        challenge_id = f"{from_id}_{to_id}"
        self.pending_challenges[challenge_id] = {
            "from_id": from_id,
            "to_id": to_id,
            "timestamp": datetime.utcnow()
        }

        # Get user details for the notification
        api_logger.info(f"[Challenge] Sending challenge_invite from {from_id} ({from_user.get('name', 'Anonymous')}) to {to_id}")
        print(f"[Challenge] Sending challenge_invite from {from_id} ({from_user.get('name', 'Anonymous')}) to {to_id}")
        await active_connections[to_id].send_json({
            "type": "challenge_invite",
            "from": from_id,
            "from_name": from_user.get("name", "Anonymous")
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
            api_logger.info(f"[Challenge] No pending challenge found for {challenge_key1} or {challenge_key2}")
            return

        challenge = self.pending_challenges[challenge_key]
        if challenge["to_id"] != from_id:
            api_logger.info(f"[Challenge] Invalid response from {from_id} for challenge {challenge_key}")
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
            random.shuffle(roles)
            kicker_id = from_id if roles[0] == "kicker" else to_id
            goalkeeper_id = to_id if roles[0] == "kicker" else from_id

            # Randomly select one skill from each player's corresponding skill list
            kicker = await db.users.find_one({"_id": ObjectId(kicker_id)})
            goalkeeper = await db.users.find_one({"_id": ObjectId(goalkeeper_id)})

            kicker_skills = kicker.get("kicker_skills", [])
            goalkeeper_skills = goalkeeper.get("goalkeeper_skills", [])

            if not kicker_skills or not goalkeeper_skills:
                api_logger.info(f"[Challenge] Missing skills for players: kicker={kicker_id}, goalkeeper={goalkeeper_id}")
                return

            selected_kicker_skill = random.choice(kicker_skills)
            selected_goalkeeper_skill = random.choice(goalkeeper_skills)

            # Determine winner based on skill matching
            winner_id = None
            if selected_kicker_skill == selected_goalkeeper_skill:
                winner_id = goalkeeper_id  # Goalkeeper wins if skills match
            else:
                winner_id = kicker_id  # Kicker wins if skills don't match

            # Update match statistics and points
            winner = await db.users.find_one({"_id": ObjectId(winner_id)})
            loser_id = goalkeeper_id if winner_id == kicker_id else kicker_id
            loser = await db.users.find_one({"_id": ObjectId(loser_id)})

            # --- Cập nhật điểm tuần đúng bảng cho winner ---
            if winner.get("is_vip", False):
                week_point_field = "vip_week_point"
            elif winner.get("is_pro", False):
                week_point_field = "pro_week_point"
            else:
                week_point_field = "basic_week_point"
            await db.users.update_one({"_id": ObjectId(winner_id)}, {"$inc": {week_point_field: 1}})
            # --- END cập nhật điểm tuần ---

            # Create match history record
            match_history = {
                "match_id": str(ObjectId()),  # Generate new ObjectId for match
                "timestamp": datetime.utcnow(),
                "kicker_id": kicker_id,
                "goalkeeper_id": goalkeeper_id,
                "kicker_skill": selected_kicker_skill,
                "goalkeeper_skill": selected_goalkeeper_skill,
                "winner_id": winner_id,
                "winner_role": "kicker" if winner_id == kicker_id else "goalkeeper",
                "loser_id": loser_id,
                "loser_role": "goalkeeper" if winner_id == kicker_id else "kicker"
            }

            # Level milestone logic
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
            # Calculate total wins for winner
            total_wins = winner.get("kicked_win", 0) + winner.get("keep_win", 0) + 1
            # Determine new level
            new_level = 1
            for i, milestone in enumerate(LEVEL_MILESTONES_BASIC):
                if total_wins >= milestone:
                    new_level = i + 1
                else:
                    break
            # Pro and legend logic
            is_pro = winner.get("is_pro", False)
            legend_level = winner.get("legend_level", 0)
            if new_level >= 100:
                is_pro = True
                new_level = 100
                # Legend logic: every 100 wins after level 100 increases legend_level
                legend_level = (total_wins - LEVEL_MILESTONES_BASIC[99]) // 100 + 1 if total_wins > LEVEL_MILESTONES_BASIC[99] else 0
            # Update winner's stats and check for level up
            update_fields = {
                "$set": {"level": new_level, "is_pro": is_pro, "legend_level": legend_level},
                "$push": {"match_history": match_history}
            }
            if winner_id == kicker_id:
                update_fields["$inc"] = {"kicked_win": 1, "total_kicked": 1, "total_point": 1, "remaining_matches": -1}
            else:
                update_fields["$inc"] = {"keep_win": 1, "total_keep": 1, "total_point": 1, "remaining_matches": -1}
            await db.users.update_one({"_id": ObjectId(winner_id)}, update_fields)
            # Update loser's stats
            loser_update_fields = {"$push": {"match_history": match_history}}
            if winner_id == kicker_id:
                loser_update_fields["$inc"] = {"total_keep": 1, "remaining_matches": -1}
            else:
                loser_update_fields["$inc"] = {"total_kicked": 1, "remaining_matches": -1}
            await db.users.update_one({"_id": ObjectId(loser_id)}, loser_update_fields)
            # Get updated user data
            updated_winner = await db.users.find_one({"_id": ObjectId(winner_id)})
            updated_loser = await db.users.find_one({"_id": ObjectId(loser_id)})
            # Check if level up occurred
            level_up = new_level > winner.get("level", 1)
            new_skills = []
            if level_up and not is_pro:
                # Add new skills based on role
                if winner_id == kicker_id:
                    new_skills = [f"kicker_skill_level_{new_level}"]
                else:
                    new_skills = [f"goalkeeper_skill_level_{new_level}"]
                await db.users.update_one(
                    {"_id": ObjectId(winner_id)},
                    {"$push": {
                        "kicker_skills" if winner_id == kicker_id else "goalkeeper_skills": {
                            "$each": new_skills
                        }
                    }}
                )
            # Update reward for both winner and loser
            await db.users.update_one({"_id": ObjectId(winner_id)}, {"$set": {"reward": self.calculate_reward(updated_winner)}})
            await db.users.update_one({"_id": ObjectId(loser_id)}, {"$set": {"reward": self.calculate_reward(updated_loser)}})
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
                        "new_skills": new_skills if level_up and not is_pro else []
                    },
                    "loser": {
                        "id": str(updated_loser["_id"]),
                        "name": updated_loser.get("name", "Anonymous"),
                        "role": "goalkeeper" if winner_id == kicker_id else "kicker",
                        "total_point": updated_loser.get("total_point", 0),
                        "remaining_matches": updated_loser.get("remaining_matches", 0),
                        "is_pro": updated_loser.get("is_pro", False),
                        "legend_level": updated_loser.get("legend_level", 0),
                        "level": updated_loser.get("level", 1)
                    }
                }
            }

            # Send result to both players
            api_logger.info(f"Send challenge_result to kicker: {kicker_id}, goalkeeper: {goalkeeper_id}")
            await self.send_message(active_connections, kicker_id, result_message)
            await self.send_message(active_connections, goalkeeper_id, result_message)

            # Sau khi cập nhật điểm số, cập nhật lại trạng thái mới nhất của user và gửi lên leaderboard
            # Sau khi update winner/loser và cập nhật reward:
            updated_winner = await db.users.find_one({"_id": ObjectId(winner_id)})
            updated_loser = await db.users.find_one({"_id": ObjectId(loser_id)})
            # Khi build leaderboard_data, đảm bảo lấy đủ is_pro, is_vip
            from ws_handlers.waiting_room import manager
            # Lấy lại top_users mới nhất
            leaderboard_users = await db.users.find().sort("total_point", -1).limit(10).to_list(length=10)
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
                    "total_extra_skill": u.get("total_extra_skill", 0),
                    "extra_skill_win": u.get("extra_skill_win", 0),
                    "total_point": u.get("total_point", 0),
                    "reward": u.get("reward", 0.0),
                    "is_pro": u.get("is_pro", False),
                    "is_vip": u.get("is_vip", False),
                }
                for u in leaderboard_users
            ]
            await manager.broadcast({
                "type": "leaderboard_update",
                "leaderboard": leaderboard_data
            })

            # --- Cập nhật level/legend/vip realtime cho winner ---
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
            await db.users.update_one(
                {"_id": ObjectId(winner_id)},
                {"$set": {
                    "level": new_level,
                    "is_pro": is_pro,
                    "legend_level": legend_level,
                    "vip_level": vip_level
                }}
            )

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
        api_logger.info(f"[Challenge] Challenge {challenge_key} cleaned up")

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

# Create a singleton instance
challenge_manager = ChallengeManager() 