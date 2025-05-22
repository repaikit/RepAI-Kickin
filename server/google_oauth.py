import os
from urllib.parse import urlencode
from dotenv import load_dotenv
import httpx
import logging

logger = logging.getLogger(__name__)
load_dotenv()

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

def get_google_auth_url():
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
