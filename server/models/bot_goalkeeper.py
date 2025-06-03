from pydantic import BaseModel, Field
from datetime import datetime
from bson import ObjectId
from typing import List


class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, *args, **kwargs):  
        if not ObjectId.is_valid(v):
            raise ValueError('Invalid objectid')
        return ObjectId(v)

class BotGoalkeeperModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId
    user_name: str
    skill: List[str] = []
    energy: float = 0.0
    feed_quota: float = 0
    last_skill_increase: datetime = Field(default_factory=datetime.utcnow)
    last_energy_deduction: datetime = Field(default_factory=datetime.utcnow)
    last_reset: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
