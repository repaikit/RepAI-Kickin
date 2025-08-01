import sys
import os
from pathlib import Path

# Add the parent directory to Python path
ROOT_DIR = Path(__file__).resolve().parent
PARENT_DIR = ROOT_DIR.parent
sys.path.append(str(ROOT_DIR))
sys.path.append(str(PARENT_DIR))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from contextlib import asynccontextmanager

# Import routers using absolute imports
from routes import users, skills, ws_handlers, mystery_box, bot, chat, cache, leaderboard, GoogleAuthenticate, nft, x, invite_codes_vip, admin
from routes.victory_nft import router as victory_nft_router
from middleware.database import database_middleware, DatabaseMiddleware
from middleware.rate_limit import RateLimitMiddleware
from middleware.cache import InMemoryCacheMiddleware
from middleware.jwt_auth import JWTAuthMiddleware
from utils.logger import api_logger, setup_logger
from database.database import init_db, close_db, Database, get_database
from config.settings import settings
from routes.task_claim_matches import router as task_claim_matches_router
from routes.daily_tasks import router as daily_tasks_router
from tasks.scheduler import setup_scheduler
# Import additional goalkeeper routers
from routes.bot_goalkeeper_route import router as bot_goalkeeper_router
from routes.invite_codes_vip import setup_vip_codes

# Import VRF startup
from startup_vrf import startup_vrf, check_vrf_health
from routes.vrf_status import router as vrf_status_router

import time
import asyncio
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import prometheus_client

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

app = FastAPI()
async def startup_event():
    await setup_vip_codes()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        api_logger.info("Initializing database connection...")
        await init_db()
        api_logger.info("Database connection successful")
        
        # Initialize VRF system
        api_logger.info("Starting VRF system initialization...")
        vrf_instance = await startup_vrf()
        if vrf_instance:
            api_logger.info("VRF system initialized successfully")
        else:
            api_logger.warning("VRF system initialization failed, will use fallback")
        
        init_metrics()
        setup_scheduler()
        api_logger.info("Application startup completed")
    except Exception as e:
        api_logger.error(f"Failed to initialize: {str(e)}")
        raise
    yield
    # Shutdown
    try:
        api_logger.info("Closing database connection...")
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

# Add JWT auth middleware
app.add_middleware(JWTAuthMiddleware)

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
app.include_router(skills.router, prefix="/api", tags=["skills"])
app.include_router(mystery_box.router, prefix="/api", tags=["mystery_box"])
app.include_router(task_claim_matches_router, prefix="/api", tags=["task_claim_matches"])
app.include_router(daily_tasks_router, prefix="/api", tags=["daily_tasks"])
app.include_router(bot.router, prefix="/api", tags=["bot"])
app.include_router(ws_handlers.router, tags=["ws_handlers"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(cache.router, prefix="/api", tags=["cache"])
app.include_router(leaderboard.router, prefix="/api", tags=["leaderboard"])
app.include_router(GoogleAuthenticate.router, prefix="/api", tags=["GoogleAuthenticate"])
app.include_router(nft.router, prefix="/api", tags=["nft"])
# Include goalkeeper bot routes
app.include_router(bot_goalkeeper_router,prefix="/api",tags=["bot_goalkeeper"])
app.include_router(x.router, prefix="/api/x", tags=["x"])
app.include_router(invite_codes_vip.router, prefix="/api/vip", tags=["vip"])
# Include admin routes
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(victory_nft_router, prefix="/api", tags=["victory_nft"])

# Include VRF status routes
app.include_router(vrf_status_router, prefix="/api", tags=["vrf"])

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
    # Check VRF health
    vrf_health = await check_vrf_health()
    
    return {
        "status": "healthy",
        "version": "1.0.0",
        "environment": "production" if not settings.DEBUG else "development",
        "vrf_system": vrf_health
    }

@app.on_event("startup")
async def startup_event():
    await init_db()

@app.on_event("shutdown")
async def shutdown_event():
    await close_db()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0" if os.getenv("VERCEL") else "localhost",
        port=int(os.getenv("PORT", 5000)),
        reload=settings.DEBUG
    ) 