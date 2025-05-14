from typing import Any, Optional, Dict, List, TypeVar, Type, cast
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
import traceback

# Add the parent directory to Python path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

# Apply nest_asyncio to allow nested event loops
nest_asyncio.apply()

T = TypeVar('T', bound='Database')

class Database:
    _instance: Optional[T] = None
    _client: Optional[AsyncIOMotorClient] = None
    _db: Optional[AsyncIOMotorDatabase] = None
    _lock: asyncio.Lock = asyncio.Lock()
    _is_initialized: bool = False
    _connection_timeout: int = 5  # seconds
    _init_lock: asyncio.Lock = asyncio.Lock()

    @classmethod
    async def get_instance(cls: Type[T]) -> T:
        if cls._instance is None:
            try:
                async with asyncio.timeout(cls._connection_timeout):
                    async with cls._init_lock:
                        if cls._instance is None:
                            cls._instance = cls()
                            await cls._instance.initialize()
            except asyncio.TimeoutError:
                api_logger.error("Timeout while getting database instance")
                raise ConnectionError("Database initialization timeout")
        return cast(T, cls._instance)

    async def initialize(self) -> None:
        """Initialize the database connection."""
        if not self._is_initialized:
            try:
                async with asyncio.timeout(self._connection_timeout):
                    async with self._lock:
                        if not self._is_initialized:
                            try:
                                # Create client with shorter timeouts
                                client = AsyncIOMotorClient(
                                    settings.MONGODB_URL,
                                    serverSelectionTimeoutMS=self._connection_timeout * 1000,
                                    connectTimeoutMS=self._connection_timeout * 1000,
                                    tls=True,
                                    tlsCAFile=certifi.where(),
                                    tlsAllowInvalidCertificates=False,
                                    retryWrites=True,
                                    w="majority",
                                    maxPoolSize=50,
                                    minPoolSize=10,
                                    maxIdleTimeMS=30000,
                                    waitQueueTimeoutMS=5000
                                )
                                
                                # Test connection with timeout
                                try:
                                    await asyncio.wait_for(
                                        client.admin.command('ping'),
                                        timeout=self._connection_timeout
                                    )
                                    self._client = client
                                    self._db = client[settings.DATABASE_NAME]
                                    self._is_initialized = True
                                    api_logger.info("Database connection initialized successfully")
                                except asyncio.TimeoutError:
                                    client.close()
                                    raise ConnectionError("Database connection timeout")
                                except Exception as e:
                                    client.close()
                                    raise ConnectionError(f"Failed to connect to database: {str(e)}")
                                    
                            except Exception as e:
                                api_logger.error(f"Failed to initialize database connection: {str(e)}")
                                api_logger.error(f"Traceback: {traceback.format_exc()}")
                                self._is_initialized = False
                                raise
            except asyncio.TimeoutError:
                api_logger.error("Timeout while initializing database")
                raise ConnectionError("Database initialization timeout")

    async def get_client(self) -> AsyncIOMotorClient:
        """Get MongoDB client with connection management."""
        if not self._is_initialized:
            await self.initialize()
        if self._client is None:
            raise ConnectionError("Database client not initialized")
        return self._client

    async def get_database(self) -> AsyncIOMotorDatabase:
        """Get MongoDB database instance."""
        if not self._is_initialized:
            await self.initialize()
        if self._db is None:
            raise ConnectionError("Database not initialized")
        return self._db

    async def close(self) -> None:
        """Close database connection."""
        if self._client is not None:
            self._client.close()
            self._client = None
            self._db = None
            self._is_initialized = False
            api_logger.info("Database connection closed")

async def get_database() -> AsyncIOMotorDatabase:
    """Get database instance with connection management for serverless."""
    try:
        db = await Database.get_instance()
        return await db.get_database()
    except Exception as e:
        api_logger.error(f"Database connection error: {str(e)}")
        api_logger.error(f"Traceback: {traceback.format_exc()}")
        raise

async def get_users_collection() -> AsyncIOMotorCollection:
    """Get users collection with connection management."""
    try:
        db = await get_database()
        return db.users
    except Exception as e:
        api_logger.error(f"Error getting users collection: {str(e)}")
        api_logger.error(f"Traceback: {traceback.format_exc()}")
        raise

async def get_matches_collection() -> AsyncIOMotorCollection:
    """Get matches collection with connection management."""
    try:
        db = await get_database()
        return db.matches
    except Exception as e:
        api_logger.error(f"Error getting matches collection: {str(e)}")
        api_logger.error(f"Traceback: {traceback.format_exc()}")
        raise

async def get_skills_collection() -> AsyncIOMotorCollection:
    """Get skills collection with connection management."""
    try:
        db = await get_database()
        return db.skills
    except Exception as e:
        api_logger.error(f"Error getting skills collection: {str(e)}")
        api_logger.error(f"Traceback: {traceback.format_exc()}")
        raise

async def init_db() -> None:
    """Initialize database connection and indexes."""
    try:
        db = await Database.get_instance()
        await db.initialize()
        # Create indexes
        await create_indexes()
    except Exception as e:
        api_logger.error(f"Could not initialize database: {str(e)}")
        api_logger.error(f"Traceback: {traceback.format_exc()}")
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
        api_logger.error(f"Traceback: {traceback.format_exc()}")
        raise

async def close_db() -> None:
    """Close database connection."""
    try:
        db = await Database.get_instance()
        await db.close()
    except Exception as e:
        api_logger.error(f"Error closing MongoDB connection: {str(e)}")
        api_logger.error(f"Traceback: {traceback.format_exc()}")
        raise 