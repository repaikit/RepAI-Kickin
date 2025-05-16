from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict
import json
from datetime import datetime
from database.database import get_database
from bson import ObjectId
from utils.logger import api_logger

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
        db = await get_database()
        from_user = await db.users.find_one({"_id": ObjectId(from_id)})
        
        # Send challenge request to target user
        api_logger.info(f"[Challenge] Sending challenge_invite from {from_id} ({from_user.get('name', 'Anonymous')}) to {to_id}")
        print(f"[Challenge] Sending challenge_invite from {from_id} ({from_user.get('name', 'Anonymous')}) to {to_id}")
        await active_connections[to_id].send_json({
            "type": "challenge_invite",
            "from": from_id,
            "from_name": from_user.get("name", "Anonymous")
        })

    async def handle_challenge_response(self, websocket: WebSocket, from_id: str, to_id: str, accepted: bool, active_connections: Dict[str, WebSocket]):
        """Handle a response to a challenge request"""
        challenge_id = f"{to_id}_{from_id}"  # Note: reversed because response is from the challenged user
        
        if challenge_id not in self.pending_challenges:
            await websocket.send_json({
                "type": "error",
                "message": "No pending challenge found"
            })
            return

        if accepted:
            # Create a new match
            db = await get_database()
            match = {
                "player1_id": ObjectId(to_id),
                "player2_id": ObjectId(from_id),
                "status": "pending",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            result = await db.matches.insert_one(match)
            match_id = str(result.inserted_id)

            # Notify both users
            if to_id in active_connections:
                await active_connections[to_id].send_json({
                    "type": "challenge_accepted",
                    "match_id": match_id
                })
            if from_id in active_connections:
                await active_connections[from_id].send_json({
                    "type": "challenge_accepted",
                    "match_id": match_id
                })
        else:
            # Notify the challenger that their challenge was declined
            if to_id in active_connections:
                await active_connections[to_id].send_json({
                    "type": "challenge_declined"
                })

        # Remove the pending challenge
        del self.pending_challenges[challenge_id]

    def cleanup_user_challenges(self, user_id: str):
        """Remove any pending challenges involving a user"""
        self.pending_challenges = {
            k: v for k, v in self.pending_challenges.items()
            if v['from_id'] != user_id and v['to_id'] != user_id
        }

# Create a singleton instance
challenge_manager = ChallengeManager() 