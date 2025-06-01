from motor.motor_asyncio import AsyncIOMotorClient
from config.settings import settings
import os
from utils.logger import api_logger
import asyncio
import certifi
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv

load_dotenv()

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
                        server_api=ServerApi('1'),
                        tls=True,
                        tlsCAFile=certifi.where(),
                        tlsAllowInvalidCertificates=False,
                        connectTimeoutMS=30000,
                        socketTimeoutMS=30000,
                        maxPoolSize=50,
                        minPoolSize=10,
                        maxIdleTimeMS=45000,
                        waitQueueTimeoutMS=10000
                    )
                    await self._client.admin.command('ping')
                    print("Successfully connected to MongoDB!")
                    self._db = self._client[DATABASE_NAME]
        return self._db

    async def close(self):
        if self._client is not None:
            # self._client.close()
            self._client = None
            self._db = None

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
        await db.vip_codes.drop_indexes()

        
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
        await db.vip_codes.create_index("code", unique=True)
        await db.vip_codes.create_index("expires_at")
        await db.vip_codes.create_index("is_used")


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

async def get_chat_messages_collection():
    db = await get_database()
    return db.chat_messages 

async def get_vip_codes_collection():
    """Get VIP codes collection."""
    db = await get_database()
    return db.vip_codes 

async def get_pro_codes_collection():
    """Get PRO codes collection"""
    db = await get_database()
    return db.pro_codes

async def get_nfts_collection():
    """Get NFTs collection"""
    db = await get_database()
    return db.nfts

async def setup_database():
    """Setup database collections and indexes"""
    try:
        # Import models
        from models.user import User
        from models.invite_codes.vip_codes import VIPInviteCode
        from models.nft import NFT

        # Setup collections
        users_collection = await get_users_collection()
        vip_codes_collection = await get_vip_codes_collection()
        pro_codes_collection = await get_pro_codes_collection()
        nfts_collection = await get_nfts_collection()

        # Setup indexes
        await User.setup_collection(users_collection)
        await VIPInviteCode.setup_collection(vip_codes_collection)
        await VIPInviteCode.setup_collection(pro_codes_collection)
        await NFT.setup_collection(nfts_collection)

    except Exception as e:
        api_logger.error(f"Error setting up database: {str(e)}")
        raise e 