from datetime import datetime, timedelta
from typing import Optional
from bson import ObjectId

class VIPInviteCode:
    def __init__(
        self,
        code: str,
        created_at: datetime = None,
        expires_at: datetime = None,
        is_used: bool = False,
        used_at: Optional[datetime] = None,
        _id: ObjectId = None
    ):
        self._id = _id or ObjectId()
        self.code = code
        self.created_at = created_at or datetime.utcnow()
        self.expires_at = expires_at or (self.created_at + timedelta(days=7))
        self.is_used = is_used
        self.used_at = used_at

    def to_dict(self):
        return {
            "_id": self._id,
            "code": self.code,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "is_used": self.is_used,
            "used_at": self.used_at
        }

    @staticmethod
    def from_dict(data: dict):
        return VIPInviteCode(
            _id=data.get("_id"),
            code=data["code"],
            created_at=data["created_at"],
            expires_at=data["expires_at"],
            is_used=data["is_used"],
            used_at=data.get("used_at")
        )

    def is_valid(self) -> bool:
        now = datetime.utcnow()
        return not self.is_used and now < self.expires_at

    def use_code(self):
        if not self.is_valid():
            return False
        self.is_used = True
        self.used_at = datetime.utcnow()
        return True 