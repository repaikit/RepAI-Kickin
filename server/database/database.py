from motor.motor_asyncio import AsyncIOMotorClient
from config.settings import settings
import os
from utils.logger import api_logger
import asyncio

# Determine if running in Vercel environment
IS_VERCEL = os.getenv('VERCEL') is not None

# Configure MongoDB connection
MONGODB_URL = settings.MONGODB_URL
DATABASE_NAME = settings.DATABASE_NAME

class Database:
    _instance = None
    _lock = asyncio.Lock()
    _client = None
    _db = None

    @classmethod
    async def get_instance(cls):
        if cls._instance is None:
            async with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    async def get_database(self):
        if self._db is None:
            async with self._lock:
                if self._db is None:
                    self._client = AsyncIOMotorClient(
                        MONGODB_URL,
                        maxPoolSize=50,
                        minPoolSize=10,
                        maxIdleTimeMS=30000,
                        waitQueueTimeoutMS=2500,
                        retryWrites=True,
                        serverSelectionTimeoutMS=5000
                    )
                    self._db = self._client[DATABASE_NAME]
                    api_logger.info("Successfully connected to MongoDB")
        return self._db

    async def close(self):
        if self._client is not None:
            # self._client.close()
            self._client = None
            self._db = None
            api_logger.info("Database connection closed")

# Global database instance
_db_instance = None

async def get_database():
    """Get database instance."""
    global _db_instance
    if _db_instance is None:
        _db_instance = await Database.get_instance()
    return await _db_instance.get_database()

async def init_db():
    """Initialize database connection and create indexes"""
    try:
        db = await get_database()
        
        # Drop existing indexes first
        await db.users.drop_indexes()
        await db.matches.drop_indexes()
        await db.skills.drop_indexes()
        
        # Create indexes with partialFilterExpression
        await db.users.create_index(
            "email",
            unique=True,
            partialFilterExpression={"email": {"$type": "string"}}
        )
        await db.users.create_index(
            "username",
            unique=True,
            partialFilterExpression={"username": {"$type": "string"}}
        )
        await db.matches.create_index("status")
        await db.matches.create_index("created_at")
        await db.matches.create_index([("players", 1)])
        await db.skills.create_index("name", unique=True)
        
        api_logger.info("Database indexes created successfully")
    except Exception as e:
        api_logger.error(f"Failed to initialize database: {str(e)}")
        raise

async def close_db():
    """Close database connection"""
    global _db_instance
    if _db_instance is not None:
        await _db_instance.close()
        _db_instance = None

# Collection getter functions
async def get_users_collection():
    """Get users collection."""
    db = await get_database()
    return db.users

async def get_online_users_collection():
    """Get online users collection."""
    db = await get_database()
    return db.online_users

async def get_matches_collection():
    """Get matches collection."""
    db = await get_database()
    return db.matches

async def get_skills_collection():
    """Get skills collection."""
    db = await get_database()
    return db.skills 