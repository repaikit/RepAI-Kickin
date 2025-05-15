from typing import Optional, Annotated
from pydantic import BaseModel, Field, BeforeValidator
from datetime import datetime
from bson import ObjectId
from pydantic.json_schema import JsonSchemaValue
import enum

def validate_object_id(v: str) -> ObjectId:
    if not ObjectId.is_valid(v):
        raise ValueError("Invalid ObjectId")
    return ObjectId(v)

PyObjectId = Annotated[ObjectId, BeforeValidator(validate_object_id)]

class SkillType(str, enum.Enum):
    KICKER = "kicker"
    GOALKEEPER = "goalkeeper"

class SkillBase(BaseModel):
    name: str
    type: str  # Changed back to string to match database
    description: str
    point: int

    class Config:
        json_encoders = {
            ObjectId: str
        }
        populate_by_name = True

class SkillCreate(SkillBase):
    pass

class SkillUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None  # Changed back to string
    description: Optional[str] = None
    point: Optional[int] = None

class SkillInDB(SkillBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

    class Config:
        json_encoders = {
            ObjectId: str
        }
        populate_by_name = True
        arbitrary_types_allowed = True

class Skill(SkillInDB):
    pass 