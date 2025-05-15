from fastapi import WebSocket, WebSocketDisconnect, HTTPException
from typing import Dict, List, Optional
import json
from datetime import datetime, timedelta
import asyncio
from database.database import get_online_users_collection, get_users_collection
from utils.logger import api_logger
import httpx
from config.settings import settings
from bson import ObjectId
from jose import jwt, JWTError
import os

SECRET_KEY = os.getenv("JWT_KEY", "your-very-secret-key")
ALGORITHM = "HS256"

class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.online_users: Dict[str, dict] = {}  # user_id -> user_info
        self.ping_interval = 30  # seconds

    async def connect(self, websocket: WebSocket, user_id: str, user_data: dict):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.online_users[user_id] = {
            "id": str(user_data["_id"]),
            "name": user_data.get("name") or "Guest Player",
            "type": user_data.get("user_type") or "guest",
            "avatar": user_data.get("avatar") or "",
            "position": user_data.get("position") or "both",
            "role": user_data.get("role") or "user",
            "is_active": user_data.get("is_active", True),
            "is_verified": user_data.get("is_verified", False),
            "trend": user_data.get("trend") or "neutral",
            "remaining_matches": user_data.get("remaining_matches", 5),
            "point": user_data.get("point", 0),
            "level": user_data.get("level", 1),
            "kicker_skills": user_data.get("kicker_skills", []),
            "goalkeeper_skills": user_data.get("goalkeeper_skills", []),
            "total_kicked": user_data.get("total_kicked", 0),
            "kicked_win": user_data.get("kicked_win", 0),
            "total_keep": user_data.get("total_keep", 0),
            "keep_win": user_data.get("keep_win", 0),
            "is_pro": user_data.get("is_pro", False),
            "total_extra_skill": user_data.get("total_extra_skill", 0),
            "extra_skill_win": user_data.get("extra_skill_win", 0),
            "connected_at": datetime.utcnow().isoformat()
        }
        api_logger.info(f"New connection: {user_id}")
        # Broadcast lại danh sách online cho tất cả client
        await self.broadcast_user_list()

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.online_users:
            del self.online_users[user_id]
        api_logger.info(f"Connection closed: {user_id}")

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            try:
                data = json.dumps(message, cls=JSONEncoder)
                await self.active_connections[user_id].send_text(data)
            except Exception as e:
                api_logger.error(f"Error sending message to {user_id}: {str(e)}")
                self.disconnect(user_id)

    async def broadcast(self, message: dict, exclude_user_id: Optional[str] = None):
        data = json.dumps(message, cls=JSONEncoder)
        for user_id, connection in list(self.active_connections.items()):
            if user_id != exclude_user_id:
                try:
                    await connection.send_text(data)
                except Exception as e:
                    api_logger.error(f"Error broadcasting to {user_id}: {str(e)}")
                    self.disconnect(user_id)

    def get_online_users(self):
        return list(self.online_users.values())

    async def broadcast_user_list(self):
        user_list_message = {
            "type": "user_list",
            "users": self.get_online_users()
        }
        data = json.dumps(user_list_message, cls=JSONEncoder)
        for user_id in list(self.active_connections.keys()):
            await self.active_connections[user_id].send_text(data)

    async def start_ping_loop(self):
        while True:
            try:
                await asyncio.sleep(self.ping_interval)
                for user_id in list(self.active_connections.keys()):
                    try:
                        ping_data = json.dumps({"type": "ping", "timestamp": datetime.utcnow().isoformat()}, cls=JSONEncoder)
                        await self.active_connections[user_id].send_text(ping_data)
                    except Exception as e:
                        api_logger.error(f"Error sending ping to {user_id}: {str(e)}")
                        self.disconnect(user_id)
            except Exception as e:
                api_logger.error(f"Error in ping loop: {str(e)}")

manager = ConnectionManager()

async def validate_user(websocket: WebSocket) -> dict:
    """Validate user from WebSocket connection"""
    try:
        # Lấy token từ query params hoặc header
        access_token = websocket.query_params.get("access_token") or websocket.headers.get("authorization", "").replace("Bearer ", "")
        api_logger.info(f"Received access token: {access_token[:10]}...")
        
        if not access_token:
            api_logger.error("No access token provided")
            raise HTTPException(status_code=401, detail="No access token provided")

        try:
            data = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = data.get("_id")
            api_logger.info(f"Decoded token data - user_id: {user_id}")
            
            if not user_id:
                api_logger.error("No user_id in token")
                raise HTTPException(status_code=401, detail="Invalid token")
        except JWTError as e:
            api_logger.error(f"JWT decode error: {str(e)}")
            raise HTTPException(status_code=401, detail="Invalid token")

        users_collection = await get_users_collection()
        user_data = await users_collection.find_one({"_id": ObjectId(user_id)})
        
        if not user_data:
            api_logger.error(f"User not found with id: {user_id}")
            raise HTTPException(status_code=401, detail="User not found")
            
        api_logger.info(f"User validated successfully: {user_id}")
        return user_data
    except Exception as e:
        api_logger.error(f"Error validating user: {str(e)}")
        raise HTTPException(status_code=401, detail="User validation failed")

async def websocket_endpoint(websocket: WebSocket):
    try:
        api_logger.info("New WebSocket connection attempt")
        
        # Validate user from WebSocket connection
        user_data = await validate_user(websocket)
        user_id = str(user_data["_id"])
        api_logger.info(f"User validated, connecting: {user_id}")
        
        await manager.connect(websocket, user_id, user_data)
        api_logger.info(f"WebSocket connected for user: {user_id}")
        
        # Send user info
        await manager.send_personal_message({
            "type": "me",
            "user": manager.online_users[user_id]
        }, user_id)
        api_logger.info(f"User info sent to: {user_id}")
        
        # Broadcast user joined
        await manager.broadcast({
            "type": "user_joined",
            "user": manager.online_users[user_id]
        }, user_id)
        api_logger.info(f"User joined broadcast sent for: {user_id}")
        
        # Handle messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                api_logger.info(f"Received message from {user_id}: {message}")
                
                if message["type"] == "ping":
                    await manager.send_personal_message({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    }, user_id)
                    api_logger.info(f"Ping-pong with user: {user_id}")
                
            except WebSocketDisconnect:
                api_logger.info(f"WebSocket disconnected for user: {user_id}")
                break
            except Exception as e:
                api_logger.error(f"Error handling message from {user_id}: {str(e)}")
                break
                
    except Exception as e:
        api_logger.error(f"Error in websocket connection: {str(e)}")
    finally:
        if 'user_id' in locals():
            manager.disconnect(user_id)
            await manager.broadcast_user_list()
            await manager.broadcast({
                "type": "user_left",
                "user_id": user_id,
                "timestamp": datetime.utcnow().isoformat()
            })
            api_logger.info(f"Cleanup completed for user: {user_id}") 