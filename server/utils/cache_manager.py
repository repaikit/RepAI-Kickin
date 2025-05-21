from cachetools import TTLCache, cached
from typing import Any, Callable, Optional
import time
from functools import wraps
from fastapi import Response
import json
from datetime import datetime, timedelta
from utils.logger import api_logger

class CacheManager:
    def __init__(self):
        self._cache = {}
        self._ttl = {}

    def get(self, key: str) -> Optional[Any]:
        if key not in self._cache:
            return None
        
        if key in self._ttl and datetime.now() > self._ttl[key]:
            del self._cache[key]
            del self._ttl[key]
            return None
            
        return self._cache[key]

    def set(self, key: str, value: Any, ttl: int = 300) -> None:
        self._cache[key] = value
        if ttl > 0:
            self._ttl[key] = datetime.now() + timedelta(seconds=ttl)

    def delete(self, key: str) -> None:
        if key in self._cache:
            del self._cache[key]
        if key in self._ttl:
            del self._ttl[key]

    def clear(self) -> None:
        self._cache.clear()
        self._ttl.clear()

    def get_stats(self) -> dict:
        return {
            "size": len(self._cache),
            "keys": list(self._cache.keys())
        }

    def cache_response(self, response: Response, ttl: int = 300) -> None:
        """Cache a response object, handling both regular and streaming responses"""
        try:
            cache_key = response.headers.get("x-cache-key", "")
            if not cache_key:
                return

            # Get response data
            response_data = {
                "headers": dict(response.headers),
                "status_code": response.status_code
            }

            # For regular responses, include body
            if hasattr(response, "body"):
                response_data["body"] = response.body
            else:
                # For streaming responses, mark as streaming
                response_data["is_streaming"] = True

            # Cache the response data
            self.set(cache_key, response_data, ttl)
            api_logger.debug(f"Cached response for key: {cache_key}")

        except Exception as e:
            api_logger.error(f"Cache error: {str(e)}")

def cache_response(ttl: int = 300):
    """
    Decorator to cache function results
    :param ttl: Time to live in seconds
    """
    def decorator(func: Callable):
        cache = TTLCache(maxsize=1000, ttl=ttl)
        
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            key = f"{func.__name__}:{str(args)}:{str(kwargs)}"
            
            # Try to get from cache
            try:
                return cache[key]
            except KeyError:
                # If not in cache, execute function
                result = await func(*args, **kwargs)
                cache[key] = result
                return result
                
        return wrapper
    return decorator

# Create singleton instance
cache_manager = CacheManager() 