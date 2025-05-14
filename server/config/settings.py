import os
import logging
from typing import List
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Kick'in API"
    
    # Server Settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # Logging Settings
    LOG_LEVEL: int = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper())
    
    # CORS Settings
    CORS_ORIGINS: List[str] = [
        origin.strip() 
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    ]
    
    # Database Settings
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb+srv://repaikickin:repaikickin@repai-kickin.cubmquz.mongodb.net/")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "repai_kickin")
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    
    # JWT Settings
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

settings = Settings() 