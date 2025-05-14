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
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None
    _users_collection: AsyncIOMotorCollection | None = None
    _matches_collection: AsyncIOMotorCollection | None = None
    _skills_collection: AsyncIOMotorCollection | None = None

db = Database()

@lru_cache()
def get_motor_client() -> AsyncIOMotorClient:
    """Create a new Motor client with caching."""
    return AsyncIOMotorClient(
        settings.MONGODB_URL,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        tls=True,
        tlsCAFile=certifi.where(),
        tlsAllowInvalidCertificates=False,
        retryWrites=True,
        w="majority"
    )

async def get_database() -> AsyncIOMotorDatabase:
    """Get database instance with connection management for serverless."""
    try:
        if db.db is None:
            client = get_motor_client()
            db.client = client
            db.db = client[settings.DATABASE_NAME]
            # Test the connection
            await db.client.admin.command('ping')
            api_logger.info("Connected to MongoDB successfully")
        return db.db
    except Exception as e:
        api_logger.error(f"Database connection error: {str(e)}")
        raise

async def get_users_collection() -> AsyncIOMotorCollection:
    """Get users collection with connection management."""
    try:
        if db._users_collection is None:
            if db.db is None:
                await get_database()
            db._users_collection = db.db.users
        return db._users_collection
    except Exception as e:
        api_logger.error(f"Error getting users collection: {str(e)}")
        raise

async def get_matches_collection() -> AsyncIOMotorCollection:
    """Get matches collection with connection management."""
    try:
        if db._matches_collection is None:
            if db.db is None:
                await get_database()
            db._matches_collection = db.db.matches
        return db._matches_collection
    except Exception as e:
        api_logger.error(f"Error getting matches collection: {str(e)}")
        raise

async def get_skills_collection() -> AsyncIOMotorCollection:
    """Get skills collection with connection management."""
    try:
        if db._skills_collection is None:
            if db.db is None:
                await get_database()
            db._skills_collection = db.db.skills
        return db._skills_collection
    except Exception as e:
        api_logger.error(f"Error getting skills collection: {str(e)}")
        raise

async def init_db() -> None:
    """Initialize database connection and indexes."""
    try:
        await get_database()
        
        # Initialize collections
        db._users_collection = db.db.users
        db._matches_collection = db.db.matches
        db._skills_collection = db.db.skills
        
        # Create indexes
        await create_indexes()
    except Exception as e:
        api_logger.error(f"Could not initialize database: {str(e)}")
        raise

async def create_indexes() -> None:
    """Create database indexes."""
    try:
        if db.db is None:
            raise RuntimeError("Database not initialized")

        # Drop existing indexes first
        await db.db.users.drop_indexes()
        await db.db.matches.drop_indexes()
        await db.db.skills.drop_indexes()
        
        # Users collection indexes
        await db.db.users.create_index("session_id", unique=True)
        await db.db.users.create_index(
            "email",
            unique=True,
            partialFilterExpression={"email": {"$type": "string"}}
        )
        await db.db.users.create_index(
            "privy_id",
            unique=True,
            partialFilterExpression={"privy_id": {"$type": "string"}}
        )
        await db.db.users.create_index(
            "wallet",
            unique=True,
            partialFilterExpression={"wallet": {"$type": "string"}}
        )
        
        # Matches collection indexes
        await db.db.matches.create_index("created_at")
        await db.db.matches.create_index([("players", 1)])
        
        # Skills collection indexes
        await db.db.skills.create_index("type")
        await db.db.skills.create_index("name", unique=True)
        
        api_logger.info("Created database indexes successfully")
    except Exception as e:
        api_logger.error(f"Error creating indexes: {str(e)}")
        raise

async def close_db() -> None:
    """Close database connection."""
    if db.client:
        try:
            db.client.close()
            api_logger.info("Closed MongoDB connection successfully")
        except Exception as e:
            api_logger.error(f"Error closing MongoDB connection: {str(e)}")
            raise 