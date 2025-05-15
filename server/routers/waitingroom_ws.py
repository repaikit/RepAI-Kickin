from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse
from typing import List, Dict, Optional, Any
from utils.logger import ws_logger
from database.database import get_users_collection
from datetime import datetime
import json
import asyncio
from bson import ObjectId
import os

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_info: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()
        self._is_vercel = os.getenv("VERCEL") == "1"

    async def connect(self, websocket: WebSocket, user_id: str, user_data: Dict[str, Any]):
        try:
            await websocket.accept()
            async with self._lock:
                self.active_connections[user_id] = websocket
                self.user_info[user_id] = user_data
            ws_logger.info(f"User {user_id} connected to waiting room.")
        except Exception as e:
            ws_logger.error(f"Error accepting WebSocket connection: {str(e)}")
            raise

    async def disconnect(self, user_id: str):
        async with self._lock:
            if user_id in self.active_connections:
                try:
                    await self.active_connections[user_id].close()
                except Exception as e:
                    ws_logger.error(f"Error closing WebSocket for user {user_id}: {str(e)}")
                finally:
                    del self.active_connections[user_id]
                    if user_id in self.user_info:
                        del self.user_info[user_id]
                    ws_logger.info(f"User {user_id} disconnected from waiting room.")

    async def broadcast(self, message: Dict[str, Any], exclude_user: Optional[str] = None):
        disconnected_users = []
        for user_id, connection in self.active_connections.items():
            if user_id != exclude_user:
                try:
                    # Add timestamp for Vercel compatibility
                    if self._is_vercel:
                        message["timestamp"] = datetime.utcnow().isoformat()
                    await connection.send_json(message)
                except WebSocketDisconnect:
                    disconnected_users.append(user_id)
                except Exception as e:
                    ws_logger.error(f"Error broadcasting to user {user_id}: {str(e)}")
                    disconnected_users.append(user_id)

        # Clean up disconnected users
        for user_id in disconnected_users:
            await self.disconnect(user_id)

manager = ConnectionManager()

@router.websocket("/ws/waitingroom/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    try:
        # Get user data from database
        users_collection = await get_users_collection()
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            ws_logger.error(f"User not found for id: {user_id}")
            await websocket.close(code=1008)  # Policy Violation
            return

        # Connect to WebSocket
        await manager.connect(websocket, user_id, {
            "id": str(user["_id"]),
            "name": user.get("name", "Unknown"),
            "type": user.get("type", "unknown"),
            "avatar": user.get("avatar", ""),
            "remaining_matches": user.get("remaining_matches", 0),
            "wins": user.get("wins", 0),
            "losses": user.get("losses", 0),
            "connected_at": datetime.utcnow().isoformat()
        })

        # Send current user list to the new user
        await websocket.send_json({
            "type": "user_list",
            "users": list(manager.user_info.values())
        })

        # Broadcast user joined
        await manager.broadcast({
            "type": "user_joined",
            "user": {
                "id": str(user["_id"]),
                "name": user.get("name", "Unknown"),
                "type": user.get("type", "unknown"),
                "avatar": user.get("avatar", ""),
                "remaining_matches": user.get("remaining_matches", 0),
                "wins": user.get("wins", 0),
                "losses": user.get("losses", 0),
                "connected_at": datetime.utcnow().isoformat()
            }
        }, exclude_user=user_id)

        try:
            while True:
                # Add timeout for Vercel compatibility
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=5.0
                )
                try:
                    message = json.loads(data)
                    # Handle different message types here
                    if message.get("type") == "chat":
                        await manager.broadcast({
                            "type": "chat",
                            "user": {
                                "id": str(user["_id"]),
                                "name": user.get("name", "Unknown")
                            },
                            "message": message.get("message", ""),
                            "timestamp": datetime.utcnow().isoformat()
                        })
                    elif message.get("type") == "ping":
                        # Handle ping messages for keep-alive
                        await websocket.send_json({
                            "type": "pong",
                            "timestamp": datetime.utcnow().isoformat()
                        })
                except json.JSONDecodeError:
                    ws_logger.error(f"Invalid JSON received from user {user_id}")
                    continue

        except asyncio.TimeoutError:
            ws_logger.info(f"WebSocket timeout for user {user_id}")
        except WebSocketDisconnect:
            ws_logger.info(f"WebSocket disconnected for user {user_id}")
        except Exception as e:
            ws_logger.error(f"WebSocket error: {str(e)}")
        finally:
            await manager.disconnect(user_id)
            # Broadcast user left
            await manager.broadcast({
                "type": "user_left",
                "user_id": user_id,
                "timestamp": datetime.utcnow().isoformat()
            })

    except Exception as e:
        ws_logger.error(f"Error in WebSocket connection: {str(e)}")
        try:
            await websocket.close(code=1011)  # Internal Error
        except:
            pass 