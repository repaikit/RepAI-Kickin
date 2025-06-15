from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Query
from models.invite_codes.vip_codes import VIPInviteCode
from models.user import User
from database.database import get_users_collection, get_vip_codes_collection, get_pro_codes_collection
from utils.logger import api_logger
from typing import List
from pydantic import BaseModel
from utils.chainlink_vrf import ChainlinkVRF

class GenerateCodesRequest(BaseModel):
    count: int
    expires_at: datetime
    code_type: str

router = APIRouter()
chainlink_vrf = ChainlinkVRF()

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
    code_type: str = Query("VIP", description="Type of code to verify (VIP or PRO)")
):
    """Verify if an invite code is valid"""
    try:
        # Validate code format
        code = code.strip().upper()  # Chuẩn hóa code
        code_parts = code.split("-")
        
        # Kiểm tra code type
        code_type = code_type.strip().upper()
        if code_type not in ["VIP", "PRO"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid code type. Must be either 'VIP' or 'PRO'"
            )

        # Kiểm tra user đã đăng nhập chưa
        user = getattr(request.state, "user", None)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        # Log for debugging
        api_logger.info(f"Verifying code: {code} of type: {code_type}")

        try:
            collection = get_vip_codes_collection() if code_type == "VIP" else get_pro_codes_collection()
            codes_collection = await collection
            
            # Log the query
            api_logger.info(f"Searching for code in collection: {codes_collection.name}")
            
            code_doc = await codes_collection.find_one({"code": code})
            if not code_doc:
                api_logger.info(f"Code not found: {code}")
                raise HTTPException(status_code=404, detail="Code not found")
            
            api_logger.info(f"Found code document: {code_doc}")
            
            invite_code = VIPInviteCode.from_dict(code_doc)
            if not invite_code.is_valid():
                # Log detailed validation failure
                api_logger.info(
                    f"Code validation failed. is_used: {invite_code.is_used}, "
                    f"expires_at: {invite_code.expires_at}, "
                    f"current_time: {datetime.utcnow()}"
                )
                raise HTTPException(
                    status_code=400, 
                    detail="Code has expired or already been used"
                )
            
            # Check if user has already used this code
            users_collection = await get_users_collection()
            user_doc = await users_collection.find_one({
                "_id": user["_id"],
                "used_invite_codes": code
            })
            
            if user_doc:
                raise HTTPException(
                    status_code=400,
                    detail="You have already used this code"
                )
            
            return {
                "valid": True,
                "code_type": code_type,
                "expires_at": invite_code.expires_at.isoformat(),
                "is_used": invite_code.is_used
            }
            
        except HTTPException:
            raise
        except Exception as e:
            api_logger.error(f"Database error in verify_code: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")
            
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Unexpected error in verify_code: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/redeem-code")
async def redeem_code(
    request: Request,
    code: str = Query(..., description="Invite code to redeem"),
    code_type: str = Query("VIP", description="Type of code to redeem (VIP or PRO)")
):
    """Redeem an invite code to activate status"""
    try:
        # Validate code format
        code = code.strip().upper()  # Chuẩn hóa code
        
        # Validate code type
        code_type = code_type.strip().upper()
        if code_type not in ["VIP", "PRO"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid code type. Must be either 'VIP' or 'PRO'"
            )

        # Kiểm tra user đã đăng nhập chưa
        user = getattr(request.state, "user", None)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")

        try:
            collection = get_vip_codes_collection() if code_type == "VIP" else get_pro_codes_collection()
            codes_collection = await collection
            users_collection = await get_users_collection()
            
            # Get and validate code
            code_doc = await codes_collection.find_one({"code": code})
            if not code_doc:
                raise HTTPException(status_code=404, detail="Code not found")
                
            invite_code = VIPInviteCode.from_dict(code_doc)
            if not invite_code.is_valid():
                raise HTTPException(status_code=400, detail="Code has expired or already been used")
            
            # Check if user has already used this code
            user_doc = await users_collection.find_one({
                "_id": user["_id"],
                "used_invite_codes": code
            })
            
            if user_doc:
                raise HTTPException(
                    status_code=400,
                    detail="You have already used this code"
                )
            
            # Update user status based on code type
            update_data = {
                "$set": {
                    f"is_{code_type.lower()}": True,
                    f"{code_type.lower()}_level": code_type,
                    f"{code_type.lower()}_amount": 0.0,
                    f"{code_type.lower()}_year": datetime.utcnow().year
                },
                "$push": {
                    "used_invite_codes": code
                }
            }
            
            # Mark code as used
            invite_code.use_code()
            await codes_collection.update_one(
                {"_id": invite_code._id},
                {"$set": invite_code.to_dict()}
            )
            
            # Update user
            await users_collection.update_one({"_id": user["_id"]}, update_data)
            
            return {
                "success": True, 
                "message": f"{code_type} status activated successfully",
                "expires_at": invite_code.expires_at.isoformat()
            }
            
        except HTTPException:
            raise
        except Exception as e:
            api_logger.error(f"Database error in redeem_code: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")
            
    except HTTPException:
        raise
    except Exception as e:
        api_logger.error(f"Unexpected error in redeem_code: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/generate-codes")
async def generate_codes(request: Request, req: GenerateCodesRequest):
    """Generate new invite codes"""
    # Kiểm tra user đã đăng nhập và có role admin
    user = getattr(request.state, "user", None)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only users with admin role can generate codes")

    try:
        # Kiểm tra thời hạn code không được vượt quá 1 năm
        max_expiry = datetime.utcnow().replace(year=datetime.utcnow().year + 1)
        if req.expires_at > max_expiry:
            raise HTTPException(
                status_code=400, 
                detail="Code expiry cannot be more than 1 year from now"
            )

        collection = get_vip_codes_collection() if req.code_type.upper() == "VIP" else get_pro_codes_collection()
        codes_collection = await collection
        
        # Sử dụng Chainlink VRF để tạo mã ngẫu nhiên
        prefix = "VIP-" if req.code_type.upper() == "VIP" else "PRO-"
        random_codes = await chainlink_vrf.generate_random_code(prefix, req.count)
        
        generated_codes = []
        for code in random_codes:
            invite_code = VIPInviteCode(
                code=code,
                expires_at=req.expires_at
            )
            
            await codes_collection.insert_one(invite_code.to_dict())
            generated_codes.append(code)
            
        return {"success": True, "codes": generated_codes}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in generate_codes: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") 