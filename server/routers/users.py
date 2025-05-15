from fastapi import APIRouter, HTTPException, Request, Depends, Body
from typing import Optional, List
from models.user import User, UserCreate, UserUpdate
from database.database import get_users_collection, get_skills_collection
from datetime import datetime
import uuid
import random
from pydantic import BaseModel
from utils.logger import api_logger
from utils.jwt import create_access_token
from bson import ObjectId

router = APIRouter()

# Helper: random skill
async def get_random_skill(skills_collection, skill_type: str) -> str:
    skills = await skills_collection.find({"type": skill_type}).to_list(length=None)
    if not skills:
        raise HTTPException(status_code=500, detail=f"No {skill_type} skills found in database")
    return random.choice(skills)["name"]

@router.post("/guest")
async def create_guest_user(request: Request):
    """Tạo guest user với 5 lượt chơi và random 1 kỹ năng mỗi loại"""
    users_collection = await get_users_collection()
    skills_collection = await get_skills_collection()
    session_id = str(uuid.uuid4())
    kicker_skill = await get_random_skill(skills_collection, "kicker")
    goalkeeper_skill = await get_random_skill(skills_collection, "goalkeeper")
    avatar_seed = str(uuid.uuid4())
    avatar_url = f"https://api.dicebear.com/7.x/adventurer/svg?seed={avatar_seed}"
    guest_user = UserCreate(
        user_type="guest",
        session_id=session_id,
        remaining_matches=5,
        kicker_skills=[kicker_skill],
        goalkeeper_skills=[goalkeeper_skill],
        avatar=avatar_url,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    ).dict(by_alias=True)
    result = await users_collection.insert_one(guest_user)
    created_user = await users_collection.find_one({"_id": result.inserted_id})
    # Generate JWT for guest user
    token = create_access_token({"_id": str(created_user["_id"])})
    return {
        "user": User(**created_user),
        "access_token": token,
        "token_type": "bearer"
    }

class UpgradeGuestRequest(BaseModel):
    email: Optional[str] = None
    wallet: Optional[str] = None
    privy_id: Optional[str] = None
    name: Optional[str] = None

@router.post("/upgrade", response_model=User)
async def upgrade_guest_to_user(
    request: Request,
    data: UpgradeGuestRequest
):  
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    users_collection = await get_users_collection()
    user_id = user.get("_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user data")

    user = await users_collection.find_one({"_id": ObjectId(user_id), "user_type": "guest"})
    if not user:
        raise HTTPException(status_code=404, detail="Guest user not found")

    update_data = {
        "user_type": "user", 
        "updated_at": datetime.utcnow()
    }
    if data.email:
        update_data["email"] = data.email
    if data.wallet:
        update_data["wallet"] = data.wallet
    if data.privy_id:
        update_data["privy_id"] = data.privy_id
    if data.name:
        update_data["name"] = data.name

    await users_collection.update_one(
        {"_id": ObjectId(user_id)}, 
        {"$set": update_data}
    )
    updated_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    return User(**updated_user)

@router.get("/me")
async def get_current_user(request: Request):
    """Lấy thông tin user hiện tại từ JWT"""
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user["_id"] = str(user["_id"])
    return user

class PlayRequest(BaseModel):
    session_id: str
    mode: str
    win: bool

