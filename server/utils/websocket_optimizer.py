import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Any
from fastapi import WebSocket
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
            except Exception:
                pass

    async def _handle_chat_message(self, websocket: WebSocket, user_id: str, message: dict):
        """Handle chat messages with special processing"""
        try:
            # Get handler and lock for chat messages
            handler = self.handlers.get("chat")
            handler_lock = self._handler_locks.get("chat")

            if not handler:
                api_logger.warning("No chat handler registered")
                return

            # Process chat message with locking
            if handler_lock:
                async with handler_lock:
                    await handler(websocket, user_id, message)
            else:
                await handler(websocket, user_id, message)

        except Exception as e:
            api_logger.error(f"Error handling chat message: {str(e)}")
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": "Error processing chat message"
                })
            except Exception:
                pass

    async def cleanup(self):
        """Clean up resources"""
        for handler in self.handlers.values():
            if hasattr(handler, 'cleanup'):
                await handler.cleanup()

class CacheManager:
    def __init__(self, ttl: int = 300):
        self._cache = {}
        self._ttl = {}
        self._ttl_seconds = ttl
        self._cleanup_task = None
        self._lock = asyncio.Lock()

    async def get(self, key: str):
        """Get a value from cache"""
        if key in self._cache:
            if key in self._ttl and datetime.now() > self._ttl[key]:
                del self._cache[key]
                del self._ttl[key]
                return None
            return self._cache[key]
        return None

    async def set(self, key: str, value: any):
        """Set a value in cache"""
        self._cache[key] = value
        if self._ttl_seconds > 0:
            self._ttl[key] = datetime.now() + timedelta(seconds=self._ttl_seconds)
        self._ensure_cleanup_task()

    async def delete(self, key: str):
        """Delete a value from cache"""
        if key in self._cache:
            del self._cache[key]
        if key in self._ttl:
            del self._ttl[key]

    def get_lock(self, key: str) -> asyncio.Lock:
        """Get a lock for a specific key"""
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    def _ensure_cleanup_task(self):
        """Ensure cleanup task is running"""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def _cleanup_loop(self):
        """Periodically clean up expired cache entries"""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                now = datetime.now()
                expired_keys = [
                    key for key, expiry in self._ttl.items()
                    if expiry < now
                ]
                for key in expired_keys:
                    del self._cache[key]
                    del self._ttl[key]
            except Exception as e:
                api_logger.error(f"Error in cache cleanup: {str(e)}")
                await asyncio.sleep(5)  # Wait before retrying

    async def cleanup(self):
        """Clean up all resources"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        self._cache.clear()
        self._ttl.clear() 