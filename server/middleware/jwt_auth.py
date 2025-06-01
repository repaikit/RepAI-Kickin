from fastapi import Request, HTTPException
from jose import jwt, JWTError
from database.database import get_users_collection
from starlette.middleware.base import BaseHTTPMiddleware
import os
from bson import ObjectId

SECRET_KEY = os.getenv("JWT_KEY", "your-very-secret-key")
ALGORITHM = "HS256"

# Danh sách các API public - không cần xác thực
PUBLIC_ROUTES = [
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/google",
    "/api/auth/google/callback",
    "/api/auth/google/register",
    "/api/auth/google/login",
    "/api/guest", 
    "/health", 
    "/metrics", 
    "/api/leaderboard",
    "/api/skills/",
    "/api/skills/type/kicker",
    "/api/skills/type/goalkeeper",
    "/api/users/{user_id}",
    "/api/leaderboard/weekly",
    "/api/leaderboard/monthly",
    "/api/auth/verify-email",
    "/api/x/callback",
]

# Danh sách các API chỉ dành cho admin
ADMIN_ROUTES = [
    # User Management APIs
    "/api/admin/users",
    "/api/admin/users/",  # Cho các route có tham số
    "/api/admin/users/activate",
    "/api/admin/users/deactivate",
    "/api/admin/users/make-admin",
    "/api/admin/users/remove-admin",
    
    # Code Management APIs
    "/api/admin/codes",
    "/api/admin/codes/generate",
    "/api/admin/codes/",  # Cho các route có tham số
    
    # NFT Management APIs
    "/api/admin/nfts",
    "/api/admin/nfts/",  # Cho các route có tham số
    "/api/admin/nfts/activate",
    "/api/admin/nfts/deactivate",
    
    # NFT Collection Management APIs
    "/api/admin/nfts/collection",
    "/api/admin/nfts/collections",
    "/api/admin/nfts/collection/",  # Cho các route có tham số
]

class JWTAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Bỏ qua xác thực cho request OPTIONS (preflight CORS)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Kiểm tra nếu là public route
        if any(request.url.path.startswith(route.replace("{user_id}", "")) for route in PUBLIC_ROUTES):
            return await call_next(request)

        # Kiểm tra token cho các route còn lại
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

            # Kiểm tra quyền admin cho các route admin
            if any(request.url.path.startswith(route) for route in ADMIN_ROUTES):
                if user.get("role") != "admin":
                    raise HTTPException(status_code=403, detail="Admin privileges required")

            request.state.user = user
            request.state.token = token
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")
        except Exception as e:
            raise HTTPException(status_code=401, detail=str(e))

        response = await call_next(request)
        return response 