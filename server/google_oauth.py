import os
from urllib.parse import urlencode
from dotenv import load_dotenv
import httpx
import logging
from database.database import get_users_table
from utils.logger import api_logger
from utils.jwt import create_access_token
from datetime import datetime, timedelta

logger = api_logger
load_dotenv()

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

def get_google_auth_url():
    """Generate Google OAuth URL"""
    if not all([CLIENT_ID, CLIENT_SECRET, REDIRECT_URI]):
        missing = []
        if not CLIENT_ID:
            missing.append("GOOGLE_CLIENT_ID")
        if not CLIENT_SECRET:
            missing.append("GOOGLE_CLIENT_SECRET")
        if not REDIRECT_URI:
            missing.append("GOOGLE_REDIRECT_URI")
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent"
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

async def get_tokens(code: str):
    """Get access and refresh tokens from Google"""
    if not code:
        raise ValueError("Authorization code is required")
        
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": CLIENT_ID,
                    "client_secret": CLIENT_SECRET,
                    "redirect_uri": REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error(f"Error getting tokens: {str(e)}")
        raise

async def get_user_info(access_token: str):
    """Get user information from Google"""
    if not access_token:
        raise ValueError("Access token is required")
        
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://openidconnect.googleapis.com/v1/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error(f"Error getting user info: {str(e)}")
        raise

async def handle_google_auth(code: str):
    """Handle Google OAuth authentication flow"""
    try:
        # Get tokens from Google
        tokens = await get_tokens(code)
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")

        # Get user info from Google
        user_info = await get_user_info(access_token)
        email = user_info.get("email")
        name = user_info.get("name")
        picture = user_info.get("picture")
        google_id = user_info.get("sub")

        if not all([email, name, google_id]):
            raise ValueError("Missing required user information from Google")

        # Check if user exists in database
        users_table = await get_users_table()
        response = await users_table.select("*").eq("email", email).execute()
        existing_user = response.data[0] if response.data else None

        if existing_user:
            # Update existing user's Google info
            update_data = {
                "google_id": google_id,
                "name": name,
                "avatar": picture,
                "last_login": datetime.utcnow().isoformat()
            }
            await users_table.update(update_data).eq("email", email).execute()
            user_id = existing_user["id"]
        else:
            # Create new user
            new_user = {
                "email": email,
                "name": name,
                "avatar": picture,
                "google_id": google_id,
                "created_at": datetime.utcnow().isoformat(),
                "last_login": datetime.utcnow().isoformat(),
                "is_verified": True,  # Google accounts are pre-verified
                "remaining_matches": 5,
                "total_point": 0,
                "level": 1,
                "is_pro": False,
                "legend_level": 0,
                "vip_level": "NONE",
                "kicker_skills": [],
                "goalkeeper_skills": [],
                "available_skill_points": 0
            }
            response = await users_table.insert(new_user).execute()
            user_id = response.data[0]["id"]

        # Create JWT token
        token_data = {
            "sub": user_id,
            "email": email,
            "name": name,
            "exp": datetime.utcnow() + timedelta(days=7)
        }
        access_token = create_access_token(token_data)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": email,
                "name": name,
                "avatar": picture,
                "is_verified": True
            }
        }

    except Exception as e:
        logger.error(f"Error in Google auth flow: {str(e)}")
        raise
