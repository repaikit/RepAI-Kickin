import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Any
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
        self.last_message = time.time()
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 3
        self.lock = asyncio.Lock()
        self.message_queue = asyncio.Queue(maxsize=100)  # Limit queue size
        self.is_processing = False
        self.rate_limit = {
            'last_reset': time.time(),
            'message_count': 0,
            'max_messages': 100,
            'window': 60
        }
        self._closed = False

    async def send(self, message: Dict[str, Any]) -> bool:
        """Send a message to the client with rate limiting and error handling"""
        if self._closed:
            return False

        if not await self._check_rate_limit():
            return False

        async with self.lock:
            try:
                if isinstance(message, dict):
                    message = self._convert_datetime_to_vietnam(message)
                
                await self.websocket.send_json(message)
                self.last_message = time.time()
                self.reconnect_attempts = 0
                return True
            except Exception as e:
                api_logger.error(f"Error sending message to user {self.user_id}: {str(e)}")
                if self.reconnect_attempts < self.max_reconnect_attempts:
                    self.reconnect_attempts += 1
                    await self.reconnect()
                return False

    async def _check_rate_limit(self) -> bool:
        """Check if the connection is within rate limits"""
        current_time = time.time()
        
        if current_time - self.rate_limit['last_reset'] > self.rate_limit['window']:
            self.rate_limit['message_count'] = 0
            self.rate_limit['last_reset'] = current_time
        
        if self.rate_limit['message_count'] >= self.rate_limit['max_messages']:
            api_logger.warning(f"Rate limit exceeded for user {self.user_id}")
            return False
        
        self.rate_limit['message_count'] += 1
        return True

    async def reconnect(self) -> bool:
        """Attempt to reconnect the WebSocket connection"""
        if self._closed:
            return False

        try:
            await self.websocket.close()
            await asyncio.sleep(1)
            return True
        except Exception as e:
            api_logger.error(f"Error during reconnection for user {self.user_id}: {str(e)}")
            return False

    def is_alive(self) -> bool:
        """Check if the connection is still alive based on last message time"""
        if self._closed:
            return False
        current_time = time.time()
        return current_time - self.last_message < 60

    def _convert_datetime_to_vietnam(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert all datetime objects in a dict to Vietnam timezone"""
        if not isinstance(data, dict):
            return data

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

    async def process_message_queue(self):
        """Process messages in the queue"""
        if self.is_processing or self._closed:
            return

        self.is_processing = True
        try:
            while not self.message_queue.empty() and not self._closed:
                message = await self.message_queue.get()
                if not await self.send(message):
                    await self.message_queue.put(message)
                    break
                self.message_queue.task_done()
        finally:
            self.is_processing = False

    async def queue_message(self, message: Dict[str, Any]):
        """Add a message to the queue for processing"""
        if self._closed:
            return

        try:
            await self.message_queue.put(message)
            if not self.is_processing:
                asyncio.create_task(self.process_message_queue())
        except asyncio.QueueFull:
            api_logger.warning(f"Message queue full for user {self.user_id}")

    async def close(self):
        """Close the WebSocket connection gracefully"""
        self._closed = True
        try:
            await self.websocket.close()
        except Exception as e:
            api_logger.error(f"Error closing connection for user {self.user_id}: {str(e)}")

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
        self._handler_locks = {}

    def register_handler(self, message_type: str, handler):
        """Register a handler for a specific message type"""
        self.handlers[message_type] = handler
        self._handler_locks[message_type] = asyncio.Lock()

    async def handle_message(self, websocket: WebSocket, user_id: str, message: dict):
        """Handle incoming WebSocket messages with rate limiting and error handling"""
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

            # Get handler and lock for this message type
            handler = self.handlers.get(message_type)
            handler_lock = self._handler_locks.get(message_type)

            if not handler:
                api_logger.warning(f"Unknown message type: {message_type}")
                return

            # Handle chat messages with special processing
            if message_type in ["chat", "chat_message"]:
                await self._handle_chat_message(websocket, user_id, message)
                return

            # Handle other message types with locking
            if handler_lock:
                async with handler_lock:
                    await handler(websocket, user_id, message)
            else:
                await handler(websocket, user_id, message)

        except Exception as e:
            api_logger.error(f"Error handling message: {str(e)}")
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": "Internal server error"
                })
            except:
                pass

    async def _handle_chat_message(self, websocket: WebSocket, user_id: str, message: dict):
        """Handle chat messages with special processing"""
        handler = self.handlers.get("chat_message")
        if not handler:
            api_logger.warning("No handler registered for chat messages")
            return

        # Validate message
        chat_message = message.get("message", "").strip()
        if not chat_message:
            await websocket.send_json({
                "type": "error",
                "message": "Message cannot be empty"
            })
            return

        if len(chat_message) > 1000:
            await websocket.send_json({
                "type": "error",
                "message": "Message is too long (maximum 1000 characters)"
            })
            return

        # Process chat message with handler
        await handler(websocket, user_id, message)

    async def cleanup(self):
        """Cleanup resources"""
        for lock in self._handler_locks.values():
            if lock.locked():
                lock.release()

class CacheManager:
    def __init__(self, ttl: int = 300):
        self.cache = {}
        self.ttl = ttl
        self.locks = {}
        self._cleanup_task = None
        self._cleanup_interval = 60  # Run cleanup every 60 seconds

    async def get(self, key: str):
        """Get a value from cache with TTL check"""
        if key in self.cache:
            data, timestamp = self.cache[key]
            if time.time() - timestamp < self.ttl:
                return data
            del self.cache[key]
        return None

    async def set(self, key: str, value: any):
        """Set a value in cache with timestamp"""
        self.cache[key] = (value, time.time())
        self._ensure_cleanup_task()

    async def delete(self, key: str):
        """Delete a value from cache"""
        if key in self.cache:
            del self.cache[key]

    def get_lock(self, key: str) -> asyncio.Lock:
        """Get or create a lock for a key"""
        if key not in self.locks:
            self.locks[key] = asyncio.Lock()
        return self.locks[key]

    def _ensure_cleanup_task(self):
        """Ensure cleanup task is running"""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def _cleanup_loop(self):
        """Periodically clean up expired cache entries"""
        while True:
            try:
                await asyncio.sleep(self._cleanup_interval)
                current_time = time.time()
                expired_keys = [
                    key for key, (_, timestamp) in self.cache.items()
                    if current_time - timestamp >= self.ttl
                ]
                for key in expired_keys:
                    del self.cache[key]
            except Exception as e:
                api_logger.error(f"Error in cache cleanup: {str(e)}")

    async def cleanup(self):
        """Cleanup all resources"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None

        # Clear all locks
        for lock in self.locks.values():
            if lock.locked():
                lock.release()
        self.locks.clear()

        # Clear cache
        self.cache.clear()

# Create global instances with optimized settings
db_manager = DatabaseManager()
message_handler = MessageHandler()
cache_manager = CacheManager(ttl=300)  # 5 minutes TTL 