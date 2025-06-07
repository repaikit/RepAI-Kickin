from fastapi import APIRouter, HTTPException, Request, Depends, Body
from typing import Optional, List
from models.user import User, UserCreate, UserUpdate, TokenResponse, GoogleAuthRequest
from database.database import get_users_table, get_skills_table
from datetime import datetime
import uuid
import random
from pydantic import BaseModel, EmailStr
from utils.logger import api_logger
from utils.jwt import create_access_token
from utils.password import get_password_hash, verify_password
from utils.cache_manager import cache_response
from utils.time_utils import get_vietnam_time, to_vietnam_time
from utils.level_utils import get_total_point_for_level, get_basic_level, get_legend_level, get_vip_level, update_user_levels
from utils.email_utils import send_verification_email
from utils.wallet_generator import generate_evm_wallet
from utils.content_filter import contains_sensitive_content, validate_username
from utils.weekly_utils import update_weekly_login, get_weekly_stats
import traceback
from utils.crypto_utils import decrypt_str
from fastapi import status
from sqlalchemy.orm import Session

router = APIRouter()

# Helper: random skill
async def get_random_skill(skills_table, skill_type: str) -> str:
    response = await skills_table.select("*").eq("type", skill_type).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail=f"No {skill_type} skills found in database")
    return random.choice(response.data)["name"]

@router.post("/guest")
async def create_guest_user(request: Request):
    """Tạo guest user với 5 lượt chơi và random 1 kỹ năng mỗi loại"""
    users_table = await get_users_table()
    skills_table = await get_skills_table()
    session_id = str(uuid.uuid4())
    kicker_skill = await get_random_skill(skills_table, "kicker")
    goalkeeper_skill = await get_random_skill(skills_table, "goalkeeper")
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
    
    response = await users_table.insert(guest_user).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create guest user")
        
    created_user = response.data[0]
    # Generate JWT for guest user
    token = create_access_token({"sub": created_user["id"]})
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
        
    users_table = await get_users_table()
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user data")
        
    # Check trùng email
    response = await users_table.select("*").eq("email", data.email).neq("id", user_id).execute()
    if response.data:
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
    response = await users_table.select("*").eq("id", user_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    guest_user = response.data[0]
    if not guest_user.get("evm_address") or not guest_user.get("sol_address") or not guest_user.get("sui_address"):
        wallets = generate_evm_wallet()
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
    
    # Cập nhật thông tin đăng nhập theo tuần
    user_data = update_weekly_login(guest_user)  # Chỉ ghi nhận đăng nhập, không cộng điểm
    update_data.update({
        "weekly_logins": user_data["weekly_logins"],
        "total_point": user_data["total_point"]
    })
    
    response = await users_table.update(update_data).eq("id", user_id).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to upgrade user")
        
    updated_user = response.data[0]
    send_verification_email(data.email, email_verification_token)
    
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

    users_table = await get_users_table()
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user data in token")

    # Lấy dữ liệu cập nhật từ request body, bỏ qua các giá trị None
    update_data = user_update.model_dump(exclude_unset=True)

    # Kiểm tra nội dung nhạy cảm cho các trường text
    text_fields = ["name", "bio", "location"]
    for field in text_fields:
        if field in update_data:
            is_sensitive, reason = contains_sensitive_content(update_data[field])
            if is_sensitive:
                raise HTTPException(
                    status_code=400,
                    detail=f"Update contains sensitive content in {field}: {reason}"
                )

    # Kiểm tra username riêng vì có quy tắc đặc biệt
    if "username" in update_data:
        is_valid, reason = validate_username(update_data["username"])
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid username: {reason}"
            )

    restricted_fields = [
        "user_type", "session_id", "created_at", "last_login", 
        "last_activity", "is_pro", "is_vip", "total_kicked", 
        "kicked_win", "total_keep", "keep_win", "total_point", 
        "bonus_point", "match_history", "vip_amount", "vip_year", 
        "vip_payment_method", "mystery_box_history", "last_box_open", 
        "last_claim_matches", "daily_tasks", "weekly_logins"
    ]
    
    for field in restricted_fields:
        if field in update_data:
            del update_data[field]
            
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
        
    # Add updated_at timestamp
    update_data["updated_at"] = get_vietnam_time().isoformat()
    
    # Update user
    response = await users_table.update(update_data).eq("id", user_id).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to update user")
        
    updated_user = response.data[0]
    return User(**updated_user)

