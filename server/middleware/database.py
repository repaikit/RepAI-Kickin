from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from server.database.database import get_database

async def database_middleware(request: Request, call_next):
    """
    Middleware to ensure database connection is available for each request
    """
    request.state.db = await get_database()
    response = await call_next(request)
    return response 