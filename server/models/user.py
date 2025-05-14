from typing import Optional, List, Any, Dict, Annotated
from pydantic import BaseModel, EmailStr, Field, BeforeValidator
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
    expires_at: Optional[datetime] = None
    privy_id: Optional[str] = None
    email: Optional[EmailStr] = None
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
    point: int = 0
    wins: int = 0
    losses: int = 0
    total_matches: int = 0
    rank: int = 9999
    match_history: List[Any] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    # New fields for guest user tracking
    guest_created_at: Optional[datetime] = None
    converted_to_user: bool = False
    converted_at: Optional[datetime] = None
    device_info: Optional[Dict[str, Any]] = None

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
    expires_at: Optional[datetime] = None
    privy_id: Optional[str] = None
    email: Optional[EmailStr] = None
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
    point: Optional[int] = None
    wins: Optional[int] = None
    losses: Optional[int] = None
    total_matches: Optional[int] = None
    rank: Optional[int] = None
    match_history: Optional[List[Any]] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    # New fields for guest user tracking
    guest_created_at: Optional[datetime] = None
    converted_to_user: Optional[bool] = None
    converted_at: Optional[datetime] = None
    device_info: Optional[Dict[str, Any]] = None

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