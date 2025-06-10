from pydantic import BaseModel, Field
from datetime import datetime
from typing import List

class BotGoalkeeperModel(BaseModel):
    id: str
    user_id: str
    user_name: str
    skill: List[str] = []
    energy: float = 0.0
    feed_quota: float = 0
    last_skill_increase: datetime = Field(default_factory=datetime.utcnow)
    last_energy_deduction: datetime = Field(default_factory=datetime.utcnow)
    last_reset: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
