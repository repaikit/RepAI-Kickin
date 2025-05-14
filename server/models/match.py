from typing import Optional, List, Annotated
from pydantic import BaseModel, Field, BeforeValidator
from datetime import datetime
from bson import ObjectId
from pydantic.json_schema import JsonSchemaValue

def validate_object_id(v: str) -> ObjectId:
    if not ObjectId.is_valid(v):
        raise ValueError("Invalid ObjectId")
    return ObjectId(v)

PyObjectId = Annotated[ObjectId, BeforeValidator(validate_object_id)]

class Player(BaseModel):
    id: str
    role: str  # kicker or goalkeeper
    score: int = 0
    skills: List[str] = []

class MatchBase(BaseModel):
    status: str = "waiting"  # waiting, in_progress, completed
    match_type: str = "casual"  # casual or ranked
    players: List[Player] = []
    winner: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            ObjectId: str
        }
        populate_by_name = True

class MatchCreate(MatchBase):
    pass

class MatchUpdate(BaseModel):
    status: Optional[str] = None
    match_type: Optional[str] = None
    players: Optional[List[Player]] = None
    winner: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class MatchInDB(MatchBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")

    class Config:
        json_encoders = {
            ObjectId: str
        }
        populate_by_name = True
        arbitrary_types_allowed = True

class Match(MatchInDB):
    pass 