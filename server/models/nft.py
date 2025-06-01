from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from bson import ObjectId

class NFT(BaseModel):
    """NFT Model"""
    _id: Optional[str] = None
    token_id: str = Field(..., description="Token ID of the NFT")
    contract_address: str = Field(..., description="Contract address of the NFT")
    chain: str = Field(..., description="Blockchain network (e.g., ETH, BSC, SOL)")
    name: str = Field(..., description="Name of the NFT")
    description: Optional[str] = Field(None, description="Description of the NFT")
    image_url: str = Field(..., description="URL of the NFT image")
    owner_address: str = Field(..., description="Wallet address of the NFT owner")
    status: str = Field(default="active", description="Status of the NFT (active/inactive)")
    metadata: Optional[Dict[str, Any]] = Field(default={}, description="Additional metadata of the NFT")
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self) -> dict:
        """Convert model to dictionary"""
        data = self.model_dump(exclude_none=True)
        if self._id:
            data["_id"] = ObjectId(self._id)
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "NFT":
        """Create model from dictionary"""
        if "_id" in data:
            data["_id"] = str(data["_id"])
        return cls(**data)

    @classmethod
    async def setup_collection(cls, db):
        """Setup collection indexes"""
        await db.create_index("token_id", unique=True)
        await db.create_index("contract_address")
        await db.create_index("owner_address")
        await db.create_index("status")
        await db.create_index("chain") 