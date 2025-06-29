from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from config.settings import settings
from utils.logger import api_logger
import time
from collections import defaultdict
import asyncio

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.requests = defaultdict(list)
        self.cleanup_task = None

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for certain paths
        excluded_paths = [
            "/docs", 
            "/redoc", 
            "/openapi.json",
            "/metrics",
            "/health",
            "/api/ws",
            "/api/chat/history",
            "/api/skills/type/kicker",
            "/api/skills/type/goalkeeper",
            "/api/bot/skills",
            "/api/me"
        ]
        
        if request.url.path in excluded_paths or request.url.path.startswith("/api/ws"):
            return await call_next(request)

        # Get client IP
        client_ip = request.client.host
        
        # Clean old requests
        current_time = time.time()
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip]
            if current_time - req_time < 60
        ]

        # Check rate limit (increased to 200 requests per minute)
        rate_limit = 200  # Increased from 60
        if len(self.requests[client_ip]) >= rate_limit:
            api_logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again later."
            )

        # Add current request
        self.requests[client_ip].append(current_time)

        # Start cleanup task if not running
        if self.cleanup_task is None or self.cleanup_task.done():
            self.cleanup_task = asyncio.create_task(self.cleanup_old_requests())

        return await call_next(request)

    async def cleanup_old_requests(self):
        while True:
            await asyncio.sleep(60)  # Run every minute
            current_time = time.time()
            for ip in list(self.requests.keys()):
                self.requests[ip] = [
                    req_time for req_time in self.requests[ip]
                    if current_time - req_time < 60
                ]
                if not self.requests[ip]:
                    del self.requests[ip] 