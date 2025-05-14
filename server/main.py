import sys
import os
from pathlib import Path

# Add the parent directory to Python path
ROOT_DIR = Path(__file__).resolve().parent
sys.path.append(str(ROOT_DIR))

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from routers import users, waitingroom_ws, skills
from middleware.rate_limit import RateLimitMiddleware
from middleware.database import database_middleware
from utils.logger import setup_logger
from database.database import Database, get_database
from config.settings import settings

# Initialize FastAPI app
app = FastAPI(
    title="Kick'in API",
    description="Backend API for Kick'in game",
    version="1.0.0"
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add rate limiting middleware
app.add_middleware(RateLimitMiddleware)

# Add database middleware
app.add_middleware(database_middleware)

# Setup logging
setup_logger()

# Database dependency
async def get_db():
    db = await get_database()
    try:
        yield db
    finally:
        # No need to close here as middleware handles it
        pass

# Initialize database
@app.on_event("startup")
async def startup_event():
    try:
        await Database.get_instance()
    except Exception as e:
        print(f"Error initializing database: {str(e)}")
        raise

# Include routers
app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(skills.router, prefix="/api", tags=["skills"])
app.include_router(waitingroom_ws.router, prefix="/api", tags=["websocket"])

# Add WebSocket route directly
app.websocket("/api/ws/waitingroom/{user_id}")(waitingroom_ws.websocket_endpoint)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="localhost",
        port=5000,
        reload=settings.DEBUG
    ) 