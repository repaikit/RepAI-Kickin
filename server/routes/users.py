from fastapi import APIRouter, HTTPException, Request, Depends, Body
from typing import Optional, List
from models.user import User, UserCreate, UserUpdate
from database.database import get_users_collection, get_skills_collection, get_database
from datetime import datetime
import uuid
import random
from pydantic import BaseModel
from utils.logger import api_logger
from utils.jwt import create_access_token
from bson import ObjectId
from utils.cache_manager import cache_response
from utils.time_utils import get_vietnam_time, to_vietnam_time
from utils.level_utils import get_total_point_for_level, get_basic_level, get_legend_level, get_vip_level, update_user_levels

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
    now = get_vietnam_time()
    guest_user = UserCreate(
        user_type="guest",
        session_id=session_id,
        remaining_matches=5,
        kicker_skills=[kicker_skill],
        goalkeeper_skills=[goalkeeper_skill],
        avatar=avatar_url,
        created_at=now.isoformat(),
        updated_at=now.isoformat(),
        last_activity=now.isoformat(),
        total_point=0,
        bonus_point=0.0,
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

    # Check trùng email
    if data.email:
        existing_email = await users_collection.find_one({"email": data.email, "_id": {"$ne": ObjectId(user_id)}})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email đã được sử dụng bởi tài khoản khác.")
    # Check trùng wallet
    if data.wallet:
        existing_wallet = await users_collection.find_one({"wallet": data.wallet, "_id": {"$ne": ObjectId(user_id)}})
        if existing_wallet:
            raise HTTPException(status_code=400, detail="Wallet đã được sử dụng bởi tài khoản khác.")

    update_data = {
        "user_type": "user", 
        "updated_at": get_vietnam_time().isoformat()
    }
    if data.email:
        update_data["email"] = data.email
    if data.wallet:
        update_data["wallet"] = data.wallet
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
    # TÍNH LẠI total_point_for_level và can_level_up
    total_point_for_level = get_total_point_for_level(user)
    new_level = get_basic_level(total_point_for_level)
    can_level_up = new_level > user.get("level", 1)
    user["total_point_for_level"] = total_point_for_level
    user["can_level_up"] = can_level_up
    return user

@router.patch("/me", response_model=User)
async def update_current_user(request: Request, user_update: UserUpdate):
    """Cập nhật thông tin user hiện tại"""
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    users_collection = await get_users_collection()
    user_id = user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user data in token")

    # Lấy dữ liệu cập nhật từ request body, bỏ qua các giá trị None
    update_data = user_update.model_dump(exclude_unset=True)

    restricted_fields = [
        "user_type", "session_id", "created_at", "last_login", 
        "last_activity", "is_pro", "is_vip", "total_kicked", 
        "kicked_win", "total_keep", "keep_win", "total_point", 
        "bonus_point", "match_history", "vip_amount", "vip_year", 
        "vip_payment_method", "mystery_box_history", "last_box_open", 
        "last_claim_matches", "daily_tasks"
    ]
    
    for field in restricted_fields:
        if field in update_data:
            del update_data[field]

    update_data["updated_at"] = get_vietnam_time().isoformat()

    if len(update_data) == 1 and "updated_at" in update_data:
        updated_user = await users_collection.find_one({"_id": ObjectId(user_id)})
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found after update attempt")
        return User(**updated_user)

    result = await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    updated_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found after update")

    from ws_handlers.waiting_room import manager as waiting_room_manager
    if waiting_room_manager:
        user_broadcast_data = {
            "id": str(updated_user["_id"]),
            "name": updated_user.get("name", "Anonymous"),
            "avatar": updated_user.get("avatar", ""),
            "user_type": updated_user.get("user_type", "guest"),
        }
        await waiting_room_manager.broadcast({
            "type": "user_updated",
            "user": user_broadcast_data
        })

        # Broadcast leaderboard_update sau khi user đổi tên
        db = await get_database()
        leaderboard_users = await db.users.find().sort("total_point", -1).limit(10).to_list(length=10)
        leaderboard_data = [
            {
                "id": str(u["_id"]),
                "name": u.get("name", "Anonymous"),
                "avatar": u.get("avatar", ""),
                "level": u.get("level", 1),
                "total_kicked": u.get("total_kicked", 0),
                "kicked_win": u.get("kicked_win", 0),
                "total_keep": u.get("total_keep", 0),
                "keep_win": u.get("keep_win", 0),
                "total_extra_skill": u.get("total_extra_skill", 0),
                "extra_skill_win": u.get("extra_skill_win", 0),
                "total_point": u.get("total_point", 0),
                "bonus_point": u.get("bonus_point", 0.0),
                "is_pro": u.get("is_pro", False),
                "is_vip": u.get("is_vip", False),
            }
            for u in leaderboard_users
        ]
        await waiting_room_manager.broadcast({
            "type": "leaderboard_update",
            "leaderboard": leaderboard_data
        })

    return User(**updated_user)

class PlayRequest(BaseModel):
    session_id: str
    mode: str
    win: bool

# API lấy leaderboard
@router.get("/leaderboard", response_model=List[User])
async def get_leaderboard(page: int = 1, limit: int = 10):
    users_collection = await get_users_collection()
    # Giới hạn tối đa 100 trang
    page = max(1, min(page, 100))
    limit = max(1, min(limit, 100))
    skip = (page - 1) * limit
    users = await users_collection.find({"user_type": "user"}).sort("total_point", -1).skip(skip).limit(limit).to_list(length=None)
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
    email: Optional[str] = None
    wallet: Optional[str] = None
    name: Optional[str] = None
    avatar: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

@router.post("/auth/privy/register")
async def register_with_privy(data: PrivyAuthRequest):
    """Đăng ký tài khoản mới với Privy"""
    try:
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
            email=data.email,
            wallet=data.wallet,
            name=data.name or "Player",
            avatar=data.avatar,
            kicker_skills=[kicker_skill],
            goalkeeper_skills=[goalkeeper_skill],
            created_at=get_vietnam_time().isoformat(),
            updated_at=get_vietnam_time().isoformat(),
            last_login=get_vietnam_time().isoformat()
        ).dict(by_alias=True)
        
        result = await users_collection.insert_one(new_user)
        created_user = await users_collection.find_one({"_id": result.inserted_id})
        
        # Tạo access token
        access_token = create_access_token({"_id": str(created_user["_id"])})
        
        return TokenResponse(
            access_token=access_token
        )
        
    except Exception as e:
        api_logger.error(f"Error in Privy registration: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Registration failed: {str(e)}"
        )

