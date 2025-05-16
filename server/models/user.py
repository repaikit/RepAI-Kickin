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
    total_kicked: int = 0  # Số lần đá
    kicked_win: int = 0    # Số lượt đá thắng
    total_keep: int = 0    # Số lần chụp gôn
    keep_win: int = 0      # Số lần chụp thắng
    is_pro: bool = False   # Tài khoản Pro
    total_extra_skill: int = 0  # Số lần dùng Extra Skill (chỉ Pro)
    extra_skill_win: int = 0    # Số lần thắng bằng Extra Skill (chỉ Pro)
    level: int = 1

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
    total_extra_skill: Optional[int] = None  # Chỉ Pro
    extra_skill_win: Optional[int] = None    # Chỉ Pro
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