from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from server.routers import users, waitingroom_ws, skills
from server.middleware.rate_limit import RateLimitMiddleware
from server.middleware.database import database_middleware
from server.utils.logger import setup_logger
from server.database.database import init_db
from server.config.settings import settings

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
app.middleware("http")(database_middleware)

# Setup logging
setup_logger()

# Initialize database
@app.on_event("startup")
async def startup_event():
    await init_db()

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
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    ) 