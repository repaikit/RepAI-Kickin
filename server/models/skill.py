from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime
import enum

class SkillType(str, enum.Enum):
    KICKER = "kicker"
    GOALKEEPER = "goalkeeper"

class SkillBase(BaseModel):
    name: str
    type: str  # Changed back to string to match database
    description: str
    point: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

class SkillCreate(SkillBase):
    pass

class SkillUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None  # Changed back to string
    description: Optional[str] = None
    point: Optional[int] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Skill(SkillBase):
    id: str

    class Config:
        from_attributes = True 