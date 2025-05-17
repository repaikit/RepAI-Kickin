from typing import Optional, List, Any, Dict, Annotated
from pydantic import BaseModel, Field, BeforeValidator
from datetime import datetime
from bson import ObjectId
from pydantic.json_schema import JsonSchemaValue

def validate_object_id(v: str) -> ObjectId:
    if not ObjectId.is_valid(v):
        raise ValueError("Invalid ObjectId")
    return ObjectId(v)

PyObjectId = Annotated[ObjectId, BeforeValidator(validate_object_id)]

class UserBase(BaseModel):
    user_type: str = "guest"  # guest, user, admin
    session_id: Optional[str] = None
    remaining_matches: int = 5
    last_reset: Optional[datetime] = None
    email: Optional[str] = None  # Simple string, no validation
    wallet: Optional[str] = None
    twitter_id: Optional[str] = None
    position: str = "both"
    role: str = "user"
    is_active: bool = True
    is_verified: bool = False
    trend: str = "neutral"
    name: str = "Guest Player"
    avatar: Optional[str] = None
    kicker_skills: List[str] = []
    goalkeeper_skills: List[str] = []
    total_point: int = 0
    reward: float = 0.0
    match_history: List[Any] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    # Leaderboard fields
    total_kicked: int = 0
    kicked_win: int = 0
    total_keep: int = 0
    keep_win: int = 0
    is_pro: bool = False
    is_vip: bool = False
    extra_skill_win: int = 0
    level: int = 1
    legend_level: int = 0
    vip_level: str = "NONE"  # SILVER, GOLD, RUBY, EMERALD, DIAMOND
    vip_amount: float = 0.0
    vip_year: int = 2024
    vip_payment_method: str = "NONE"  # VISA, NFT, NONE
    # --- Thêm các trường điểm tuần và lịch sử điểm tuần ---
    basic_week_point: int = 0
    pro_week_point: int = 0
    vip_week_point: int = 0
    basic_week_history: List[dict] = []  # [{"week": "2024-21", "point": 10}]
    pro_week_history: List[dict] = []
    vip_week_history: List[dict] = []

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
    email: Optional[str] = None
    wallet: Optional[str] = None
    twitter_id: Optional[str] = None
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
    reward: Optional[float] = None
    match_history: Optional[List[Any]] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    # Leaderboard fields
    total_kicked: Optional[int] = None
    kicked_win: Optional[int] = None
    total_keep: Optional[int] = None
    keep_win: Optional[int] = None
    is_pro: Optional[bool] = None
    total_extra_skill: Optional[int] = None
    level: Optional[int] = None

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