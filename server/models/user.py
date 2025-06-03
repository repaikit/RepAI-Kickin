from typing import Optional, List, Any, Dict, Annotated, Union
from pydantic import BaseModel, Field, BeforeValidator, EmailStr
from datetime import datetime
from bson import ObjectId
from pydantic.json_schema import JsonSchemaValue
from utils.time_utils import get_vietnam_time, VIETNAM_TZ

def validate_object_id(v: str) -> ObjectId:
    if not ObjectId.is_valid(v):
        raise ValueError("Invalid ObjectId")
    return ObjectId(v)

PyObjectId = Annotated[ObjectId, BeforeValidator(validate_object_id)]

class UserBase(BaseModel):
    user_type: str = "guest"  # guest, user, admin
    session_id: Optional[str] = None
    remaining_matches: int = 5
    last_reset: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None  # Hashed password
    auth_provider: Optional[str] = None  # google, email, guest
    wallet: Optional[str] = None
    position: str = "both"
    role: str = "user"
    is_active: bool = True
    is_verified: bool = False
    email_verification_token: Optional[str] = None
    trend: str = "neutral"
    name: str = "Guest Player"
    avatar: Optional[str] = None
    kicker_skills: List[str] = []
    goalkeeper_skills: List[str] = []
    total_point: int = 0  # Điểm tuần hiện tại
    bonus_point: float = 0.0
    match_history: List[Any] = []
    created_at: str = Field(default_factory=lambda: get_vietnam_time().isoformat())
    updated_at: str = Field(default_factory=lambda: get_vietnam_time().isoformat())
    last_activity: str = Field(default_factory=lambda: get_vietnam_time().isoformat())
    last_login: Optional[str] = None
    # Leaderboard fields
    total_kicked: int = 0
    kicked_win: int = 0
    total_keep: int = 0
    keep_win: int = 0
    available_skill_points: int = 0  # Số điểm kỹ năng có sẵn
    is_pro: bool = False
    is_vip: bool = False
    level: int = 1
    legend_level: int = 0
    vip_level: str = "NONE"  # SILVER, GOLD, RUBY, EMERALD, DIAMOND
    vip_amount: float = 0.0
    vip_year: Optional[int] = None
    vip_payment_method: str = "NONE"  # VISA, NFT, NONE
    # --- Thay thế các trường điểm tuần và lịch sử điểm tuần riêng biệt bằng trường chung ---
    week_history: List[dict] = []  # Lịch sử điểm tuần, mỗi entry: {"week": ..., "point": ..., "total_point": ..., "reset_at": ...}
    # --- Thêm các trường mới ---
    last_box_open: Optional[str] = None
    mystery_box_history: List[dict] = []
    last_claim_matches: Optional[str] = None
    # --- Thêm trường daily_tasks ---
    daily_tasks: Dict[str, Dict[str, bool]] = Field(default_factory=dict)  # {"task_id": {"completed": bool, "claimed": bool}}
    evm_mnemonic: Optional[str] = None
    evm_private_key: Optional[str] = None
    evm_address: Optional[str] = None
    sol_mnemonic: Optional[str] = None
    sol_private_key: Optional[str] = None
    sol_address: Optional[str] = None
    sui_mnemonic: Optional[str] = None
    sui_private_key: Optional[str] = None
    sui_address: Optional[str] = None
    # Thêm trường mới để lưu thông tin đăng nhập theo tuần
    weekly_logins: Dict[str, Dict[str, Any]] = Field(default_factory=dict)  # Format: {"YYYY-WW": {"login": bool, "points": int}}
    
    # NFT minted count
    nft_minted: int = 0
    # X fields
    x_connected: bool = False 
    x_id: Optional[str] = None 
    x_username: Optional[str] = None 
    x_access_token: Optional[str] = None 
    x_refresh_token: Optional[str] = None 
    x_token_expires_at: Optional[Union[int, datetime]] = None 
    x_main_account_id: Optional[str] = None 
    x_connected_at: Optional[datetime] = None 
    x_auth_state: Optional[str] = None
    used_invite_codes: List[str] = []

    class Config:
        json_encoders = {
            ObjectId: str
        }
        populate_by_name = True

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    user_type: Optional[str] = None
    session_id: Optional[str] = None
    remaining_matches: Optional[int] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    auth_provider: Optional[str] = None
    wallet: Optional[str] = None
    position: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    trend: Optional[str] = None
    name: Optional[str] = None
    avatar: Optional[str] = None
    kicker_skills: Optional[List[str]] = None
    goalkeeper_skills: Optional[List[str]] = None
    total_point: Optional[int] = None
    bonus_point: Optional[float] = None
    match_history: Optional[List[Any]] = None
    updated_at: str = Field(default_factory=lambda: get_vietnam_time().isoformat())
    last_login: Optional[str] = None
    # Leaderboard fields
    total_kicked: Optional[int] = None
    kicked_win: Optional[int] = None
    total_keep: Optional[int] = None
    keep_win: Optional[int] = None
    is_pro: Optional[bool] = None
    extra_point: Optional[int] = None
    level: Optional[int] = None
    last_box_open: Optional[str] = None
    mystery_box_history: Optional[List[dict]] = None
    last_claim_matches: Optional[str] = None
    # weekly_logins: Optional[Dict[str, Dict[str, int]]] = None
    # NFT minted count
    nft_minted: Optional[int] = None
    # X fields
    x_connected: bool = False 
    x_id: Optional[str] = None 
    x_username: Optional[str] = None 
    x_access_token: Optional[str] = None 
    x_refresh_token: Optional[str] = None 
    x_token_expires_at: Optional[Union[int, datetime]] = None 
    x_main_account_id: Optional[str] = None 
    x_connected_at: Optional[datetime] = None 
    x_auth_state: Optional[str] = None

    class Config:
        extra = "forbid"

class UserInDB(UserBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

    class Config:
        json_encoders = {
            ObjectId: str
        }
        populate_by_name = True
        arbitrary_types_allowed = True

class User(UserInDB):
    pass

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class GoogleAuthRequest(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = None 