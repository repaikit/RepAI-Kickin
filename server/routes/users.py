from fastapi import APIRouter, HTTPException, Request, Depends, Body
from typing import Optional, List
from models.user import User, UserCreate, UserUpdate, TokenResponse, GoogleAuthRequest
from database.database import get_users_collection, get_skills_collection, get_database
from datetime import datetime
import uuid
import random
from pydantic import BaseModel, EmailStr
from utils.logger import api_logger
from utils.jwt import create_access_token
from utils.password import get_password_hash, verify_password
from bson import ObjectId
from utils.cache_manager import cache_response
from utils.time_utils import get_vietnam_time, to_vietnam_time
from utils.level_utils import get_total_point_for_level, get_basic_level, get_legend_level, get_vip_level, update_user_levels
from utils.email_utils import send_verification_email
from utils.wallet_generator import generate_evm_wallet
import traceback

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

class WalletInfoRequest(BaseModel):
    wallet_type: str
    password: str

@router.post("/users/decode-wallet-info")
async def decode_wallet_info(
    request: Request,
    wallet_info: WalletInfoRequest
):
    """Decode encrypted wallet information using user's password"""
    try:
        # Get current user from request state
        user = getattr(request.state, "user", None)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        # Verify password
        if not verify_password(wallet_info.password, user.get("password")):
            raise HTTPException(status_code=401, detail="Invalid password")
            
        # Get encrypted info based on wallet type
        encrypted_info = None
        if wallet_info.wallet_type == "evm_private":
            encrypted_info = user.get("evm_private_key")
        elif wallet_info.wallet_type == "evm_mnemonic":
            encrypted_info = user.get("evm_mnemonic")
        elif wallet_info.wallet_type == "sol_private":
            encrypted_info = user.get("sol_private_key")
        elif wallet_info.wallet_type == "sol_mnemonic":
            encrypted_info = user.get("sol_mnemonic")
        elif wallet_info.wallet_type == "sui_private":
            encrypted_info = user.get("sui_private_key")
        elif wallet_info.wallet_type == "sui_mnemonic":
            encrypted_info = user.get("sui_mnemonic")
        else:
            raise HTTPException(status_code=400, detail="Invalid wallet type")
            
        if not encrypted_info:
            raise HTTPException(status_code=404, detail="Wallet information not found")
            
        # Decode the information
        try:
            decoded_info = decrypt_str(encrypted_info)
            return {"decoded_info": decoded_info}
        except Exception as decrypt_error:
            api_logger.error(f"Error decrypting wallet info: {str(decrypt_error)}")
            raise HTTPException(status_code=500, detail="Failed to decrypt wallet information")
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in decode_wallet_info: {str(e)}")
        api_logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error")

class UpgradeGuestRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

@router.post("/upgrade")
async def upgrade_guest_to_user(
    request: Request,
    data: UpgradeGuestRequest
):  
    user = getattr(request.state, "user", None)
    if not user or user.get("user_type") != "guest":
        raise HTTPException(status_code=401, detail="Not authenticated as guest")
    users_collection = await get_users_collection()
    user_id = user.get("_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user data")
    # Check trùng email
    existing_email = await users_collection.find_one({"email": data.email, "_id": {"$ne": ObjectId(user_id)}})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email đã được sử dụng bởi tài khoản khác.")
    hashed_password = get_password_hash(data.password)
    email_verification_token = str(uuid.uuid4())
    update_data = {
        "user_type": "user", 
        "email": data.email,
        "password": hashed_password,
        "auth_provider": "email",
        "name": data.name,
        "updated_at": get_vietnam_time().isoformat(),
        "is_verified": False,
        "email_verification_token": email_verification_token
    }
    # Nếu guest chưa có ví thì tạo ví mới
    guest_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not guest_user.get("evm_address") or not guest_user.get("sol_address") or not guest_user.get("sui_address"):
        wallets = generate_wallets()
        update_data.update({
            "evm_mnemonic": wallets["mnemonic"],
            "evm_private_key": wallets["private_key"],
            "evm_address": wallets["public_address"],
            "sol_mnemonic": wallets["mnemonic"],
            "sol_private_key": wallets["private_key"],
            "sol_address": wallets["public_address"],
            "sui_mnemonic": wallets["mnemonic"],
            "sui_private_key": wallets["private_key"],
            "sui_address": wallets["public_address"]
        })
    await users_collection.update_one(
        {"_id": ObjectId(user_id)}, 
        {"$set": update_data}
    )
    send_verification_email(data.email, email_verification_token)
    updated_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    return {
        "user": User(**updated_user),
        "message": "Account upgraded successfully. Please check your email to verify your account.",
        "evm_address": updated_user.get("evm_address"),
        "sol_address": updated_user.get("sol_address"),
        "sui_address": updated_user.get("sui_address")
    }

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
        leaderboard_users = await db.users.find().sort("total_point", -1).limit(5).to_list(length=5)
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
async def get_leaderboard(page: int = 1, limit: int = 5, type: str = "basic"):
    try:
        users_collection = await get_users_collection()
        page = max(1, min(page, 100))
        limit = max(1, min(limit, 100))
        skip = (page - 1) * limit

        # Lọc theo loại user
        query = {"user_type": "user"}
        if type == "basic":
            query["is_pro"] = False
            query["is_vip"] = False
        elif type == "pro":
            query["is_pro"] = True
        elif type == "vip":
            query["is_vip"] = True

        users = await users_collection.find(query).sort("total_point", -1).skip(skip).limit(limit).to_list(length=None)
        if not users:
            return []
        for user in users:
            if isinstance(user.get("created_at"), datetime):
                user["created_at"] = user["created_at"].isoformat()
            if isinstance(user.get("updated_at"), datetime):
                user["updated_at"] = user["updated_at"].isoformat()
            if isinstance(user.get("last_activity"), datetime):
                user["last_activity"] = user["last_activity"].isoformat()
            if isinstance(user.get("last_login"), datetime):
                user["last_login"] = user["last_login"].isoformat()
            if isinstance(user.get("last_box_open"), datetime):
                user["last_box_open"] = user["last_box_open"].isoformat()
            if isinstance(user.get("last_claim_matches"), datetime):
                user["last_claim_matches"] = user["last_claim_matches"].isoformat()
        return [User(**u) for u in users]
    except Exception as e:
        api_logger.error(f"Error in leaderboard route: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch leaderboard: {str(e)}"
        )

