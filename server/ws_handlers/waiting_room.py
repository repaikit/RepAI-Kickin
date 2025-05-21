from fastapi import WebSocket, WebSocketDisconnect, HTTPException
from typing import Dict, List, Optional
import json
from datetime import datetime, timedelta
import asyncio
from database.database import get_database, get_chat_messages_collection
from utils.logger import api_logger
import httpx
from config.settings import settings
from bson import ObjectId
from jose import jwt, JWTError
import os
from .challenge_handler import challenge_manager
from utils.time_utils import get_vietnam_time, to_vietnam_time, VIETNAM_TZ
import pytz
import time

SECRET_KEY = os.getenv("JWT_KEY", "your-very-secret-key")
ALGORITHM = "HS256"

class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return to_vietnam_time(obj).isoformat()
        return super().default(obj)

class WaitingRoomManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.online_users: Dict[str, dict] = {}
        self.ping_interval = 30
        self._ping_task = None
        self._cleanup_interval = 60
        self._cleanup_task = None
        self._broadcast_lock = asyncio.Lock()
        self._user_list_lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: str, user_data: dict):
        """Handle new WebSocket connection with optimized error handling"""
        try:
            print(f"[WaitingRoom] New connection attempt from user {user_id}")
            await websocket.accept()
            print(f"[WaitingRoom] Connection accepted for user {user_id}")
            
            self.active_connections[user_id] = websocket
            
            # Store user data with minimal required fields
            self.online_users[user_id] = {
                "id": str(user_data["_id"]),
                "name": user_data.get("name") or "Guest Player",
                "user_type": user_data.get("user_type") or "guest",
                "avatar": user_data.get("avatar") or "",
                "position": user_data.get("position") or "both",
                "role": user_data.get("role") or "user",
                "is_active": user_data.get("is_active", True),
                "is_verified": user_data.get("is_verified", False),
                "trend": user_data.get("trend") or "neutral",
                "total_point": user_data.get("total_point", 0),
                "remaining_matches": user_data.get("remaining_matches", 5),
                "level": user_data.get("level", 1),
                "kicker_skills": user_data.get("kicker_skills", []),
                "goalkeeper_skills": user_data.get("goalkeeper_skills", []),
                "total_kicked": user_data.get("total_kicked", 0),
                "kicked_win": user_data.get("kicked_win", 0),
                "total_keep": user_data.get("total_keep", 0),
                "keep_win": user_data.get("keep_win", 0),
                "is_pro": user_data.get("is_pro", False),
                "connected_at": get_vietnam_time().isoformat()
            }
            print(f"[WaitingRoom] User data stored for {user_id}: {self.online_users[user_id]}")

            # Start ping task if not running
            if not self._ping_task:
                self._ping_task = asyncio.create_task(self.start_ping_loop())
                print("[WaitingRoom] Ping task started")
            
            # Start cleanup task if not running
            if not self._cleanup_task:
                self._cleanup_task = asyncio.create_task(self._cleanup_loop())
                print("[WaitingRoom] Cleanup task started")

            # Send immediate user list to the new connection
            users = self.get_online_users()
            print(f"[WaitingRoom] Sending initial user list to {user_id}, count: {len(users)}")
            await websocket.send_json({
                "type": "user_list",
                "users": users
            })

            # Send initial leaderboard data
            db = await get_database()
            leaderboard_users = await db.users.find().sort("total_point", -1).limit(50).to_list(length=50)
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
                for u in leaderboard_users if u.get("user_type") != "guest"
            ][:10]
            print(f"[WaitingRoom] Sending initial leaderboard data to {user_id}, count: {len(leaderboard_data)}")
            await websocket.send_json({
                "type": "leaderboard_update",
                "leaderboard": leaderboard_data
            })

            # Broadcast updated user list to all clients
            await self.broadcast_user_list()
            print(f"[WaitingRoom] User list broadcasted after {user_id} joined")

        except Exception as e:
            print(f"[WaitingRoom] Error in websocket connection for {user_id}: {str(e)}")
            api_logger.error(f"Error in websocket connection: {str(e)}")
            try:
                await websocket.close(code=4000, reason="Internal server error")
            except:
                pass

    async def disconnect(self, user_id: str):
        """Handle user disconnection with cleanup"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].close()
            except:
                pass
            del self.active_connections[user_id]
        
        if user_id in self.online_users:
            del self.online_users[user_id]
        
        challenge_manager.cleanup_user_challenges(user_id)
        await self.broadcast_user_list()

    async def send_personal_message(self, message: dict, user_id: str):
        """Send message to specific user with error handling"""
        if user_id in self.active_connections:
            try:
                data = json.dumps(message, cls=JSONEncoder)
                await self.active_connections[user_id].send_text(data)
            except Exception as e:
                api_logger.error(f"Error sending message to {user_id}: {str(e)}")
                await self.disconnect(user_id)

    async def broadcast(self, message: dict, exclude_user_id: Optional[str] = None):
        """Broadcast message to all users with optimized locking"""
        async with self._broadcast_lock:
            data = json.dumps(message, cls=JSONEncoder)
            disconnected_users = []
            
            for user_id, connection in list(self.active_connections.items()):
                if user_id != exclude_user_id:
                    try:
                        await connection.send_text(data)
                    except Exception as e:
                        api_logger.error(f"Error broadcasting to {user_id}: {str(e)}")
                        disconnected_users.append(user_id)
            
            # Handle disconnected users
            for user_id in disconnected_users:
                await self.disconnect(user_id)

    def get_online_users(self):
        """Get filtered online users with remaining matches"""
        return [u for u in self.online_users.values() if u.get("remaining_matches", 0) > 0]

    async def broadcast_user_list(self):
        """Broadcast user list with optimized database query"""
        if not self.active_connections:
            print("[WaitingRoom] No active connections for user list broadcast")
            return

        async with self._user_list_lock:
            try:
                print("[WaitingRoom] Starting user list broadcast")
                db = await get_database()
                online_users = []
                
                # Optimize database query with projection
                projection = {
                    "name": 1, "user_type": 1, "avatar": 1, "role": 1,
                    "is_active": 1, "is_verified": 1, "trend": 1,
                    "level": 1, "total_point": 1, "kicker_skills": 1,
                    "goalkeeper_skills": 1, "total_kicked": 1,
                    "kicked_win": 1, "total_keep": 1, "keep_win": 1,
                    "is_pro": 1,
                    "extra_skill_win": 1, "remaining_matches": 1
                }
                
                for user_id in list(self.active_connections.keys()):
                    print(f"[WaitingRoom] Fetching data for user {user_id}")
                    user = await db.users.find_one(
                        {"_id": ObjectId(user_id)},
                        projection=projection
                    )
                    if user and user.get("remaining_matches", 0) > 0:
                        online_users.append({
                            "id": str(user["_id"]),
                            "name": user.get("name", "Anonymous"),
                            "user_type": user.get("user_type", "guest"),
                            "avatar": user.get("avatar", ""),
                            "role": user.get("role", "user"),
                            "is_active": user.get("is_active", True),
                            "is_verified": user.get("is_verified", False),
                            "trend": user.get("trend", "neutral"),
                            "level": user.get("level", 1),
                            "total_point": user.get("total_point", 0),
                            "kicker_skills": user.get("kicker_skills", []),
                            "goalkeeper_skills": user.get("goalkeeper_skills", []),
                            "total_kicked": user.get("total_kicked", 0),
                            "kicked_win": user.get("kicked_win", 0),
                            "total_keep": user.get("total_keep", 0),
                            "keep_win": user.get("keep_win", 0),
                            "is_pro": user.get("is_pro", False),
                            "connected_at": get_vietnam_time().isoformat(),
                            "remaining_matches": user.get("remaining_matches", 0)
                        })

                message = {
                    "type": "user_list",
                    "users": online_users
                }
                print(f"[WaitingRoom] Broadcasting user list with {len(online_users)} users")
                await self.broadcast(message)

            except Exception as e:
                print(f"[WaitingRoom] Error broadcasting user list: {str(e)}")
                api_logger.error(f"Error broadcasting user list: {str(e)}")

    async def start_ping_loop(self):
        """Start ping loop with error handling"""
        while True:
            try:
                await asyncio.sleep(self.ping_interval)
                for user_id in list(self.active_connections.keys()):
                    try:
                        ping_data = json.dumps({
                            "type": "ping",
                            "timestamp": get_vietnam_time().isoformat()
                        }, cls=JSONEncoder)
                        await self.active_connections[user_id].send_text(ping_data)
                    except Exception as e:
                        api_logger.error(f"Error sending ping to {user_id}: {str(e)}")
                        await self.disconnect(user_id)
            except Exception as e:
                api_logger.error(f"Error in ping loop: {str(e)}")
                await asyncio.sleep(5)  # Wait before retrying

    async def _cleanup_loop(self):
        """Periodic cleanup of inactive connections"""
        while True:
            try:
                await asyncio.sleep(self._cleanup_interval)
                current_time = time.time()
                inactive_users = []
                
                for user_id, user_data in self.online_users.items():
                    connected_at = datetime.fromisoformat(user_data["connected_at"])
                    if (current_time - connected_at.timestamp()) > 3600:  # 1 hour
                        inactive_users.append(user_id)
                
                for user_id in inactive_users:
                    await self.disconnect(user_id)
                    
            except Exception as e:
                api_logger.error(f"Error in cleanup loop: {str(e)}")
                await asyncio.sleep(5)

    async def cleanup(self):
        """Cleanup all resources"""
        if self._ping_task:
            self._ping_task.cancel()
            try:
                await self._ping_task
            except asyncio.CancelledError:
                pass
        
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        # Close all connections
        for user_id in list(self.active_connections.keys()):
            await self.disconnect(user_id)

    async def handle_message(self, websocket: WebSocket, user_id: str, message: dict):
        """Handle incoming WebSocket messages"""
        message_type = message.get("type")
        
        if message_type == "chat_message":
            try:
                # Handle chat message
                chat_message = message.get("message", "").strip()
                if not chat_message:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Message cannot be empty"
                    })
                    return

                # Validate message length
                if len(chat_message) > 1000:  # Maximum message length
                    await websocket.send_json({
                        "type": "error",
                        "message": "Message is too long (maximum 1000 characters)"
                    })
                    return

                # Get sender info (from online_users for current info)
                sender_info = self.online_users.get(user_id, {})
                if not sender_info:
                    await websocket.send_json({
                        "type": "error",
                        "message": "User information not found"
                    })
                    return

                # Create message object to SAVE TO DATABASE with Vietnam timezone
                vietnam_time = get_vietnam_time()
                # Ensure the timestamp is stored with Vietnam timezone offset
                vietnam_time = vietnam_time.astimezone(VIETNAM_TZ)
                
                # Convert to dict with explicit timezone info for MongoDB
                message_dict = {
                    "from_id": user_id,
                    "message": chat_message,
                    "timestamp": vietnam_time.isoformat(),  # string ISO 8601, giữ nguyên +07:00
                    "timezone": "Asia/Ho_Chi_Minh",
                    "utc_offset": "+07:00"  # Explicitly store UTC offset
                }
                
                print(f"[WaitingRoom] Message dict before save: {message_dict}")
                
                # Save to database with timeout and retry
                max_retries = 3
                retry_count = 0
                while retry_count < max_retries:
                    try:
                        chat_messages = await get_chat_messages_collection()
                        # Use update_one with upsert to ensure proper timezone handling
                        result = await asyncio.wait_for(
                            chat_messages.update_one(
                                {"_id": ObjectId()},  # Generate new ObjectId
                                {"$set": message_dict},
                                upsert=True
                            ),
                            timeout=5.0
                        )
                        print(f"[WaitingRoom] Save result: {result.raw_result}")
                        break
                    except asyncio.TimeoutError:
                        retry_count += 1
                        if retry_count == max_retries:
                            print(f"[WaitingRoom] Database operation timed out after {max_retries} retries for user {user_id}")
                            await websocket.send_json({
                                "type": "error",
                                "message": "Failed to save message. Please try again."
                            })
                            return
                        await asyncio.sleep(1)  # Wait before retry
                    except Exception as db_error:
                        print(f"[WaitingRoom] Database error for user {user_id}: {str(db_error)}")
                        await websocket.send_json({
                            "type": "error",
                            "message": "Failed to save message. Please try again."
                        })
                        return
                
                # Create message object to BROADCAST
                message_obj_broadcast = {
                    "type": "chat_message",
                    "from_id": user_id,
                    "message": chat_message,
                    "timestamp": vietnam_time.isoformat(),
                    "timezone": "Asia/Ho_Chi_Minh",
                    "from": {
                        "id": user_id,
                        "name": sender_info.get("name", "Anonymous"),
                        "avatar": sender_info.get("avatar", ""),
                        "user_type": sender_info.get("user_type", "user"),
                        "role": sender_info.get("role", "user"),
                        "is_active": sender_info.get("is_active", True),
                        "is_verified": sender_info.get("is_verified", False),
                        "trend": sender_info.get("trend", "neutral"),
                        "level": sender_info.get("level", 1),
                        "is_pro": sender_info.get("is_pro", False),
                        "position": sender_info.get("position", "both"),
                        "total_point": sender_info.get("total_point", 0),
                        "bonus_point": sender_info.get("bonus_point", 0),
                        "total_kicked": sender_info.get("total_kicked", 0),
                        "kicked_win": sender_info.get("kicked_win", 0),
                        "total_keep": sender_info.get("total_keep", 0),
                        "keep_win": sender_info.get("keep_win", 0),
                        "legend_level": sender_info.get("legend_level", 0),
                        "vip_level": sender_info.get("vip_level", "NONE")
                    }
                }
                
                # Broadcast chat message to all users
                await self.broadcast(message_obj_broadcast)

            except Exception as e:
                print(f"[WaitingRoom] Error handling chat message from {user_id}: {str(e)}")
                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Failed to send message. Please try again."
                    })
                except:
                    pass
        
        elif message_type == "challenge_request":
            to_id = message.get("to")
            if to_id:
                await challenge_manager.handle_challenge_request(websocket, user_id, to_id, self.active_connections)
            else:
                print(f"[WaitingRoom] challenge_request missing 'to' field: {message}")
        
        elif message_type == "challenge_accept":
            to_id = message.get("to")
            if to_id:
                await challenge_manager.handle_challenge_response(websocket, user_id, to_id, True, self.active_connections)
        
        elif message_type == "challenge_decline":
            to_id = message.get("to")
            if to_id:
                await challenge_manager.handle_challenge_response(websocket, user_id, to_id, False, self.active_connections)
        
        elif message_type == "user_updated":
            # Update user info in online_users
            if user_id in self.online_users:
                self.online_users[user_id].update(message.get("user", {}))
                # Broadcast updated user list to all clients
                await self.broadcast_user_list()
        
        elif message_type == "get_user_list":
            users = self.get_online_users()
            await websocket.send_json({"type": "user_list", "users": users})
        
        elif message_type == "ping":
            await websocket.send_json({"type": "pong"})

manager = WaitingRoomManager()

async def validate_user(websocket: WebSocket) -> dict:
    """Validate user with optimized token handling"""
    try:
        access_token = websocket.query_params.get("access_token") or websocket.headers.get("authorization", "").replace("Bearer ", "")
        
        if not access_token:
            api_logger.error("No access token provided")
            raise HTTPException(status_code=401, detail="No access token provided")

        try:
            data = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = data.get("_id")
            exp = data.get("exp")
            
            if not user_id:
                api_logger.error("No user_id in token")
                raise HTTPException(status_code=401, detail="Invalid token")

            if exp and get_vietnam_time().timestamp() > exp:
                api_logger.error("Token expired")
                raise HTTPException(status_code=401, detail="Token expired")

        except JWTError as e:
            api_logger.error(f"JWT decode error: {str(e)}")
            raise HTTPException(status_code=401, detail="Invalid token")

        db = await get_database()
        user_data = await db.users.find_one({"_id": ObjectId(user_id)})
        
        if not user_data:
            api_logger.error(f"User not found with id: {user_id}")
            raise HTTPException(status_code=401, detail="User not found")

        return user_data
    except Exception as e:
        api_logger.error(f"Error validating user: {str(e)}")
        raise HTTPException(status_code=401, detail="User validation failed")

async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint with optimized connection handling"""
    try:
        user_data = await validate_user(websocket)
        user_id = str(user_data["_id"])
        
        await manager.connect(websocket, user_id, user_data)
        
        # Send user info
        await manager.send_personal_message({
            "type": "me",
            "user": manager.online_users[user_id]
        }, user_id)
        
        # Broadcast user joined
        await manager.broadcast({
            "type": "user_joined",
            "user": manager.online_users[user_id]
        }, user_id)
        
        # Handle messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                await manager.handle_message(websocket, user_id, message)
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                api_logger.error(f"Invalid JSON from user {user_id}")
                continue
            except Exception as e:
                api_logger.error(f"Error handling message from {user_id}: {str(e)}")
                break
                
    except Exception as e:
        api_logger.error(f"Error in websocket connection: {str(e)}")
    finally:
        if 'user_id' in locals():
            await manager.disconnect(user_id)
            await manager.broadcast_user_list()
            await manager.broadcast({
                "type": "user_left",
                "user_id": user_id,
                "timestamp": get_vietnam_time().isoformat()
            })