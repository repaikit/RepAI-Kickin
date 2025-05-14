from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from cachetools import TTLCache
import json
from typing import Optional, Callable, Set
import hashlib
from config.settings import settings
from utils.logger import api_logger

class InMemoryCacheMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        maxsize: int = 1000,  # Maximum number of items in cache
        ttl: int = 300,  # Time to live in seconds
        excluded_paths: Optional[Set[str]] = None
    ):
        super().__init__(app)
        self.cache = TTLCache(maxsize=maxsize, ttl=ttl)
        self.excluded_paths = excluded_paths or set()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip caching for excluded paths
        if request.url.path in self.excluded_paths:
            return await call_next(request)

        # Skip caching for non-GET requests
        if request.method != "GET":
            return await call_next(request)

        # Generate cache key
        cache_key = self._generate_cache_key(request)

        # Try to get from cache
        try:
            cached_response = self.cache.get(cache_key)
            if cached_response:
                return Response(
                    content=cached_response,
                    media_type="application/json",
                    headers={"X-Cache": "HIT"}
                )
        except Exception as e:
            api_logger.error(f"Cache error: {str(e)}")
            # Continue without cache if there's an error
            pass

        # Get fresh response
        response = await call_next(request)

        # Cache the response if it's successful
        if response.status_code == 200:
            try:
                # Get TTL from response headers or use default
                ttl = int(response.headers.get("Cache-Control", f"max-age={self.cache.ttl}").split("=")[1])
                
                # Store in cache
                self.cache[cache_key] = response.body
                response.headers["X-Cache"] = "MISS"
            except Exception as e:
                api_logger.error(f"Cache error: {str(e)}")
                # Continue without caching if there's an error
                pass

        return response

    def _generate_cache_key(self, request: Request) -> str:
        """Generate a unique cache key for the request."""
        # Combine path and query parameters
        key_parts = [request.url.path]
        
        # Add query parameters if they exist
        if request.query_params:
            # Sort query params to ensure consistent key generation
            sorted_params = sorted(request.query_params.items())
            key_parts.extend([f"{k}={v}" for k, v in sorted_params])
        
        # Add headers that might affect the response
        headers_to_include = ["accept-language", "authorization"]
        for header in headers_to_include:
            if header in request.headers:
                key_parts.append(f"{header}={request.headers[header]}")
        
        # Generate hash
        key_string = "|".join(key_parts)
        return f"cache:{hashlib.md5(key_string.encode()).hexdigest()}"

    def clear_cache(self):
        """Clear all cached items."""
        self.cache.clear() 