import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, List
from fastapi import WebSocket
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from config.settings import settings
from utils.logger import api_logger
from utils.time_utils import get_vietnam_time, to_vietnam_time

class WebSocketRateLimiter:
    def __init__(self, max_messages: int = 100, time_window: int = 60):
        self.max_messages = max_messages
        self.time_window = time_window
        self.message_counts = {}

    async def check_rate_limit(self, user_id: str) -> bool:
        now = get_vietnam_time()
        if user_id not in self.message_counts:
            self.message_counts[user_id] = []
        
        # Remove old messages
        self.message_counts[user_id] = [
            msg_time for msg_time in self.message_counts[user_id]
            if now - msg_time < timedelta(seconds=self.time_window)
        ]
        
        if len(self.message_counts[user_id]) >= self.max_messages:
            return False
            
        self.message_counts[user_id].append(now)
        return True

class WebSocketConnection:
    def __init__(self, websocket: WebSocket, user_id: str):
        self.websocket = websocket
        self.user_id = user_id
        self.last_ping = time.time()
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 3
        self.lock = asyncio.Lock()

    async def send(self, message: dict):
        async with self.lock:
            try:
                # Convert any datetime objects to Vietnam timezone
                if isinstance(message, dict):
                    message = self._convert_datetime_to_vietnam(message)
                await self.websocket.send_json(message)
                self.last_ping = time.time()
                self.reconnect_attempts = 0
            except Exception as e:
                if self.reconnect_attempts < self.max_reconnect_attempts:
                    self.reconnect_attempts += 1
                    await self.reconnect()
                else:
                    raise

    def _convert_datetime_to_vietnam(self, data: dict) -> dict:
        """Convert all datetime objects in a dict to Vietnam timezone"""
        result = {}
        for key, value in data.items():
            if isinstance(value, datetime):
                result[key] = to_vietnam_time(value).isoformat()
            elif isinstance(value, dict):
                result[key] = self._convert_datetime_to_vietnam(value)
            elif isinstance(value, list):
                result[key] = [
                    self._convert_datetime_to_vietnam(item) if isinstance(item, dict)
                    else to_vietnam_time(item).isoformat() if isinstance(item, datetime)
                    else item
                    for item in value
                ]
            else:
                result[key] = value
        return result

    async def reconnect(self):
        try:
            await self.websocket.close()
            # Implement reconnection logic here
            await asyncio.sleep(1)
        except Exception as e:
            api_logger.error(f"Reconnection failed for user {self.user_id}: {str(e)}")

class DatabaseManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DatabaseManager, cls).__new__(cls)
            cls._instance.client = AsyncIOMotorClient(
                settings.MONGODB_URL,
                maxPoolSize=50,
                minPoolSize=10,
                maxIdleTimeMS=30000
            )
            cls._instance.db = cls._instance.client[settings.DATABASE_NAME]
        return cls._instance

    async def get_database(self) -> AsyncIOMotorDatabase:
        return self.db

class MessageHandler:
    def __init__(self):
        self.handlers = {}
        self.rate_limiter = WebSocketRateLimiter()

    def register_handler(self, message_type: str, handler):
        self.handlers[message_type] = handler

    async def handle_message(self, websocket: WebSocket, user_id: str, message: dict):
        try:
            message_type = message.get("type")
            if not message_type:
                await websocket.send_json({
                    "type": "error",
                    "message": "Message type is required"
                })
                return

            # Check rate limit
            if not await self.rate_limiter.check_rate_limit(user_id):
                await websocket.send_json({
                    "type": "error",
                    "message": "Rate limit exceeded"
                })
                return

            # Handle chat messages specifically
            if message_type in ["chat", "chat_message"]:
                handler = self.handlers.get("chat_message")
                if handler:
                    await handler(websocket, user_id, message)
                else:
                    api_logger.warning(f"No handler registered for chat messages")
                return

            # Handle other message types
            handler = self.handlers.get(message_type)
            if handler:
                await handler(websocket, user_id, message)
            else:
                api_logger.warning(f"Unknown message type: {message_type}")
                # Don't send error for unknown message types to avoid loops
                return

        except Exception as e:
            api_logger.error(f"Error handling message: {str(e)}")
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": "Internal server error"
                })
            except:
                pass

class CacheManager:
    def __init__(self, ttl: int = 300):
        self.cache = {}
        self.ttl = ttl
        self.locks = {}

    async def get(self, key: str):
        if key in self.cache:
            data, timestamp = self.cache[key]
            if time.time() - timestamp < self.ttl:
                return data
            del self.cache[key]
        return None

    async def set(self, key: str, value: any):
        self.cache[key] = (value, time.time())

    async def delete(self, key: str):
        if key in self.cache:
            del self.cache[key]

    def get_lock(self, key: str) -> asyncio.Lock:
        if key not in self.locks:
            self.locks[key] = asyncio.Lock()
        return self.locks[key]

# Create global instances
db_manager = DatabaseManager()
message_handler = MessageHandler()
cache_manager = CacheManager() 