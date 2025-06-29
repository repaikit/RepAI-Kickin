from jose import jwt, JWTError
from datetime import datetime, timedelta
import os
import secrets

SECRET_KEY = os.getenv("JWT_KEY", "repaikickin")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "180"))  # 3 giờ
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))  # 30 ngày

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Kiểm tra xem có phải là refresh token không
        if payload.get("type") == "refresh":
            return None
        return payload
    except JWTError:
        return None

def verify_refresh_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Kiểm tra xem có phải là refresh token không
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None

def generate_token_pair(user_id: str):
    """Tạo cả access token và refresh token"""
    access_token = create_access_token({"_id": user_id})
    refresh_token = create_refresh_token({"_id": user_id})
    return access_token, refresh_token 