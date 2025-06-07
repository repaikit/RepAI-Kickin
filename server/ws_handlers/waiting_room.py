from fastapi import WebSocket, WebSocketDisconnect, HTTPException
from typing import Dict, List, Optional
import json
from datetime import datetime, timedelta
import asyncio
from database.database import get_users_table
from utils.logger import api_logger
import httpx
from config.settings import settings
from jose import jwt, JWTError
import os
from .challenge_handler import challenge_manager
from utils.time_utils import get_vietnam_time, to_vietnam_time, VIETNAM_TZ
import pytz
import time
from utils.content_filter import contains_sensitive_content, filter_sensitive_content

SECRET_KEY = os.getenv("JWT_KEY", "your-very-secret-key")
ALGORITHM = "HS256"

class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
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
        self._leaderboard_interval = 300  # 5 minutes in seconds
        self._leaderboard_task = None
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
                "id": user_data["id"],
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

            # Start ping task if not running
            if not self._ping_task:
                self._ping_task = asyncio.create_task(self.start_ping_loop())

            # Start cleanup task if not running
            if not self._cleanup_task:
                self._cleanup_task = asyncio.create_task(self._cleanup_loop())

            # Start leaderboard update task if not running
            if not self._leaderboard_task:
                self._leaderboard_task = asyncio.create_task(self._leaderboard_update_loop())

            # Send immediate user list to the new connection
            users = self.get_online_users()
            await websocket.send_json({
                "type": "user_list",
                "users": users
            })

            # Send initial leaderboard data
            await self._broadcast_leaderboard()

        except Exception as e:
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
                users_table = await get_users_table()
                online_users = []
                
                # Get all active user IDs
                user_ids = list(self.active_connections.keys())
                
                # Fetch user data in a single query
                response = await users_table.select(
                    "id", "name", "user_type", "avatar", "role",
                    "is_active", "is_verified", "trend", "level",
                    "total_point", "kicker_skills", "goalkeeper_skills",
                    "total_kicked", "kicked_win", "total_keep",
                    "keep_win", "is_pro", "extra_skill_win",
                    "remaining_matches"
                ).in_("id", user_ids).execute()
                
                if response.data:
                    for user in response.data:
                        if user.get("remaining_matches", 0) > 0:
                            online_users.append({
                                "id": user["id"],
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

    async def _leaderboard_update_loop(self):
        """Periodic leaderboard update"""
        while True:
            try:
                await asyncio.sleep(self._leaderboard_interval)
                await self._broadcast_leaderboard()
            except Exception as e:
                api_logger.error(f"Error in leaderboard update loop: {str(e)}")
                await asyncio.sleep(5)

    async def _broadcast_leaderboard(self):
        """Broadcast leaderboard data"""
        try:
            users_table = await get_users_table()
            response = await users_table.select(
                "id", "name", "user_type", "avatar", "total_point",
                "level", "kicker_skills", "goalkeeper_skills",
                "total_kicked", "kicked_win", "total_keep",
                "keep_win", "is_pro"
            ).order("total_point", desc=True).limit(10).execute()
            
            if response.data:
                leaderboard_data = [{
                    "id": user["id"],
                    "name": user.get("name", "Anonymous"),
                    "user_type": user.get("user_type", "guest"),
                    "avatar": user.get("avatar", ""),
                    "total_point": user.get("total_point", 0),
                    "level": user.get("level", 1),
                    "kicker_skills": user.get("kicker_skills", []),
                    "goalkeeper_skills": user.get("goalkeeper_skills", []),
                    "total_kicked": user.get("total_kicked", 0),
                    "kicked_win": user.get("kicked_win", 0),
                    "total_keep": user.get("total_keep", 0),
                    "keep_win": user.get("keep_win", 0),
                    "is_pro": user.get("is_pro", False)
                } for user in response.data]
                
                await self.broadcast({
                    "type": "leaderboard",
                    "data": leaderboard_data
                })
        except Exception as e:
            api_logger.error(f"Error broadcasting leaderboard: {str(e)}")

    async def cleanup(self):
        """Cleanup all connections and tasks"""
        try:
            # Cancel all tasks
            if self._ping_task:
                self._ping_task.cancel()
            if self._cleanup_task:
                self._cleanup_task.cancel()
            if self._leaderboard_task:
                self._leaderboard_task.cancel()
            
            # Close all connections
            for user_id in list(self.active_connections.keys()):
                await self.disconnect(user_id)
                
            # Clear all data
            self.active_connections.clear()
            self.online_users.clear()
            
        except Exception as e:
            api_logger.error(f"Error in cleanup: {str(e)}")

    async def handle_message(self, websocket: WebSocket, user_id: str, message: dict):
        """Handle incoming WebSocket messages"""
        try:
            message_type = message.get("type")
            
            if message_type == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": get_vietnam_time().isoformat()
                })
                
            elif message_type == "chat":
                content = message.get("content", "").strip()
                if not content:
                    return
                    
                # Check for sensitive content
                if contains_sensitive_content(content):
                    filtered_content = filter_sensitive_content(content)
                    await self.send_personal_message({
                        "type": "error",
                        "message": "Your message contains sensitive content and has been filtered."
                    }, user_id)
                    content = filtered_content
                
                # Get user data
                user_data = self.online_users.get(user_id)
                if not user_data:
                    return
                
                # Broadcast chat message
                await self.broadcast({
                    "type": "chat",
                    "user": {
                        "id": user_data["id"],
                        "name": user_data["name"],
                        "avatar": user_data["avatar"],
                        "user_type": user_data["user_type"]
                    },
                    "content": content,
                    "timestamp": get_vietnam_time().isoformat()
                })
                
            elif message_type == "challenge":
                target_id = message.get("target_id")
                if not target_id or target_id not in self.active_connections:
                    await self.send_personal_message({
                        "type": "error",
                        "message": "Invalid target user"
                    }, user_id)
                    return
                
                # Handle challenge through challenge manager
                await challenge_manager.handle_challenge(user_id, target_id)
                
        except Exception as e:
            api_logger.error(f"Error handling message: {str(e)}")
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": "Internal server error"
                })
            except:
                pass

