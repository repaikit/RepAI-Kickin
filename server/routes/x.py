import requests
import base64
import urllib.parse
from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
import os
from dotenv import load_dotenv
from typing import Optional, Dict, Any
from pydantic import BaseModel
from models.user import User
from database.database import get_users_table
from datetime import datetime, timedelta
from utils.logger import api_logger
import hashlib
import secrets
import json
import traceback
import sys

# Load environment variables
load_dotenv()

router = APIRouter()

# Twitter OAuth 2.0 Configuration
CLIENT_ID = os.getenv('X_CLIENT_ID')
CLIENT_SECRET = os.getenv('X_CLIENT_SECRET')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:5000')
CALLBACK_URL = f"{BACKEND_URL}/api/x/callback"
SCOPE = 'tweet.read users.read offline.access'

# OAuth 2.0 URLs
AUTH_URL = 'https://twitter.com/i/oauth2/authorize'
TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'
USER_INFO_URL = 'https://api.twitter.com/2/users/me'

class XStatusResponse(BaseModel):
    is_connected: bool
    username: Optional[str] = None
    error: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str]
    expires_in: int
    token_type: str
    scope: str

def generate_code_verifier() -> str:
    """
    Generate a code verifier for PKCE.
    Returns a URL-safe random string of length 32.
    """
    return secrets.token_urlsafe(32)

def generate_code_challenge(code_verifier: str) -> str:
    """
    Generate a code challenge from the verifier using SHA-256.
    Returns a base64url-encoded string without padding.
    """
    sha256_hash = hashlib.sha256(code_verifier.encode('utf-8')).digest()
    code_challenge = base64.urlsafe_b64encode(sha256_hash).decode('utf-8').rstrip('=')
    return code_challenge

async def get_current_user(request: Request) -> User:
    """
    Get current user from request state.
    Raises HTTPException if user not found or invalid.
    """
    try:
        user = request.state.user
        if not user:
            raise HTTPException(status_code=401, detail="User not found in request state")
        return User(**user)
    except Exception as e:
        api_logger.error(f"Error in get_current_user: {str(e)}")
        raise HTTPException(status_code=401, detail=str(e))

async def save_tokens_to_db(user_id: str, token_data: Dict[str, Any]) -> bool:
    """
    Save OAuth tokens to database.
    Returns True if successful, False otherwise.
    """
    try:
        users_table = await get_users_table()
        update_data = {
            "x_access_token": token_data['access_token'],
            "x_refresh_token": token_data.get('refresh_token'),
            "x_token_expires_at": int((datetime.now() + timedelta(seconds=token_data.get('expires_in', 7200))).timestamp()),
            "x_connected": True,
            "x_connected_at": datetime.now().isoformat(),
            "x_auth_state": None,
            "x_code_verifier": None
        }
        
        response = await users_table.update(update_data).eq('id', user_id).execute()
        return bool(response.data)
    except Exception as e:
        api_logger.error(f"Error saving tokens to database: {str(e)}")
        return False

@router.get('/status', response_model=XStatusResponse)
async def get_x_status(request: Request):
    """
    Check X connection status for current user.
    Returns connection status and username if connected.
    """
    try:
        current_user = await get_current_user(request)
        
        if not current_user.x_access_token:
            return XStatusResponse(is_connected=False)
        
        # Verify token by getting user info
        headers = {
            'Authorization': f'Bearer {current_user.x_access_token}'
        }
        
        response = requests.get(USER_INFO_URL, headers=headers)
        if response.status_code != 200:
            return XStatusResponse(is_connected=False)
        
        data = response.json()
        return XStatusResponse(
            is_connected=True,
            username=data.get('data', {}).get('username')
        )
    except Exception as e:
        api_logger.error(f"Error checking X status: {str(e)}")
        return XStatusResponse(is_connected=False, error=str(e))

@router.get('/connect')
async def connect_x(request: Request):
    """
    Start X OAuth flow.
    Generates PKCE values and returns authorization URL.
    """
    try:
        current_user = await get_current_user(request)
        
        # Generate state and PKCE values
        state = secrets.token_urlsafe(16)
        code_verifier = generate_code_verifier()
        code_challenge = generate_code_challenge(code_verifier)
        
        # Store state and code verifier
        users_table = await get_users_table()
        update_data = {
            "x_auth_state": state,
            "x_code_verifier": code_verifier
        }
        
        response = await users_table.update(update_data).eq('id', current_user.id).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to store authentication state")
        
        # Build authorization URL
        params = {
            'response_type': 'code',
            'client_id': CLIENT_ID,
            'redirect_uri': CALLBACK_URL,
            'scope': SCOPE,
            'state': state,
            'code_challenge': code_challenge,
            'code_challenge_method': 'S256'
        }
        
        auth_url = f"{AUTH_URL}?{urllib.parse.urlencode(params)}"
        api_logger.info(f"Generated auth URL for user {current_user.id}")
        
        return JSONResponse(content={"auth_url": auth_url})
    except Exception as e:
        api_logger.error(f"Error in connect_x: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate X connection: {str(e)}")

