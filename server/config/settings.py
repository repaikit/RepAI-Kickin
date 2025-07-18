import os
from pydantic_settings import BaseSettings
from typing import List
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings(BaseSettings):
    # Application settings
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # API settings
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "Kick'in API"
    
    # CORS settings - hardcoded values
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://kickin.olym3.com",
        "https://rep-ai-kickin.vercel.app",
        "https://kickin.repai.vn/",
        "https://kickin-wow.repai.vn"
    ]

    # Victory NFT Configuration
    AVALANCHE_FUJI_NFT_CONTRACT: str = os.getenv("AVALANCHE_FUJI_NFT_CONTRACT", "0x0200B2469eEF9713F7Ae8226D1BDee838B42676e")
    BASE_SEPOLIA_NFT_CONTRACT: str = os.getenv("BASE_SEPOLIA_NFT_CONTRACT", "0xe0aBf4b49eFBA23C5888cF19E8a8033e03893CEc")
    AVALANCHE_FUJI_RPC_URL: str = os.getenv("AVALANCHE_FUJI_RPC_URL", "https://api.avax-test.network/ext/bc/C/rpc")
    BASE_SEPOLIA_RPC_URL: str = os.getenv("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org")
    CCIP_PRIVATE_KEY: str = os.getenv("CCIP_PRIVATE_KEY", "")
    PRIVATE_KEY: str = os.getenv("PRIVATE_KEY", "")
    
    # Database settings
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb+srv://localhost:27017")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "repai_kickin")
    
    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    
    # JWT settings
    SECRET_KEY: str = os.getenv("JWT_KEY", "repaikickin")
    ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    
    # WebSocket settings
    WS_PING_INTERVAL: int = 20
    WS_PING_TIMEOUT: int = 20
    WS_CLOSE_TIMEOUT: int = 20
    
    # Cache settings
    CACHE_ENABLED: bool = True
    CACHE_MAX_SIZE: int = 1000
    CACHE_TTL: int = 300
    CACHE_EXCLUDED_PATHS: List[str] = [
        "/api/ws/waitingroom/{user_id}",
        "/api/me",
        "/api/matches/active"
    ]
    
    # Monitoring settings
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 8000
    
    # Logging settings
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    model_config = {
        "case_sensitive": True,
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }

# Create settings instance
settings = Settings() 