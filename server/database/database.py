from supabase import create_client, Client
from config.settings import settings
import os
from utils.logger import api_logger
import asyncio
from dotenv import load_dotenv

load_dotenv()

# Determine if running in Vercel environment
IS_VERCEL = os.getenv('VERCEL') is not None

# Configure Supabase connection
SUPABASE_URL = settings.SUPABASE_URL
SUPABASE_KEY = settings.SUPABASE_KEY

class Database:
    _instance = None
    _lock = asyncio.Lock()
    _client: Client = None

    @classmethod
    async def get_instance(cls):
        if cls._instance is None:
            async with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    async def get_client(self):
        if self._client is None:
            async with self._lock:
                if self._client is None:
                    self._client = create_client(SUPABASE_URL, SUPABASE_KEY)
                    print("Successfully connected to Supabase!")
        return self._client

    async def close(self):
        if self._client is not None:
            self._client = None

# Global database instance
_db_instance = None

async def get_database():
    """Get database instance."""
    global _db_instance
    if _db_instance is None:
        _db_instance = await Database.get_instance()
    return await _db_instance.get_client()

async def init_supabase():
    """Initialize database connection"""
    try:
        client = await get_database()
        # Test connection
        response = client.table('users').select('count').execute()
        print("Successfully connected to Supabase database!")
    except Exception as e:
        api_logger.error(f"Failed to initialize database: {str(e)}")
        raise

async def close_supabase():
    """Close database connection"""
    global _db_instance
    if _db_instance is not None:
        await _db_instance.close()
        _db_instance = None

# Table getter functions
async def get_users_table():
    """Get users table."""
    client = await get_database()
    return client.table('users')

async def get_online_users_table():
    """Get online users table."""
    client = await get_database()
    return client.table('online_users')

async def get_matches_table():
    """Get matches table."""
    client = await get_database()
    return client.table('matches')

async def get_skills_table():
    """Get skills table."""
    client = await get_database()
    return client.table('skills')

async def get_chat_messages_table():
    """Get chat messages table."""
    client = await get_database()
    return client.table('chat_messages')

async def get_vip_codes_table():
    """Get VIP codes table."""
    client = await get_database()
    return client.table('vip_codes')

async def get_pro_codes_table():
    """Get PRO codes table."""
    client = await get_database()
    return client.table('pro_codes')

async def get_nfts_table():
    """Get NFTs table."""
    client = await get_database()
    return client.table('nfts')

async def get_bots_table():
    """Get bots table."""
    client = await get_database()
    return client.table('bots')

async def get_leaderboard_weekly_table():
    """Get weekly leaderboard table."""
    client = await get_database()
    return client.table('leaderboard_weekly')

async def get_leaderboard_monthly_table():
    """Get monthly leaderboard table."""
    client = await get_database()
    return client.table('leaderboard_monthly')

async def setup_database():
    """Setup database tables"""
    try:
        # Import models
        from models.user import User
        from models.invite_codes.vip_codes import VIPInviteCode
        from models.nft import NFT

        # Setup tables
        users_table = await get_users_table()
        vip_codes_table = await get_vip_codes_table()
        pro_codes_table = await get_pro_codes_table()
        nfts_table = await get_nfts_table()
        bots_table = await get_bots_table()
        leaderboard_weekly_table = await get_leaderboard_weekly_table()
        leaderboard_monthly_table = await get_leaderboard_monthly_table()

        # Setup models
        await User.setup_table(users_table)
        await VIPInviteCode.setup_table(vip_codes_table)
        await VIPInviteCode.setup_table(pro_codes_table)
        await NFT.setup_table(nfts_table)

    except Exception as e:
        api_logger.error(f"Error setting up database: {str(e)}")
        raise e 