@router.get('/callback')
async def x_callback(code: str, state: str):
    """
    Handle X OAuth callback.
    Exchanges authorization code for access token and saves tokens.
    """
    try:
        api_logger.info(f"Received callback with state: {state}")
        
        # Get user from state
        users_table = await get_users_table()
        response = await users_table.select('*').eq('x_auth_state', state).execute()
        if not response.data:
            api_logger.error(f"No user found for state: {state}")
            return RedirectResponse(
                url=f"{FRONTEND_URL}/profile?x_error=Invalid state",
                status_code=303
            )
        
        user = response.data[0]
        api_logger.info(f"Found user: {user['id']}")
        
        # Get code verifier
        if 'x_code_verifier' not in user:
            api_logger.error(f"No code verifier found for user: {user['id']}")
            return RedirectResponse(
                url=f"{FRONTEND_URL}/profile?x_error=Code verifier not found",
                status_code=303
            )
        
        code_verifier = user['x_code_verifier']
        api_logger.info("Found code verifier")
        
        # Exchange code for token
        auth_string = f"{CLIENT_ID}:{CLIENT_SECRET}"
        auth_bytes = auth_string.encode('ascii')
        base64_auth = base64.b64encode(auth_bytes).decode('ascii')
        
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': f'Basic {base64_auth}'
        }
        
        data = {
            'code': code,
            'grant_type': 'authorization_code',
            'client_id': CLIENT_ID,
            'redirect_uri': CALLBACK_URL,
            'code_verifier': code_verifier
        }

        try:
            response = requests.post(TOKEN_URL, headers=headers, data=data)
            api_logger.info(f"Token exchange response status: {response.status_code}")
            api_logger.info(f"Token exchange response: {response.text}")
            
            if response.status_code != 200:
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/profile?x_error=Token exchange failed",
                    status_code=303
                )
            
            token_data = response.json()
            
            # Save tokens to database
            if not await save_tokens_to_db(user['id'], token_data):
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/profile?x_error=Failed to save tokens",
                    status_code=303
                )
            
            return RedirectResponse(
                url=f"{FRONTEND_URL}/profile?x_success=true",
                status_code=303
            )
            
        except Exception as e:
            api_logger.error(f"Error exchanging code for token: {str(e)}")
            return RedirectResponse(
                url=f"{FRONTEND_URL}/profile?x_error=Token exchange failed",
                status_code=303
            )
            
    except Exception as e:
        api_logger.error(f"Error in x_callback: {str(e)}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/profile?x_error=Callback failed",
            status_code=303
        )

@router.post('/refresh')
async def refresh_token(request: Request):
    """
    Refresh X access token using refresh token.
    """
    try:
        current_user = await get_current_user(request)
        
        if not current_user.x_refresh_token:
            raise HTTPException(status_code=400, detail="No refresh token available")
        
        # Exchange refresh token for new access token
        auth_string = f"{CLIENT_ID}:{CLIENT_SECRET}"
        auth_bytes = auth_string.encode('ascii')
        base64_auth = base64.b64encode(auth_bytes).decode('ascii')
        
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': f'Basic {base64_auth}'
        }
        
        data = {
            'grant_type': 'refresh_token',
            'refresh_token': current_user.x_refresh_token
        }
        
        response = requests.post(TOKEN_URL, headers=headers, data=data)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to refresh token")
        
        token_data = response.json()
        
        # Save new tokens
        if not await save_tokens_to_db(current_user.id, token_data):
            raise HTTPException(status_code=500, detail="Failed to save new tokens")
        
        return {"success": True}
        
    except Exception as e:
        api_logger.error(f"Error refreshing token: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/disconnect')
async def disconnect_x(request: Request):
    """
    Disconnect X account from user profile.
    """
    try:
        current_user = await get_current_user(request)
        
        users_table = await get_users_table()
        update_data = {
            "x_access_token": None,
            "x_refresh_token": None,
            "x_token_expires_at": None,
            "x_connected": False,
            "x_connected_at": None
        }
        
        response = await users_table.update(update_data).eq('id', current_user.id).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to disconnect X account")
        
        return {"success": True}
        
    except Exception as e:
        api_logger.error(f"Error disconnecting X account: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
