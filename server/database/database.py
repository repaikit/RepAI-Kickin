from typing import Any
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from server.config.settings import settings
from server.utils.logger import api_logger

class Database:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None
    _users_collection: AsyncIOMotorCollection | None = None
    _matches_collection: AsyncIOMotorCollection | None = None
    _skills_collection: AsyncIOMotorCollection | None = None

db = Database()

async def get_database() -> AsyncIOMotorDatabase:
    if db.db is None:
        try:
            db.client = AsyncIOMotorClient(settings.MONGODB_URL)
            db.db = db.client[settings.DATABASE_NAME]
            api_logger.info("Connected to MongoDB")
        except Exception as e:
            api_logger.error(f"Failed to connect to MongoDB: {str(e)}")
            raise
    return db.db

async def get_users_collection() -> AsyncIOMotorCollection:
    if db._users_collection is None:
        if db.db is None:
            raise RuntimeError("Database not initialized")
        db._users_collection = db.db.users
    return db._users_collection

async def get_matches_collection() -> AsyncIOMotorCollection:
    if db._matches_collection is None:
        if db.db is None:
            raise RuntimeError("Database not initialized")
        db._matches_collection = db.db.matches
    return db._matches_collection

async def get_skills_collection() -> AsyncIOMotorCollection:
    if db._skills_collection is None:
        if db.db is None:
            raise RuntimeError("Database not initialized")
        db._skills_collection = db.db.skills
    return db._skills_collection

async def init_db() -> None:
    try:
        db.client = AsyncIOMotorClient(settings.MONGODB_URL)
        db.db = db.client[settings.DATABASE_NAME]
        
        # Initialize collections
        db._users_collection = db.db.users
        db._matches_collection = db.db.matches
        db._skills_collection = db.db.skills
        
        api_logger.info("Connected to MongoDB")
        
        # Create indexes
        await create_indexes()
    except Exception as e:
        api_logger.error(f"Could not connect to MongoDB: {e}")
        raise e

async def create_indexes() -> None:
    try:
        if db.db is None:
            raise RuntimeError("Database not initialized")

        # Drop existing indexes first
        await db.db.users.drop_indexes()
        await db.db.matches.drop_indexes()
        await db.db.skills.drop_indexes()
        
        # Users collection indexes
        await db.db.users.create_index("session_id", unique=True)
        # Only unique when email is not null
        await db.db.users.create_index(
            "email",
            unique=True,
            partialFilterExpression={"email": {"$type": "string"}}
        )
        # Only unique when privy_id is not null
        await db.db.users.create_index(
            "privy_id",
            unique=True,
            partialFilterExpression={"privy_id": {"$type": "string"}}
        )
        # Only unique when wallet is not null
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
        
        api_logger.info("Created database indexes")
    except Exception as e:
        api_logger.error(f"Error creating indexes: {e}")
        raise e

async def close_db() -> None:
    if db.client:
        db.client.close()
        api_logger.info("Closed MongoDB connection") 