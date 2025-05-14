from typing import Any, Optional, Dict
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from config.settings import settings
from utils.logger import api_logger
import asyncio
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import certifi
from functools import lru_cache
import nest_asyncio
import sys
from pathlib import Path

# Add the parent directory to Python path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

# Apply nest_asyncio to allow nested event loops
nest_asyncio.apply()

class Database:
    _instance: Optional['Database'] = None
    _client: Optional[AsyncIOMotorClient] = None
    _db: Optional[AsyncIOMotorDatabase] = None
    _lock: asyncio.Lock = asyncio.Lock()
    _connection_pool: Dict[asyncio.AbstractEventLoop, AsyncIOMotorClient] = {}

    @classmethod
    async def get_instance(cls) -> 'Database':
        if cls._instance is None:
            async with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    async def get_client(self) -> AsyncIOMotorClient:
        # Get current event loop
        loop = asyncio.get_running_loop()
        
        # Check if we have a client for this loop
        if loop not in self._connection_pool:
            async with self._lock:
                if loop not in self._connection_pool:
                    client = AsyncIOMotorClient(
                        settings.MONGODB_URL,
                        serverSelectionTimeoutMS=5000,
                        connectTimeoutMS=5000,
                        tls=True,
                        tlsCAFile=certifi.where(),
                        tlsAllowInvalidCertificates=False,
                        retryWrites=True,
                        w="majority",
                        maxPoolSize=50,
                        minPoolSize=10
                    )
                    # Test the connection
                    await client.admin.command('ping')
                    self._connection_pool[loop] = client
                    api_logger.info(f"Created new MongoDB connection for loop {id(loop)}")
        
        return self._connection_pool[loop]

    async def get_database(self) -> AsyncIOMotorDatabase:
        client = await self.get_client()
        return client[settings.DATABASE_NAME]

    async def close(self) -> None:
        loop = asyncio.get_running_loop()
        if loop in self._connection_pool:
            async with self._lock:
                if loop in self._connection_pool:
                    client = self._connection_pool.pop(loop)
                    client.close()
                    api_logger.info(f"Closed MongoDB connection for loop {id(loop)}")

async def get_database() -> AsyncIOMotorDatabase:
    """Get database instance with connection management for serverless."""
    try:
        db = await Database.get_instance()
        return await db.get_database()
    except Exception as e:
        api_logger.error(f"Database connection error: {str(e)}")
        raise

async def get_users_collection() -> AsyncIOMotorCollection:
    """Get users collection with connection management."""
    try:
        db = await get_database()
        return db.users
    except Exception as e:
        api_logger.error(f"Error getting users collection: {str(e)}")
        raise

async def get_matches_collection() -> AsyncIOMotorCollection:
    """Get matches collection with connection management."""
    try:
        db = await get_database()
        return db.matches
    except Exception as e:
        api_logger.error(f"Error getting matches collection: {str(e)}")
        raise

async def get_skills_collection() -> AsyncIOMotorCollection:
    """Get skills collection with connection management."""
    try:
        db = await get_database()
        return db.skills
    except Exception as e:
        api_logger.error(f"Error getting skills collection: {str(e)}")
        raise

async def init_db() -> None:
    """Initialize database connection and indexes."""
    try:
        db = await get_database()
        # Create indexes
        await create_indexes()
    except Exception as e:
        api_logger.error(f"Could not initialize database: {str(e)}")
        raise

async def create_indexes() -> None:
    """Create database indexes."""
    try:
        db = await get_database()

        # Drop existing indexes first
        await db.users.drop_indexes()
        await db.matches.drop_indexes()
        await db.skills.drop_indexes()
        
        # Users collection indexes
        await db.users.create_index("session_id", unique=True)
        await db.users.create_index(
            "email",
            unique=True,
            partialFilterExpression={"email": {"$type": "string"}}
        )
        await db.users.create_index(
            "privy_id",
            unique=True,
            partialFilterExpression={"privy_id": {"$type": "string"}}
        )
        await db.users.create_index(
            "wallet",
            unique=True,
            partialFilterExpression={"wallet": {"$type": "string"}}
        )
        
        # Matches collection indexes
        await db.matches.create_index("created_at")
        await db.matches.create_index([("players", 1)])
        
        # Skills collection indexes
        await db.skills.create_index("type")
        await db.skills.create_index("name", unique=True)
        
        api_logger.info("Created database indexes successfully")
    except Exception as e:
        api_logger.error(f"Error creating indexes: {str(e)}")
        raise

async def close_db() -> None:
    """Close database connection."""
    try:
        db = await Database.get_instance()
        await db.close()
    except Exception as e:
        api_logger.error(f"Error closing MongoDB connection: {str(e)}")
        raise 