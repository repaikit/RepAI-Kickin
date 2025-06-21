from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import StreamingResponse
import json
from typing import Dict, Any, Optional
import time
from utils.logger import api_logger

class InMemoryCacheMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, maxsize: int = 1000, ttl: int = 300, excluded_paths: set = None):
        super().__init__(app)
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.maxsize = maxsize
        self.ttl = ttl
        self.excluded_paths = excluded_paths or set()

    async def dispatch(self, request: Request, call_next):
        # Skip caching for excluded paths
        if request.url.path in self.excluded_paths:
            return await call_next(request)

        # Generate cache key
        cache_key = f"{request.method}:{request.url.path}:{request.query_params}"

        # Check cache
        if cache_key in self.cache:
            cached_data = self.cache[cache_key]
            if time.time() - cached_data['timestamp'] < self.ttl:
                return Response(
                    content=cached_data['content'],
                    media_type=cached_data['media_type'],
                    status_code=cached_data['status_code']
                )

        # Get response
        response = await call_next(request)

        # Only cache successful GET requests
        if request.method == "GET" and response.status_code == 200:
            try:
                # Handle StreamingResponse
                if isinstance(response, StreamingResponse):
                    # Skip caching for streaming responses
                    return response
                else:
                    content = response.body.decode()
                    media_type = response.media_type

                # Store in cache
                if len(self.cache) >= self.maxsize:
                    # Remove oldest entry
                    oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k]['timestamp'])
                    del self.cache[oldest_key]

                self.cache[cache_key] = {
                    'content': content,
                    'media_type': media_type,
                    'status_code': response.status_code,
                    'timestamp': time.time()
                }
            except Exception as e:
                api_logger.error(f"Cache error: {str(e)}")

        return response 