class PlayRequest(BaseModel):
    session_id: str
    mode: str
    win: bool

@router.get("/leaderboard", response_model=List[User])
async def get_leaderboard(page: int = 1, limit: int = 5, type: str = "basic"):
    """Get leaderboard with pagination"""
    try:
        users_table = await get_users_table()
        offset = (page - 1) * limit
        
        # Build query based on type
        query = users_table.select("*").order("total_point", desc=True)
        
        if type == "pro":
            query = query.eq("is_pro", True)
        elif type == "vip":
            query = query.eq("is_vip", True)
            
        # Add pagination
        query = query.range(offset, offset + limit - 1)
        
        response = await query.execute()
        if not response.data:
            return []
            
        return [User(**user) for user in response.data]
        
    except Exception as e:
        api_logger.error(f"Error getting leaderboard: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get leaderboard")

@router.delete("/me")
async def delete_user(session_id: str):
    """Delete user account"""
    try:
        users_table = await get_users_table()
        response = await users_table.delete().eq("session_id", session_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        return {"message": "User deleted successfully"}
    except Exception as e:
        api_logger.error(f"Error deleting user: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete user")

class RegularAuthRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = None

def generate_wallets():
    """Generate wallet information for new users"""
    evm_wallet = generate_evm_wallet()
    return {
        "mnemonic": evm_wallet["mnemonic"],
        "private_key": evm_wallet["private_key"],
        "public_address": evm_wallet["address"]
    }

@router.post("/auth/register")
async def register_user(data: RegularAuthRequest):
    """Register new user with email and password"""
    try:
        users_table = await get_users_table()
        
        # Check if email already exists
        response = users_table.select("*").eq("email", data.email).execute()
        if response.data:
            raise HTTPException(status_code=400, detail="Email already registered")
            
        # Generate wallet information
        wallet = generate_evm_wallet()
        
        # Create user data
        now = get_vietnam_time()
        user_data = {
            "email": data.email,
            "password": get_password_hash(data.password),
            "name": data.name or data.email.split("@")[0],
            "user_type": "user",
            "auth_provider": "email",
            "is_verified": False,
            "email_verification_token": str(uuid.uuid4()),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "last_activity": now.isoformat(),
            "total_point": 0,
            "bonus_point": 0.0,
            "evm_mnemonic": wallet["mnemonic"],
            "evm_private_key": wallet["private_key"],
            "evm_address": wallet["public_address"],
            "sol_mnemonic": wallet["mnemonic"],
            "sol_private_key": wallet["private_key"],
            "sol_address": wallet["public_address"],
            "sui_mnemonic": wallet["mnemonic"],
            "sui_private_key": wallet["private_key"],
            "sui_address": wallet["public_address"],
            "kicker_skills": [],
            "goalkeeper_skills": [],
            "match_history": [],
            "week_history": [],
            "mystery_box_history": [],
            "daily_tasks": {},
            "weekly_logins": {}
        }
        
        # Insert user
        response = users_table.insert(user_data).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create user")
            
        created_user = response.data[0]
        
        # Send verification email
        send_verification_email(data.email, user_data["email_verification_token"])
        
        # Generate token
        token = create_access_token({"sub": created_user["id"]})
        
        return {
            "user": User(**created_user),
            "access_token": token,
            "token_type": "bearer",
            "message": "Registration successful. Please check your email to verify your account."
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in register_user: {str(e)}")
        api_logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error")

async def google_login_logic(auth_data: GoogleAuthRequest):
    """Handle Google login logic"""
    try:
        users_table = await get_users_table()
        
        # Find user by email
        response = await users_table.select("*").eq("email", auth_data.email).execute()
        if not response.data:
            return None
            
        user = response.data[0]
        
        # Update last login
        now = get_vietnam_time()
        await users_table.update({
            "last_login": now.isoformat(),
            "last_activity": now.isoformat()
        }).eq("id", user["id"]).execute()
        
        return user
        
    except Exception as e:
        api_logger.error(f"Error in google_login_logic: {str(e)}")
        return None

async def google_register_logic(auth_data: GoogleAuthRequest):
    """Handle Google registration logic"""
    try:
        users_table = await get_users_table()
        
        # Generate wallet information
        wallets = generate_evm_wallet()
        
        # Create user data
        now = get_vietnam_time()
        user_data = {
            "email": auth_data.email,
            "name": auth_data.name,
            "avatar": auth_data.picture,
            "user_type": "user",
            "auth_provider": "google",
            "is_verified": True,  # Google accounts are pre-verified
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "last_activity": now.isoformat(),
            "total_point": 0,
            "bonus_point": 0.0,
            "evm_mnemonic": wallets["mnemonic"],
            "evm_private_key": wallets["private_key"],
            "evm_address": wallets["public_address"],
            "sol_mnemonic": wallets["mnemonic"],
            "sol_private_key": wallets["private_key"],
            "sol_address": wallets["public_address"],
            "sui_mnemonic": wallets["mnemonic"],
            "sui_private_key": wallets["private_key"],
            "sui_address": wallets["public_address"]
        }
        
        # Insert user
        response = await users_table.insert(user_data).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create user")
            
        return response.data[0]
        
    except Exception as e:
        api_logger.error(f"Error in google_register_logic: {str(e)}")
        return None

@router.post("/auth/google/register")
async def register_with_google(data: GoogleAuthRequest):
    """Register new user with Google"""
    try:
        users_table = await get_users_table()
        
        # Check if email already exists
        response = await users_table.select("*").eq("email", data.email).execute()
        if response.data:
            raise HTTPException(status_code=400, detail="Email already registered")
            
        # Register user
        user = await google_register_logic(data)
        if not user:
            raise HTTPException(status_code=500, detail="Failed to register user")
            
        # Generate token
        token = create_access_token({"sub": user["id"]})
        
        return {
            "user": User(**user),
            "access_token": token,
            "token_type": "bearer"
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in register_with_google: {str(e)}")
        api_logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error")

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

@router.post("/auth/login", response_model=Token)
async def login_user(data: UserLogin):
    """Login user and return JWT token"""
    try:
        # Get user from database
        users_table = await get_users_table()
        response = users_table.select("*").eq("email", data.email).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        user = response.data[0]
        
        # Verify password
        if not verify_password(data.password, user["password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        # Create access token
        access_token = create_access_token(
            data={"sub": user["id"]}
        )
        
        return {"access_token": access_token, "token_type": "bearer"}
        
    except Exception as e:
        api_logger.error(f"Error in login_user: {str(e)}")
        api_logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/auth/google/login")
async def login_with_google(data: GoogleAuthRequest):
    """Login user with Google"""
    try:
        # Try to login
        user = await google_login_logic(data)
        if not user:
            # If login fails, try to register
            user = await google_register_logic(data)
            if not user:
                raise HTTPException(status_code=500, detail="Failed to login or register user")
                
        # Generate token
        token = create_access_token({"sub": user["id"]})
        
        return {
            "user": User(**user),
            "access_token": token,
            "token_type": "bearer"
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in login_with_google: {str(e)}")
        api_logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/guest/refresh")
async def refresh_guest_user(request: Request):
    """Refresh guest user with new session and skills"""
    try:
        user = getattr(request.state, "user", None)
        if not user or user.get("user_type") != "guest":
            raise HTTPException(status_code=401, detail="Not authenticated as guest")
            
        users_table = await get_users_table()
        skills_table = await get_skills_table()
        
        # Generate new session ID
        session_id = str(uuid.uuid4())
        
        # Get random skills
        kicker_skill = await get_random_skill(skills_table, "kicker")
        goalkeeper_skill = await get_random_skill(skills_table, "goalkeeper")
        
        # Generate new avatar
        avatar_seed = str(uuid.uuid4())
        avatar_url = f"https://api.dicebear.com/7.x/adventurer/svg?seed={avatar_seed}"
        
        # Update user
        now = get_vietnam_time()
        update_data = {
            "session_id": session_id,
            "remaining_matches": 5,
            "kicker_skills": [kicker_skill],
            "goalkeeper_skills": [goalkeeper_skill],
            "avatar": avatar_url,
            "updated_at": now.isoformat(),
            "last_activity": now.isoformat(),
            "total_point": 0,
            "bonus_point": 0.0
        }
        
        response = await users_table.update(update_data).eq("id", user["id"]).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to refresh guest user")
            
        updated_user = response.data[0]
        
        # Generate new token
        token = create_access_token({"sub": updated_user["id"]})
        
        return {
            "user": User(**updated_user),
            "access_token": token,
            "token_type": "bearer"
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in refresh_guest_user: {str(e)}")
        api_logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/users/{user_id}", response_model=User)
@cache_response(ttl=300)  # Cache for 5 minutes
async def get_user_by_id(user_id: str):
    """Get user by ID with caching"""
    try:
        users_table = await get_users_table()
        response = await users_table.select("*").eq("id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
            
        return User(**response.data[0])
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in get_user_by_id: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/level-up")
async def level_up(request: Request):
    """Level up user if they have enough points"""
    try:
        user = getattr(request.state, "user", None)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
            
        users_table = await get_users_table()
        
        # Calculate new levels
        total_point_for_level = get_total_point_for_level(user)
        new_basic_level = get_basic_level(total_point_for_level)
        new_legend_level = get_legend_level(user.get("total_point", 0))
        new_vip_level = get_vip_level(user.get("vip_amount", 0))
        
        # Check if user can level up
        if new_basic_level <= user.get("level", 1):
            raise HTTPException(status_code=400, detail="Not enough points to level up")
            
        # Update user levels
        update_data = {
            "level": new_basic_level,
            "legend_level": new_legend_level,
            "vip_level": new_vip_level,
            "updated_at": get_vietnam_time().isoformat()
        }
        
        response = await users_table.update(update_data).eq("id", user["id"]).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to update user levels")
            
        updated_user = response.data[0]
        return User(**updated_user)
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in level_up: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/auth/verify-email")
async def verify_email(token: str):
    """Verify user email with token"""
    try:
        users_table = await get_users_table()
        
        # Find user by verification token
        response = await users_table.select("*").eq("email_verification_token", token).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Invalid verification token")
            
        user = response.data[0]
        
        # Update user
        update_data = {
            "is_verified": True,
            "email_verification_token": None,
            "updated_at": get_vietnam_time().isoformat()
        }
        
        response = await users_table.update(update_data).eq("id", user["id"]).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to verify email")
            
        return {"message": "Email verified successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in verify_email: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/me/weekly-stats")
async def get_weekly_login_stats(request: Request):
    """Get user's weekly login statistics"""
    try:
        user = getattr(request.state, "user", None)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
            
        stats = get_weekly_stats(user)
        return stats
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in get_weekly_login_stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/upgrade-to-pro")
async def upgrade_to_pro(request: Request):
    """Upgrade user to PRO status"""
    try:
        user = getattr(request.state, "user", None)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
            
        users_table = await get_users_table()
        
        # Update user
        update_data = {
            "is_pro": True,
            "updated_at": get_vietnam_time().isoformat()
        }
        
        response = await users_table.update(update_data).eq("id", user["id"]).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to upgrade user to PRO")
            
        updated_user = response.data[0]
        return User(**updated_user)
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in upgrade_to_pro: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