# API xóa user
@router.delete("/me")
async def delete_user(session_id: str):
    users_collection = await get_users_collection()
    user = await users_collection.find_one({"session_id": session_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await users_collection.delete_one({"session_id": session_id})
    return {"message": "User deleted successfully"}

class RegularAuthRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = None

def generate_wallets():
    """
    Tạo ví cho người dùng mới.
    Hiện tại chỉ hỗ trợ EVM wallet.
    """
    wallet = generate_evm_wallet()
    return {
        "mnemonic": wallet["mnemonic"],
        "private_key": wallet["private_key"],
        "public_address": wallet["public_address"]
    }

@router.post("/auth/register")
async def register_user(data: RegularAuthRequest):
    """Đăng ký tài khoản mới với email và mật khẩu"""
    try:
        users_collection = await get_users_collection()
        skills_collection = await get_skills_collection()
        # Kiểm tra email đã tồn tại chưa
        existing_user = await users_collection.find_one({"email": data.email})
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Email already registered. Please login instead."
            )
        # Sinh token xác thực email
        email_verification_token = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        kicker_skill = await get_random_skill(skills_collection, "kicker")
        goalkeeper_skill = await get_random_skill(skills_collection, "goalkeeper")
        hashed_password = get_password_hash(data.password)
        now = get_vietnam_time().isoformat()
        avatar_seed = str(uuid.uuid4())
        avatar_url = f"https://api.dicebear.com/7.x/adventurer/svg?seed={avatar_seed}"
        # ===== GỌI HÀM TẠO VÍ =====
        wallets = generate_wallets()
        # ===== END TẠO VÍ =====
        new_user = UserCreate(
            user_type="user",
            session_id=session_id,
            avatar=avatar_url,
            email=data.email,
            password=hashed_password,
            auth_provider="email",
            name=data.name or "Player",
            kicker_skills=[kicker_skill],
            goalkeeper_skills=[goalkeeper_skill],
            created_at=now,
            updated_at=now,
            last_login=now,
            is_verified=False,
            email_verification_token=email_verification_token,
            # Thông tin ví
            evm_mnemonic=wallets["mnemonic"],
            evm_private_key=wallets["private_key"],
            evm_address=wallets["public_address"],
            sol_mnemonic=wallets["mnemonic"],
            sol_private_key=wallets["private_key"],
            sol_address=wallets["public_address"],
            sui_mnemonic=wallets["mnemonic"],
            sui_private_key=wallets["private_key"],
            sui_address=wallets["public_address"]
        ).dict(by_alias=True)
        try:
            result = await users_collection.insert_one(new_user)
            if not result.inserted_id:
                raise Exception("Failed to insert user into database")
            send_verification_email(data.email, email_verification_token)
            # Trả về cho FE chỉ địa chỉ ví
            return {
                "message": "Registration successful. Please check your email to verify your account.",
                "evm_address": wallets["public_address"],
                "sol_address": wallets["public_address"],
                "sui_address": wallets["public_address"]
            }
        except Exception as db_error:
            api_logger.error(f"Database error during registration: {str(db_error)}")
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(db_error)}"
            )
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in registration: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Registration failed: {str(e)}"
        )

