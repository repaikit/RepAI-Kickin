from datetime import datetime
import secrets
import string
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import List
from models.invite_codes.vip_codes import VIPInviteCode
from models.user import User
from database.database import get_users_collection, get_vip_codes_collection


router = APIRouter()

async def setup_vip_codes():
    """
    Thiết lập collection và indexes khi khởi động ứng dụng
    """
    db = await get_vip_codes_collection()
    await VIPInviteCode.setup_collection(db)

def generate_vip_code(prefix: str = "VIP", groups: int = 3, group_length: int = 4) -> str:
    """
    Generate a professional VIP code.
    
    Args:
        prefix (str): Optional prefix for the code.
        groups (int): Number of groups in the code (e.g., 3 groups = XXXX-XXXX-XXXX).
        group_length (int): Number of characters per group.
    
    Returns:
        str: VIP code in the format PREFIX-XXXX-XXXX-XXXX
    """
    alphabet = string.ascii_uppercase + string.digits  # A-Z, 0-9
    code_groups = [
        ''.join(secrets.choice(alphabet) for _ in range(group_length))
        for _ in range(groups)
    ]
    return f"{prefix}-" + '-'.join(code_groups)

@router.post("/generate-codes", response_model=List[str])
async def generate_vip_codes(request: Request, count: int = 10):
    """Generate VIP invite codes (admin/developer only)"""
    # Kiểm tra user có quyền không
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if user.get("role") not in ["owner", "developer"]:
        raise HTTPException(
            status_code=403, 
            detail="No permission!"
        )

    vip_codes_collection = await get_vip_codes_collection()
    codes = []
    
    for _ in range(count):
        code = generate_vip_code()
        vip_code = VIPInviteCode(code=code)
        await vip_codes_collection.insert_one(vip_code.to_dict())
        codes.append(code)
    
    return codes

@router.get("/verify-code")
async def verify_vip_code(
    request: Request,
    code: str = Query(..., description="VIP invite code to verify")
):
    """Verify if a VIP invite code is valid"""
    # Kiểm tra user đã đăng nhập chưa
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Kiểm tra user đã là VIP chưa
    if user.get("is_vip"):
        raise HTTPException(status_code=400, detail="User is already VIP")

    vip_codes_collection = await get_vip_codes_collection()
    
    code_doc = await vip_codes_collection.find_one({"code": code})
    if not code_doc:
        raise HTTPException(status_code=404, detail="Invite code has expired or already been used")
    
    vip_code = VIPInviteCode.from_dict(code_doc)
    if not vip_code.is_valid():
        raise HTTPException(status_code=400, detail="Invite code has expired or already been used")
    
    return {"valid": True}

@router.post("/redeem-code")
async def redeem_vip_code(
    request: Request,
    code: str = Query(..., description="VIP invite code to redeem")
):
    """Redeem a VIP invite code to activate VIP status"""
    # Kiểm tra user đã đăng nhập chưa
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Kiểm tra user đã là VIP chưa
    if user.get("is_vip"):
        raise HTTPException(status_code=400, detail="User is already VIP")

    vip_codes_collection = await get_vip_codes_collection()
    users_collection = await get_users_collection()
    
    # Get and validate code
    code_doc = await vip_codes_collection.find_one({"code": code})
    if not code_doc:
        raise HTTPException(status_code=404, detail="Invite code has expired or already been used")
        
    vip_code = VIPInviteCode.from_dict(code_doc)
    if not vip_code.is_valid():
        raise HTTPException(status_code=400, detail="Invite code has expired or already been used")
    
    # Update user VIP status
    update_data = {
        "$set": {
            "is_vip": True,
            "vip_level": "VIP",
            "vip_amount": 0.0,
            "vip_year": datetime.utcnow().year
        }
    }
    
    # Mark code as used and update expiration to now to trigger immediate deletion
    vip_code.use_code()
    vip_code.expires_at = datetime.utcnow()  # Set expiration to now for immediate cleanup
    await vip_codes_collection.update_one(
        {"_id": vip_code._id},
        {"$set": vip_code.to_dict()}
    )
    
    # Update user using users_collection
    await users_collection.update_one({"_id": user["_id"]}, update_data)
    
    return {"success": True, "message": "VIP status activated successfully"} 