@router.post("/auth/privy/login")
async def login_with_privy(data: PrivyAuthRequest):
    """Đăng nhập với Privy (chỉ kiểm tra email hoặc wallet)"""
    try:
        users_collection = await get_users_collection()
        
        # Tìm user theo email hoặc wallet
        query = {"$or": []}
        if data.email:
            query["$or"].append({"email": data.email})
        if data.wallet:
            query["$or"].append({"wallet": data.wallet})
        if not query["$or"]:
            raise HTTPException(status_code=400, detail="Email hoặc wallet là bắt buộc để đăng nhập.")
        
        existing_user = await users_collection.find_one(query)
        
        if not existing_user:
            raise HTTPException(
                status_code=404,
                detail="User not found. Please register first."
            )
            
        # Cập nhật thông tin đăng nhập
        update_data = {
            "last_login": get_vietnam_time().isoformat(),
            "updated_at": get_vietnam_time().isoformat(),
        }
        
        # Cập nhật email nếu có
        if data.email and data.email == existing_user.get("email"):
            update_data["email"] = data.email
        # Cập nhật wallet nếu có
        if data.wallet:
            update_data["wallet"] = data.wallet
        
        await users_collection.update_one(
            {"_id": existing_user["_id"]},
            {"$set": update_data}
        )
        updated_user = await users_collection.find_one({"_id": existing_user["_id"]})
        
        # Tạo access token
        access_token = create_access_token({"_id": str(updated_user["_id"])})
        
        return TokenResponse(
            access_token=access_token
        )
        
    except Exception as e:
        api_logger.error(f"Error in Privy login: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Login failed: {str(e)}"
        )