# --- GOOGLE AUTH LOGIC ---
async def google_login_logic(auth_data: GoogleAuthRequest):
    users_collection = await get_users_collection()
    existing_user = await users_collection.find_one({"email": auth_data.email})
    if not existing_user:
        raise HTTPException(
            status_code=404,
            detail="User not found. Please register first."
        )
    update_data = {
        "last_login": get_vietnam_time().isoformat(),
        "updated_at": get_vietnam_time().isoformat(),
        "name": auth_data.name,
        "avatar": auth_data.picture
    }
    await users_collection.update_one(
        {"_id": existing_user["_id"]},
        {"$set": update_data}
    )
    access_token = create_access_token({"_id": str(existing_user["_id"])})
    return {"access_token": access_token}

async def google_register_logic(auth_data: GoogleAuthRequest):
    users_collection = await get_users_collection()
    skills_collection = await get_skills_collection()
    existing_user = await users_collection.find_one({"email": auth_data.email})
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered. Please login instead."
        )
    session_id = str(uuid.uuid4())
    kicker_skill = await get_random_skill(skills_collection, "kicker")
    goalkeeper_skill = await get_random_skill(skills_collection, "goalkeeper")
    # ===== GỌI HÀM TẠO VÍ =====
    wallets = generate_wallets()
    # ===== END TẠO VÍ =====
    new_user = UserCreate(
        user_type="user",
        session_id=session_id,
        email=auth_data.email,
        name=auth_data.name,
        avatar=auth_data.picture,
        auth_provider="google",
        kicker_skills=[kicker_skill],
        goalkeeper_skills=[goalkeeper_skill],
        created_at=get_vietnam_time().isoformat(),
        updated_at=get_vietnam_time().isoformat(),
        last_login=get_vietnam_time().isoformat(),
        # Thông tin ví
        evm_mnemonic=wallets["mnemonic"],
        evm_private_key=wallets["private_key"],
        evm_address=wallets["public_address"],
        sol_mnemonic=wallets["mnemonic"],
        sol_private_key=wallets["private_key"],
        sol_address=wallets["public_address"],
        sui_mnemonic=wallets["mnemonic"],
        sui_private_key=wallets["private_key"],
        sui_address=wallets["public_address"]
    ).dict(by_alias=True)
    result = await users_collection.insert_one(new_user)
    created_user = await users_collection.find_one({"_id": result.inserted_id})
    access_token = create_access_token({"_id": str(created_user["_id"])})
    return {"access_token": access_token,
            "evm_address": wallets["public_address"],
            "sol_address": wallets["public_address"],
            "sui_address": wallets["public_address"]
    }

@router.post("/auth/google/register")
async def register_with_google(data: GoogleAuthRequest):
    """Đăng ký tài khoản mới với Google"""
    try:
        return google_register_logic(data)
    except Exception as e:
        api_logger.error(f"Error in Google registration: {str(e)}")
        api_logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Registration failed: {str(e)}"
        )

@router.post("/auth/login")
async def login_user(data: RegularAuthRequest):
    """Đăng nhập với email và mật khẩu"""
    try:
        users_collection = await get_users_collection()
        
        # Tìm user theo email
        existing_user = await users_collection.find_one({"email": data.email})
        
        if not existing_user:
            raise HTTPException(
                status_code=404,
                detail="User not found. Please register first."
            )
            
        # Kiểm tra mật khẩu
        if not verify_password(data.password, existing_user.get("password", "")):
            raise HTTPException(
                status_code=401,
                detail="Invalid password"
            )
        
        # Cập nhật thông tin đăng nhập
        update_data = {
            "last_login": get_vietnam_time().isoformat(),
            "updated_at": get_vietnam_time().isoformat(),
        }
        
        await users_collection.update_one(
            {"_id": existing_user["_id"]},
            {"$set": update_data}
        )
        
        # Tạo access token
        access_token = create_access_token({"_id": str(existing_user["_id"])})
        
        return TokenResponse(
            access_token=access_token
        )
        
    except Exception as e:
        api_logger.error(f"Error in login: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Login failed: {str(e)}"
        )

@router.post("/auth/google/login")
async def login_with_google(data: GoogleAuthRequest):
    """Đăng nhập với Google"""
    try:
        return google_login_logic(data)
    except Exception as e:
        api_logger.error(f"Error in Google login: {str(e)}")
        api_logger.error(traceback.format_exc())
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

@router.get("/auth/verify-email")
async def verify_email(token: str):
    users_collection = await get_users_collection()
    user = await users_collection.find_one({"email_verification_token": token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    await users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_verified": True}, "$unset": {"email_verification_token": ""}}
    )
    return {"message": "Email verified successfully"}