async def validate_user(websocket: WebSocket) -> dict:
    """Validate user token and return user data"""
    try:
        # Get token from query parameters
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=4000, reason="No token provided")
            return None
            
        # Verify token
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            if not user_id:
                await websocket.close(code=4000, reason="Invalid token")
                return None
        except JWTError:
            await websocket.close(code=4000, reason="Invalid token")
            return None
            
        # Get user data
        users_table = await get_users_table()
        response = await users_table.select("*").eq("id", user_id).execute()
        
        if not response.data:
            await websocket.close(code=4000, reason="User not found")
            return None
            
        user_data = response.data[0]
        if not user_data.get("is_active", True):
            await websocket.close(code=4000, reason="User is inactive")
            return None
            
        return user_data
        
    except Exception as e:
        api_logger.error(f"Error validating user: {str(e)}")
        await websocket.close(code=4000, reason="Internal server error")
        return None

async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint handler"""
    user_data = None
    try:
        # Validate user
        user_data = await validate_user(websocket)
        if not user_data:
            return
            
        # Connect to waiting room
        await manager.connect(websocket, user_data["id"], user_data)
        
        # Main message loop
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                await manager.handle_message(websocket, user_data["id"], message)
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid message format"
                })
            except Exception as e:
                api_logger.error(f"Error processing message: {str(e)}")
                await websocket.send_json({
                    "type": "error",
                    "message": "Internal server error"
                })
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        api_logger.error(f"WebSocket error: {str(e)}")
    finally:
        if user_data:
            await manager.disconnect(user_data["id"])

# Create global manager instance
manager = WaitingRoomManager()