@router.post("/guest/refresh")
async def refresh_guest_user(request: Request):
    """
    Reset lại 5 lượt chơi, random lại kỹ năng và reset các trường thống kê cho guest.
    """
    users_collection = await get_users_collection()
    skills_collection = await get_skills_collection()
    user = getattr(request.state, "user", None)
    if not user or user.get("user_type") != "guest":
        raise HTTPException(status_code=401, detail="Not authenticated as guest")
    
    user_id = user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user id")

    # Random lại kỹ năng
    kicker_skill = await get_random_skill(skills_collection, "kicker")
    goalkeeper_skill = await get_random_skill(skills_collection, "goalkeeper")
    now = get_vietnam_time()

    # Reset các trường theo User model
    update_data = {
        "remaining_matches": 5,
        "kicker_skills": [kicker_skill],
        "goalkeeper_skills": [goalkeeper_skill],
        "updated_at": now.isoformat(),
        "last_activity": now.isoformat(),
        "match_history": [],
        "total_kicked": 0,
        "kicked_win": 0,
        "total_keep": 0,
        "keep_win": 0,
        "level": 1,
        "total_point": 0,
        "bonus_point": 0.0,
        "trend": "neutral",
        "is_pro": False,
        "is_vip": False,
        "legend_level": 0,
        "vip_level": "NONE",
        "vip_amount": 0.0,
        "vip_year": None,
        "vip_payment_method": "NONE",
        "basic_week_point": 0,
        "pro_week_point": 0,
        "vip_week_point": 0,
        "basic_week_history": [],
        "pro_week_history": [],
        "vip_week_history": [],
        "mystery_box_history": [],
        "last_box_open": None,
        "last_claim_matches": None,
        "daily_tasks": {}
    }
    await users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
    updated_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    return {
        "user": User(**updated_user)
    }

@router.get("/users/{user_id}", response_model=User)
@cache_response(ttl=300)  # Cache for 5 minutes
async def get_user_by_id(user_id: str):
    """
    Lấy thông tin user theo ID
    """
    try:
        users_collection = await get_users_collection()
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        return User(**user)
        
    except Exception as e:
        api_logger.error(f"Error getting user by ID {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/level-up")
async def level_up(request: Request):
    """Handle user level up request"""
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    users_collection = await get_users_collection()
    user_db = await users_collection.find_one({"_id": ObjectId(user["_id"])})
    if not user_db:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate new level
    total_point_for_level = get_total_point_for_level(user_db)
    new_level = get_basic_level(total_point_for_level)
    is_pro = new_level >= 100
    
    if is_pro:
        new_level = 100
        legend_level = get_legend_level(total_point_for_level)
    else:
        legend_level = 0
    
    vip_amount = user_db.get("vip_amount", 0)
    vip_level = get_vip_level(vip_amount)
    
    # Update user in database
    await users_collection.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {
            "level": new_level,
            "is_pro": is_pro,
            "legend_level": legend_level,
            "vip_level": vip_level
        }}
    )
    
    # Broadcast user update to waiting room
    from ws_handlers.waiting_room import manager as waiting_room_manager
    if waiting_room_manager:
        user_broadcast_data = {
            "id": str(user_db["_id"]),
            "name": user_db.get("name", "Anonymous"),
            "avatar": user_db.get("avatar", ""),
            "level": new_level,
            "is_pro": is_pro,
            "legend_level": legend_level,
            "vip_level": vip_level
        }
        await waiting_room_manager.broadcast({
            "type": "user_updated",
            "user": user_broadcast_data
        })
    
    return {
        "level": new_level,
        "is_pro": is_pro,
        "legend_level": legend_level,
        "vip_level": vip_level,
        "total_point_for_level": total_point_for_level
    }


