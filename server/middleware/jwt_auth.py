from fastapi import Request, HTTPException
from jose import jwt, JWTError
from database.database import get_users_collection
from starlette.middleware.base import BaseHTTPMiddleware
import os
from bson import ObjectId

SECRET_KEY = os.getenv("JWT_KEY", "your-very-secret-key")
ALGORITHM = "HS256"

class JWTAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Bỏ qua xác thực cho request OPTIONS (preflight CORS) và các route public
        if request.method == "OPTIONS" or request.url.path in [
            "/login", 
            "/api/auth/privy/login", 
            "/api/auth/privy/register",
            "/api/guest", 
            "/health", 
            "/metrics", 
            "/api/leaderboard",
            "/api/skills/",  # Add skills routes
            "/api/skills/type/kicker",
            "/api/skills/type/goalkeeper",
            "/api/leaderboard",
            "/api/users/{user_id}",
        ]:
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Not authorized to access this resource")

        token = auth_header.replace("Bearer ", "")
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            users_collection = await get_users_collection()
            # Convert _id to ObjectId for MongoDB query
            user = await users_collection.find_one({"_id": ObjectId(data["_id"])})
            if not user:
                raise HTTPException(status_code=401, detail="Not authorized to access this resource")
            request.state.user = user
            request.state.token = token
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")
        except Exception as e:
            raise HTTPException(status_code=401, detail=str(e))

        response = await call_next(request)
        return response 