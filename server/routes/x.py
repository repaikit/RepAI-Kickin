from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse
import requests
from typing import Optional
import os
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId
from pydantic import BaseModel
import logging
import traceback
import base64
import hashlib
from datetime import datetime
from cryptography.fernet import Fernet
import secrets
from fastapi.security import OAuth2PasswordBearer
from database.database import get_users_collection
# Tải biến môi trường
load_dotenv()

# Setup logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter()

# Cấu hình X API
X_API_KEY = os.getenv("X_API_KEY")
X_API_SECRET = os.getenv("X_API_SECRET")
X_MAIN_ACCOUNT_ID = os.getenv("X_MAIN_ACCOUNT_ID")
X_REDIRECT_URI = os.getenv("X_REDIRECT_URI", "http://localhost:3000/x/callback")
X_SCOPES = "tweet.read users.read offline.access"

# Khóa mã hóa cho token
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode())
cipher = Fernet(ENCRYPTION_KEY)

# Giả lập xác thực JWT (thay bằng hệ thống xác thực của bạn)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")  # Thay "token" bằng endpoint đăng nhập của bạn

# Lưu tạm code_verifier và state theo user_id (bạn có thể thay bằng cache/session thực tế)
temp_pkce = {}

def generate_pkce():
    code_verifier = base64.urlsafe_b64encode(os.urandom(32)).decode("utf-8").rstrip("=")
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode("utf-8")).digest()
    ).decode("utf-8").rstrip("=")
    return code_verifier, code_challenge

@router.get("/x/connect")
async def connect_x(request: Request):
    user = getattr(request.state, "user", None)
    if not user or not user.get("_id"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    user_id = str(user["_id"])

    try:
        state = secrets.token_urlsafe(32)
        code_verifier, code_challenge = generate_pkce()
        temp_pkce[user_id] = {"code_verifier": code_verifier, "state": state}

        auth_url = (
            f"https://twitter.com/i/oauth2/authorize?response_type=code"
            f"&client_id={X_API_KEY}&redirect_uri={X_REDIRECT_URI}"
            f"&scope={X_SCOPES}&state={state}"
            f"&code_challenge={code_challenge}&code_challenge_method=S256"
        )
        return {"auth_url": auth_url, "state": state}
    except Exception as e:
        logger.error(f"Error in connect_x: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/x/callback")
async def x_callback(request: Request, code: str, state: str):
    user = getattr(request.state, "user", None)
    if not user or not user.get("_id"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    user_id = str(user["_id"])

    pkce_data = temp_pkce.get(user_id)
    if not pkce_data or pkce_data["state"] != state:
        raise HTTPException(status_code=400, detail="Invalid state or code_verifier")

    code_verifier = pkce_data["code_verifier"]

    try:
        token_url = "https://api.twitter.com/2/oauth2/token"
        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": X_REDIRECT_URI,
            "code_verifier": code_verifier,
        }
        token_headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {base64.b64encode(f'{X_API_KEY}:{X_API_SECRET}'.encode()).decode()}"
        }

        token_response = requests.post(token_url, data=token_data, headers=token_headers)
        if not token_response.ok:
            raise HTTPException(status_code=400, detail=f"Failed to get access token: {token_response.text}")

        token_data = token_response.json()
        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token")

        # Lấy thông tin user từ X
        user_url = "https://api.twitter.com/2/users/me?user.fields=id,username"
        user_headers = {"Authorization": f"Bearer {access_token}"}
        user_response = requests.get(user_url, headers=user_headers)
        if not user_response.ok:
            raise HTTPException(status_code=400, detail=f"Failed to get user info: {user_response.text}")

        user_data = user_response.json()
        x_user_id = user_data["data"]["id"]
        x_username = user_data["data"]["username"]

        # Cập nhật thông tin X vào user (async)
        users_collection = await get_users_collection()
        await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "x_connected": True,
                "x_id": x_user_id,
                "x_username": x_username,
                "x_access_token": access_token,
                "x_access_secret": refresh_token,
                "x_connected_at": datetime.utcnow().isoformat()
            }}
        )

        # Xóa tạm pkce
        del temp_pkce[user_id]

        return RedirectResponse(url=f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/profile?x=connected")
    except Exception as e:
        logger.error(f"Error in x_callback: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/x/status/{user_id}")
async def check_x_status(request: Request, user_id: str):
    try:
        user = getattr(request.state, "user", None)
        if not user or str(user["_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        users_collection = await get_users_collection()
        user_db = await users_collection.find_one({"_id": ObjectId(user_id)})
        if not user_db or not user_db.get("x_connected"):
            return {
                "is_connected": False,
                "username": None,
                "is_following": False
            }

        access_token = user_db.get("x_access_token")
        # Nếu bạn có mã hóa access_token thì giải mã ở đây, nếu không thì bỏ dòng dưới
        # access_token = cipher.decrypt(access_token.encode()).decode()

        # Kiểm tra follow status
        response = requests.get(
            f"https://api.twitter.com/2/users/{user_db['x_id']}/following?target_user_id={X_MAIN_ACCOUNT_ID}",
            headers={"Authorization": f"Bearer {access_token}"}
        )

        is_following = response.ok and len(response.json().get("data", [])) > 0

        return {
            "is_connected": True,
            "username": user_db.get("x_username"),
            "is_following": is_following
        }
    except Exception as e:
        logger.error(f"Error in check_x_status: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))