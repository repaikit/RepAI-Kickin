from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Query
from models.invite_codes.vip_codes import VIPInviteCode
from models.user import User
from database.database import get_users_collection, get_vip_codes_collection, get_pro_codes_collection
from utils.logger import api_logger

router = APIRouter()

async def setup_vip_codes():
    """Khởi tạo các code VIP mặc định nếu chưa có"""
    try:
        vip_codes_collection = await get_vip_codes_collection()
        pro_codes_collection = await get_pro_codes_collection()
        
        # Kiểm tra và tạo code VIP mặc định
        default_vip_code = await vip_codes_collection.find_one({"code": "VIP-DEFAULT"})
        if not default_vip_code:
            vip_code = VIPInviteCode(
                code="VIP-DEFAULT",
                created_by="system",
                expires_at=datetime(2099, 12, 31)  # Không bao giờ hết hạn
            )
            await vip_codes_collection.insert_one(vip_code.to_dict())
            
        # Kiểm tra và tạo code PRO mặc định
        default_pro_code = await pro_codes_collection.find_one({"code": "PRO-DEFAULT"})
        if not default_pro_code:
            pro_code = VIPInviteCode(
                code="PRO-DEFAULT",
                created_by="system",
                expires_at=datetime(2099, 12, 31)  # Không bao giờ hết hạn
            )
            await pro_codes_collection.insert_one(pro_code.to_dict())
            
    except Exception as e:
        api_logger.error(f"Error in setup_vip_codes: {str(e)}")
        raise

@router.get("/verify-code")
async def verify_code(
    request: Request,
    code: str = Query(..., description="Invite code to verify"),
    code_type: str = Query(..., description="Type of code to verify (VIP or PRO)")
):
    """Verify if an invite code is valid"""
    # Kiểm tra user đã đăng nhập chưa
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        collection = get_vip_codes_collection() if code_type.upper() == "VIP" else get_pro_codes_collection()
        codes_collection = await collection
        
        code_doc = await codes_collection.find_one({"code": code})
        if not code_doc:
            raise HTTPException(status_code=404, detail="Code not found or already used")
        
        invite_code = VIPInviteCode.from_dict(code_doc)
        if not invite_code.is_valid():
            raise HTTPException(status_code=400, detail="Code has expired or already been used")
        
        return {"valid": True}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in verify_code: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/redeem-code")
async def redeem_code(
    request: Request,
    code: str = Query(..., description="Invite code to redeem"),
    code_type: str = Query(..., description="Type of code to redeem (VIP or PRO)")
):
    """Redeem an invite code to activate status"""
    # Kiểm tra user đã đăng nhập chưa
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        collection = get_vip_codes_collection() if code_type.upper() == "VIP" else get_pro_codes_collection()
        codes_collection = await collection
        users_collection = await get_users_collection()
        
        # Get and validate code
        code_doc = await codes_collection.find_one({"code": code})
        if not code_doc:
            raise HTTPException(status_code=404, detail="Code not found or already used")
            
        invite_code = VIPInviteCode.from_dict(code_doc)
        if not invite_code.is_valid():
            raise HTTPException(status_code=400, detail="Code has expired or already been used")
        
        # Update user status based on code type
        update_data = {
            "$set": {
                f"is_{code_type.lower()}": True,
                f"{code_type.lower()}_level": code_type.upper(),
                f"{code_type.lower()}_amount": 0.0,
                f"{code_type.lower()}_year": datetime.utcnow().year
            }
        }
        
        # Mark code as used
        invite_code.use_code()
        invite_code.expires_at = datetime.utcnow()
        await codes_collection.update_one(
            {"_id": invite_code._id},
            {"$set": invite_code.to_dict()}
        )
        
        # Update user
        await users_collection.update_one({"_id": user["_id"]}, update_data)
        
        return {"success": True, "message": f"{code_type} status activated successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in redeem_code: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") 