from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class NFT(BaseModel):
    """NFT Model"""
    token_id: str = Field(..., description="Token ID of the NFT")
    contract_address: str = Field(..., description="Contract address of the NFT")
    chain: str = Field(..., description="Blockchain network (e.g., ETH, BSC, SOL)")
    name: str = Field(..., description="Name of the NFT")
    description: Optional[str] = Field(None, description="Description of the NFT")
    image_url: str = Field(..., description="URL of the NFT image")
    owner_address: str = Field(..., description="Wallet address of the NFT owner")
    status: str = Field(default="active", description="Status of the NFT (active/inactive)")
    metadata: Optional[Dict[str, Any]] = Field(default={}, description="Additional metadata of the NFT")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

    def to_dict(self) -> dict:
        """Convert model to dictionary"""
        return self.model_dump(exclude_none=True)

    @classmethod
    def from_dict(cls, data: dict) -> "NFT":
        """Create model from dictionary"""
        return cls(**data)

    @classmethod
    async def setup_table(cls, table):
        """Setup table indexes"""
        # Indexes are created in Supabase SQL
        pass 