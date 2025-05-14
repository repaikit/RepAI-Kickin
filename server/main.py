import sys
import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from contextlib import asynccontextmanager
from routers import users, matches, skills, waitingroom_ws
from middleware.database import database_middleware, DatabaseMiddleware
from middleware.rate_limit import RateLimitMiddleware
from middleware.cache import InMemoryCacheMiddleware
from utils.logger import api_logger, setup_logger
from database.database import init_db, close_db, Database, get_database
import time
import asyncio
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import prometheus_client

# Add the parent directory to Python path
ROOT_DIR = Path(__file__).resolve().parent
sys.path.append(str(ROOT_DIR))

from config.settings import settings

# Initialize metrics
def init_metrics():
    global REQUEST_COUNT, REQUEST_LATENCY
    REQUEST_COUNT = Counter(
        'http_requests_total',
        'Total number of HTTP requests',
        ['method', 'endpoint', 'status']
    )
    REQUEST_LATENCY = Counter(
        'http_request_duration_seconds',
        'HTTP request latency in seconds',
        ['method', 'endpoint']
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        await init_db()
        api_logger.info("Database initialized successfully")
        init_metrics()
        api_logger.info("Metrics initialized successfully")
    except Exception as e:
        api_logger.error(f"Failed to initialize: {str(e)}")
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
    title=settings.PROJECT_NAME,
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

# Add database middleware
app.add_middleware(DatabaseMiddleware)

# Add rate limiting middleware
app.add_middleware(RateLimitMiddleware)

# Add in-memory cache middleware
app.add_middleware(
    InMemoryCacheMiddleware,
    maxsize=settings.CACHE_MAX_SIZE,
    ttl=settings.CACHE_TTL,
    excluded_paths=set(settings.CACHE_EXCLUDED_PATHS)
)

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
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(matches.router, prefix=settings.API_V1_STR)
app.include_router(skills.router, prefix=settings.API_V1_STR)
app.include_router(waitingroom_ws.router, prefix=settings.API_V1_STR)

# Add WebSocket route directly
app.websocket("/api/ws/waitingroom/{user_id}")(waitingroom_ws.websocket_endpoint)

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    try:
        response = await call_next(request)
        status_code = response.status_code
    except Exception as e:
        api_logger.error(f"Error processing request: {str(e)}")
        status_code = 500
        response = JSONResponse(
            status_code=status_code,
            content={"detail": "Internal server error"}
        )
    
    try:
        # Record metrics
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status=status_code
        ).inc()
        
        REQUEST_LATENCY.labels(
            method=request.method,
            endpoint=request.url.path
        ).inc(time.time() - start_time)
    except Exception as e:
        api_logger.error(f"Error recording metrics: {str(e)}")
    
    return response

@app.get("/metrics")
async def metrics():
    try:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
    except Exception as e:
        api_logger.error(f"Error generating metrics: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Error generating metrics"}
        )

@app.get("/")
async def root():
    return {"message": "Welcome to RepAI-Kickin API"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "environment": "production" if not settings.DEBUG else "development"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0" if os.getenv("VERCEL") else "localhost",
        port=int(os.getenv("PORT", 5000)),
        reload=settings.DEBUG
    ) 