@router.post("/play", response_model=User)
async def play_and_update(data: PlayRequest):
    session_id = data.session_id
    mode = data.mode
    win = data.win
    users_collection = await get_users_collection()
    user = await users_collection.find_one({"session_id": session_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = {"updated_at": datetime.utcnow()}
    # Trừ lượt chơi
    if user.get("remaining_matches", 0) <= 0:
        raise HTTPException(status_code=400, detail="No remaining matches")
    update_data["remaining_matches"] = user["remaining_matches"] - 1
    # Cập nhật thống kê
    if mode == "kicker":
        update_data["total_kicked"] = user.get("total_kicked", 0) + 1
        if win:
            update_data["kicked_win"] = user.get("kicked_win", 0) + 1
    elif mode == "goalkeeper":
        update_data["total_keep"] = user.get("total_keep", 0) + 1
        if win:
            update_data["keep_win"] = user.get("keep_win", 0) + 1
    elif mode == "extra_skill":
        if not user.get("is_pro", False):
            raise HTTPException(status_code=403, detail="Only Pro users can use extra skill")
        update_data["total_extra_skill"] = user.get("total_extra_skill", 0) + 1
        if win:
            update_data["extra_skill_win"] = user.get("extra_skill_win", 0) + 1
    else:
        raise HTTPException(status_code=400, detail="Invalid mode")
    await users_collection.update_one({"session_id": session_id}, {"$set": update_data})
    updated_user = await users_collection.find_one({"session_id": session_id})
    return User(**updated_user)

# API lấy leaderboard
@router.get("/leaderboard", response_model=List[User])
async def get_leaderboard(limit: int = 10):
    users_collection = await get_users_collection()
    users = await users_collection.find({"user_type": "user"}).sort("kicked_win", -1).limit(limit).to_list(length=None)
    return [User(**u) for u in users]

# API xóa user
@router.delete("/me")
async def delete_user(session_id: str):
    users_collection = await get_users_collection()
    user = await users_collection.find_one({"session_id": session_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await users_collection.delete_one({"session_id": session_id})
    return {"message": "User deleted successfully"}

class PrivyAuthRequest(BaseModel):
    privy_id: str
    email: Optional[str] = None
    wallet: Optional[str] = None
    name: Optional[str] = None
    avatar: Optional[str] = None

@router.post("/auth/privy/register")
async def register_with_privy(data: PrivyAuthRequest):
    """Đăng ký tài khoản mới với Privy"""
    try:
        api_logger.info(f"Received Privy registration request for privy_id: {data.privy_id}")
        users_collection = await get_users_collection()
        skills_collection = await get_skills_collection()
        
        # Kiểm tra email đã tồn tại chưa
        if data.email:
            existing_user = await users_collection.find_one({"email": data.email})
            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail="Email already registered. Please login instead."
                )
        
        # Tạo user mới
        session_id = str(uuid.uuid4())
        kicker_skill = await get_random_skill(skills_collection, "kicker")
        goalkeeper_skill = await get_random_skill(skills_collection, "goalkeeper")
        
        new_user = UserCreate(
            user_type="user",
            session_id=session_id,
            privy_id=data.privy_id,
            email=data.email,
            wallet=data.wallet,
            name=data.name or "Player",
            avatar=data.avatar,
            kicker_skills=[kicker_skill],
            goalkeeper_skills=[goalkeeper_skill],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            last_login=datetime.utcnow()
        ).dict(by_alias=True)
        
        result = await users_collection.insert_one(new_user)
        created_user = await users_collection.find_one({"_id": result.inserted_id})
        api_logger.info(f"Created new user with id: {created_user['_id']}")
        
        token = create_access_token({"_id": str(created_user["_id"])})
        return {
            "access_token": token, 
            "token_type": "bearer",
            "user": {
                "id": str(created_user["_id"]),
                "email": created_user.get("email"),
                "name": created_user.get("name"),
                "type": created_user.get("user_type"),
                "avatar": created_user.get("avatar"),
                "remaining_matches": created_user.get("remaining_matches", 0),
                "wins": created_user.get("wins", 0),
                "losses": created_user.get("losses", 0)
            }
        }
        
    except Exception as e:
        api_logger.error(f"Error in Privy registration: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Registration failed: {str(e)}"
        )

@router.post("/auth/privy/login")
async def login_with_privy(data: PrivyAuthRequest):
    """Đăng nhập với Privy"""
    try:
        api_logger.info(f"Received Privy login request for privy_id: {data.privy_id}")
        users_collection = await get_users_collection()
        
        # Tìm user theo privy_id hoặc email
        existing_user = await users_collection.find_one({
            "$or": [
                {"privy_id": data.privy_id},
                {"email": data.email} if data.email else {},
                {"wallet": data.wallet} if data.wallet else {}
            ]
        })
        
        if not existing_user:
            raise HTTPException(
                status_code=404,
                detail="User not found. Please register first."
            )
            
        # Cập nhật thông tin đăng nhập
        update_data = {
            "last_login": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "privy_id": data.privy_id
        }
        
        # Chỉ cập nhật email nếu nó khớp với email hiện tại
        if data.email and data.email == existing_user.get("email"):
            update_data["email"] = data.email
            
        # Cập nhật wallet nếu có
        if data.wallet:
            update_data["wallet"] = data.wallet
            
        # Cập nhật name và avatar nếu có
        if data.name:
            update_data["name"] = data.name
        if data.avatar:
            update_data["avatar"] = data.avatar
            
        await users_collection.update_one(
            {"_id": existing_user["_id"]},
            {"$set": update_data}
        )
        updated_user = await users_collection.find_one({"_id": existing_user["_id"]})
        api_logger.info(f"Updated user information for user: {updated_user['_id']}")
        
        token = create_access_token({"_id": str(updated_user["_id"])})
        return {
            "access_token": token, 
            "token_type": "bearer",
            "user": {
                "id": str(updated_user["_id"]),
                "email": updated_user.get("email"),
                "name": updated_user.get("name"),
                "type": updated_user.get("user_type"),
                "avatar": updated_user.get("avatar"),
                "remaining_matches": updated_user.get("remaining_matches", 0),
                "wins": updated_user.get("wins", 0),
                "losses": updated_user.get("losses", 0)
            }
        }
        
    except Exception as e:
        api_logger.error(f"Error in Privy login: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Login failed: {str(e)}"
        )

@router.post("/auth/privy")
async def auth_with_privy(data: PrivyAuthRequest):
    """Đăng ký/đăng nhập bằng Privy"""
    try:
        api_logger.info(f"Received Privy auth request for privy_id: {data.privy_id}")
        users_collection = await get_users_collection()
        
        # Tìm user theo privy_id hoặc email
        existing_user = await users_collection.find_one({
            "$or": [
                {"privy_id": data.privy_id},
                {"email": data.email} if data.email else {},
                {"wallet": data.wallet} if data.wallet else {}
            ]
        })
        
        if existing_user:
            # Nếu user tồn tại -> đăng nhập
            return await login_with_privy(data)
        else:
            # Nếu user chưa tồn tại -> đăng ký
            return await register_with_privy(data)
            
    except Exception as e:
        api_logger.error(f"Error in Privy auth: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Authentication failed: {str(e)}"
        )

# Các API mới sẽ được thêm vào đây


