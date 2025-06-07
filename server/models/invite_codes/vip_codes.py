from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, Field

class VIPInviteCode(BaseModel):
    code: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(default_factory=lambda: datetime.utcnow() + timedelta(days=30))
    is_used: bool = False
    used_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    def is_valid(self) -> bool:
        now = datetime.utcnow()
        return not self.is_used and now < self.expires_at

    def use_code(self):
        if not self.is_valid():
            return False
        self.is_used = True
        self.used_at = datetime.utcnow()
        return True

    @classmethod
    async def setup_table(cls, table):
        """Setup table indexes"""
        # Indexes are created in Supabase SQL
        pass