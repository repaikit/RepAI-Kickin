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

SECRET_KEY = os.getenv("JWT_KEY", "your-very-secret-key")
ALGORITHM = "HS256"

class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

class WaitingRoomManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.online_users: Dict[str, dict] = {}  # user_id -> user_info
        self.ping_interval = 30  # seconds

    async def connect(self, websocket: WebSocket, user_id: str, user_data: dict):
        """Handle new WebSocket connection"""
        try:
            # Accept connection
            await websocket.accept()
            self.active_connections[user_id] = websocket
            
            # Store user data
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
                "remaining_matches": user_data.get("remaining_matches", 5),
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

            await self.broadcast_user_list()

        except Exception as e:
            api_logger.error(f"Error in websocket connection: {str(e)}")
            try:
                await websocket.close(code=4000, reason="Internal server error")
            except:
                pass

    async def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.online_users:
            del self.online_users[user_id]
        challenge_manager.cleanup_user_challenges(user_id)
        await self.broadcast_user_list()

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
        """Broadcast the list of online users to all connected clients"""
        if not self.active_connections:
            return

        db = await get_database()
        online_users = []
        for user_id in list(self.active_connections.keys()):
            user = await db.users.find_one({"_id": ObjectId(user_id)})
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
                    "total_extra_skill": user.get("total_extra_skill", 0),
                    "extra_skill_win": user.get("extra_skill_win", 0),
                    "connected_at": datetime.utcnow().isoformat(),
                    "remaining_matches": user.get("remaining_matches", 0)
                })

        message = {
            "type": "user_list",
            "users": online_users
        }

        disconnected_users = []
        for user_id, connection in list(self.active_connections.items()):
            try:
                await connection.send_json(message)
            except Exception as e:
                # Remove disconnected user
                disconnected_users.append(user_id)
                api_logger.error(f"[WaitingRoom] Remove disconnected user: {user_id} - {e}")
        for user_id in disconnected_users:
            await self.disconnect(user_id)

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

    async def handle_message(self, websocket: WebSocket, user_id: str, message: dict):
        """Handle incoming WebSocket messages"""
        message_type = message.get("type")
        print(f"[WaitingRoom] handle_message: Received message type={message_type}, from={user_id}, to={message.get('to')}")
        
        if message_type == "chat_message":
            # Handle chat message
            chat_message = message.get("message", "")
            if chat_message:
                # Get sender info (from online_users for current info)
                sender_info = self.online_users.get(user_id, {})
                
                # Create message object to SAVE TO DATABASE (only store ID)
                message_obj_db = {
                    "from_id": user_id,
                    "message": chat_message,
                    "timestamp": datetime.utcnow()
                }
                
                # Save to database
                chat_messages = await get_chat_messages_collection()
                await chat_messages.insert_one(message_obj_db)
                
                # Create message object to BROADCAST (include current name/avatar)
                message_obj_broadcast = {
                    "type": "chat_message",
                    "from": {
                        "id": user_id,
                        "name": sender_info.get("name", "Anonymous"),
                        "avatar": sender_info.get("avatar", "")
                    },
                    "message": chat_message,
                    "timestamp": message_obj_db["timestamp"].isoformat()
                }
                
                # Broadcast chat message to all users
                await self.broadcast(message_obj_broadcast)
        
        elif message_type == "get_chat_history":
            api_logger.info(f"[WaitingRoom] Received get_chat_history request from {user_id}")
            try:
                chat_messages_collection = await get_chat_messages_collection()
                # Get last 50 messages
                messages_from_db = await chat_messages_collection.find().sort("timestamp", -1).limit(50).to_list(length=50)
                
                api_logger.info(f"[WaitingRoom] Fetched {len(messages_from_db)} messages from DB for history.")
                if not messages_from_db:
                    api_logger.info("[WaitingRoom] No chat history found in DB.")
                    # Send empty history if none found
                    await self.send_personal_message({"type": "chat_history", "messages": []}, user_id)
                    return # Exit function if no messages

                messages_from_db.reverse()

                # Populate sender info for historical messages
                populated_messages = []
                users_collection = await get_database()

                for msg_db in messages_from_db:
                    api_logger.info(f"[WaitingRoom] Processing DB message: {msg_db.get('_id')}") # Log message ID for tracking

                    from_id = msg_db.get("from_id")
                    if not from_id:
                        api_logger.warning(f"[WaitingRoom] DB message {msg_db.get('_id')} is missing from_id! Skipping.")
                        continue # Skip message if from_id is missing

                    api_logger.info(f"[WaitingRoom] Message {msg_db.get('_id')}: from_id={from_id}")

                    # First check if user is online
                    sender_info = self.online_users.get(from_id)
                    
                    if sender_info:
                        api_logger.info(f"[WaitingRoom] Message {msg_db.get('_id')}: Found user {from_id} in online_users. Info: {sender_info}")
                        processed_sender_info = {
                            "id": sender_info.get("id", from_id),
                            "name": sender_info.get("name", "Anonymous"),
                            "avatar": sender_info.get("avatar", "")
                        }
                    else:
                        api_logger.info(f"[WaitingRoom] Message {msg_db.get('_id')}: User {from_id} not online, fetching from DB")
                        try:
                            # Query users collection using ObjectId
                            user_data = await users_collection.find_one({"_id": ObjectId(from_id)})
                            if user_data:
                                processed_sender_info = {
                                    "id": str(user_data["_id"]),
                                    "name": user_data.get("name", "Anonymous"),
                                    "avatar": user_data.get("avatar", ""),
                                    "user_type": user_data.get("user_type", "user"),
                                    "role": user_data.get("role", "user"),
                                    "is_active": user_data.get("is_active", True),
                                    "is_verified": user_data.get("is_verified", False),
                                    "trend": user_data.get("trend", "neutral"),
                                    "level": user_data.get("level", 1),
                                    "is_pro": user_data.get("is_pro", False)
                                }
                                api_logger.info(f"[WaitingRoom] Message {msg_db.get('_id')}: Found user {from_id} in DB. Info: {processed_sender_info}")
                            else:
                                processed_sender_info = {"id": from_id, "name": "Unknown User", "avatar": ""}
                                api_logger.warning(f"[WaitingRoom] Message {msg_db.get('_id')}: User {from_id} not found in DB!")
                        except Exception as e:
                            processed_sender_info = {"id": from_id, "name": "Error User", "avatar": ""}
                            api_logger.error(f"[WaitingRoom] Message {msg_db.get('_id')}: Error fetching user {from_id} from DB: {e}")

                    # Use the processed_sender_info for the message
                    populated_messages.append({
                        "type": "chat_message",
                        "from": processed_sender_info,
                        "message": msg_db["message"],
                        "timestamp": msg_db["timestamp"].isoformat()
                    })

                api_logger.info(f"[WaitingRoom] Finished populating {len(populated_messages)} messages for history.")
                # Log a sample of the populated messages to check format before sending
                api_logger.info(f"[WaitingRoom] Sending chat history to {user_id}. Sample message (first 3): {populated_messages[:3]}")
                await self.send_personal_message({
                    "type": "chat_history",
                    "messages": populated_messages
                }, user_id)

            except Exception as e:
                api_logger.error(f"[WaitingRoom] Error in get_chat_history handler for user {user_id}: {e}")
                # Optionally send an error message back to the client
                await self.send_personal_message({"type": "error", "message": "Failed to load chat history."}, user_id)
        
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
        
        elif message_type == "ping":
            await websocket.send_json({"type": "pong"})

manager = WaitingRoomManager()

async def validate_user(websocket: WebSocket) -> dict:
    """Validate user from WebSocket connection"""
    try:
        # Lấy token từ query params hoặc header
        access_token = websocket.query_params.get("access_token") or websocket.headers.get("authorization", "").replace("Bearer ", "")
        
        if not access_token:
            api_logger.error("No access token provided")
            raise HTTPException(status_code=401, detail="No access token provided")

        try:
            data = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = data.get("_id")
            exp = data.get("exp")
            
            # Check token expiration
            if exp and datetime.utcnow().timestamp() > exp:
                api_logger.error("Token expired")
                raise HTTPException(status_code=401, detail="Token expired")

            
            if not user_id:
                api_logger.error("No user_id in token")
                raise HTTPException(status_code=401, detail="Invalid token")
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
    try:
        
        # Validate user from WebSocket connection
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
                "timestamp": datetime.utcnow().isoformat()
            })