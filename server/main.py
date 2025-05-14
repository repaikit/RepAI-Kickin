import sys
import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from routers import users, matches, skills, waitingroom_ws
from middleware.database import database_middleware
from middleware.rate_limit import RateLimitMiddleware
from utils.logger import api_logger, setup_logger
from database.database import init_db, close_db, Database, get_database
import time
import asyncio

# Add the parent directory to Python path
ROOT_DIR = Path(__file__).resolve().parent
sys.path.append(str(ROOT_DIR))

from config.settings import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        await init_db()
        api_logger.info("Database initialized successfully")
    except Exception as e:
        api_logger.error(f"Failed to initialize database: {str(e)}")
        raise
    yield
    # Shutdown
    try:
        await close_db()
        api_logger.info("Database connection closed")
    except Exception as e:
        api_logger.error(f"Error closing database connection: {str(e)}")

# Initialize FastAPI app
app = FastAPI(
    title="Kick'in API",
    description="Backend API for Kick'in game",
    version="1.0.0",
    lifespan=lifespan
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

# Include routers
app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(matches.router, prefix="/api", tags=["matches"])
app.include_router(skills.router, prefix="/api", tags=["skills"])
app.include_router(waitingroom_ws.router, prefix="/api", tags=["waitingroom"])

# Add WebSocket route directly
app.websocket("/api/ws/waitingroom/{user_id}")(waitingroom_ws.websocket_endpoint)

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

@app.get("/")
async def root():
    return {"message": "Welcome to RepAI-Kickin API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="localhost",
        port=5000,
        reload=settings.DEBUG
    ) 