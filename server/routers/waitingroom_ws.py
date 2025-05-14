from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from typing import List, Dict, Optional
from utils.logger import ws_logger
from database.database import get_users_collection
from datetime import datetime
import json
from bson import ObjectId

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}  # ObjectId -> WebSocket
        self.user_info: Dict[str, dict] = {}  # ObjectId -> user_info
        self.ready_users: Dict[str, bool] = {}  # ObjectId -> ready_status

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.ready_users[user_id] = False
        
        # Get user info from database
        users_collection = await get_users_collection()
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        if user:
            self.user_info[user_id] = {
                "user_id": str(user["_id"]),
                "name": user.get("name", "Guest Player"),
                "user_type": user.get("user_type", "guest"),
                "kicker_skills": user.get("kicker_skills", []),
                "goalkeeper_skills": user.get("goalkeeper_skills", []),
                "remaining_matches": user.get("remaining_matches", 5),
                "is_ready": False,
                "avatar": user.get("avatar")
            }
            ws_logger.info(f"User {self.user_info[user_id]['name']} ({user_id}) connected to waiting room.")
        else:
            ws_logger.error(f"User not found for id: {user_id}")
            await websocket.close()

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            user_name = self.user_info.get(user_id, {}).get("name", user_id)
            ws_logger.info(f"User {user_name} disconnected from waiting room.")
            del self.active_connections[user_id]
            del self.user_info[user_id]
            del self.ready_users[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        websocket = self.active_connections.get(user_id)
        if websocket:
            await websocket.send_json(message)

    async def broadcast(self, message: dict):
        for ws in self.active_connections.values():
            await ws.send_json(message)

    def get_user_list(self):
        return list(self.user_info.values())

    def update_user_ready_status(self, user_id: str, is_ready: bool):
        if user_id in self.user_info:
            self.user_info[user_id]["is_ready"] = is_ready
            self.ready_users[user_id] = is_ready

    def get_ready_users(self):
        return [uid for uid, ready in self.ready_users.items() if ready]

manager = ConnectionManager()

@router.websocket("/ws/waitingroom/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        # Send current user list to all
        await manager.broadcast({
            "type": "user_list",
            "users": manager.get_user_list()
        })

        while True:
            data = await websocket.receive_json()
            
            # Handle different message types
            if data.get("type") == "ready":
                # Update user ready status
                is_ready = data.get("is_ready", False)
                manager.update_user_ready_status(user_id, is_ready)
                
                # Broadcast updated user list
                await manager.broadcast({
                    "type": "user_list",
                    "users": manager.get_user_list()
                })

            elif data.get("type") == "challenge":
                # Send challenge to selected user
                target_id = data.get("target_user_id")
                if target_id in manager.active_connections:
                    await manager.send_personal_message({
                        "type": "challenge",
                        "from": user_id,
                        "from_user": manager.user_info[user_id],
                        "match_type": data.get("match_type", "friendly"),  # friendly or ranked
                        "position": data.get("position", "both")  # kicker, goalkeeper, or both
                    }, target_id)

            elif data.get("type") == "challenge_response":
                # Handle challenge response
                target_id = data.get("target_user_id")
                accepted = data.get("accepted", False)
                
                if accepted and target_id in manager.active_connections:
                    # Both users are ready for match
                    match_data = {
                        "type": "match_ready",
                        "players": [
                            manager.user_info[user_id],
                            manager.user_info[target_id]
                        ],
                        "match_type": data.get("match_type", "friendly"),
                        "position": data.get("position", "both")
                    }
                    
                    # Send match ready message to both users
                    await manager.send_personal_message(match_data, user_id)
                    await manager.send_personal_message(match_data, target_id)
                    
                    # Update remaining matches for both users
                    users_collection = await get_users_collection()
                    await users_collection.update_one(
                        {"_id": ObjectId(user_id)},
                        {"$inc": {"remaining_matches": -1}}
                    )
                    await users_collection.update_one(
                        {"_id": ObjectId(target_id)},
                        {"$inc": {"remaining_matches": -1}}
                    )
                else:
                    # Send rejection message
                    await manager.send_personal_message({
                        "type": "challenge_rejected",
                        "from": user_id,
                        "from_user": manager.user_info[user_id]
                    }, target_id)

            elif data.get("type") == "status":
                # Broadcast user status update
                await manager.broadcast({
                    "type": "status",
                    "user_id": user_id,
                    "user": manager.user_info[user_id],
                    "status": data.get("status")
                })

    except WebSocketDisconnect:
        manager.disconnect(user_id)
        # Broadcast updated user list
        await manager.broadcast({
            "type": "user_list",
            "users": manager.get_user_list()
        })
    except Exception as e:
        ws_logger.error(f"WebSocket error: {str(e)}")
        manager.disconnect(user_id)
        await manager.broadcast({
            "type": "user_list",
            "users": manager.get_user_list()
        }) 