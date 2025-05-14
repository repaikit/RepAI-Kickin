from typing import Any
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from server.config.settings import settings
from server.utils.logger import api_logger
import asyncio
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import certifi
from functools import lru_cache
import nest_asyncio

# Apply nest_asyncio to allow nested event loops
nest_asyncio.apply()

class Database:
    _instance = None
    _client = None
    _db = None

    @classmethod
    async def get_instance(cls) -> 'Database':
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def get_client(self) -> AsyncIOMotorClient:
        if self._client is None:
            self._client = AsyncIOMotorClient(
                settings.MONGODB_URL,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
                tls=True,
                tlsCAFile=certifi.where(),
                tlsAllowInvalidCertificates=False,
                retryWrites=True,
                w="majority"
            )
            # Test the connection
            await self._client.admin.command('ping')
            api_logger.info("Connected to MongoDB successfully")
        return self._client

    async def get_database(self) -> AsyncIOMotorDatabase:
        if self._db is None:
            client = await self.get_client()
            self._db = client[settings.DATABASE_NAME]
        return self._db

    async def close(self):
        if self._client:
            self._client.close()
            self._client = None
            self._db = None
            api_logger.info("Closed MongoDB connection successfully")

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