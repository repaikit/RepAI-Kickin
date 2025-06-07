from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Query
from models.invite_codes.vip_codes import VIPInviteCode
from models.user import User
from database.database import get_users_table, get_vip_codes_table, get_pro_codes_table
from utils.logger import api_logger

router = APIRouter()

async def setup_vip_codes():
    """Khởi tạo các code VIP mặc định nếu chưa có"""
    try:
        vip_codes_table = await get_vip_codes_table()
        pro_codes_table = await get_pro_codes_table()
        
        # Kiểm tra và tạo code VIP mặc định
        response = await vip_codes_table.select('*').eq('code', 'VIP-DEFAULT').execute()
        if not response.data:
            vip_code = VIPInviteCode(
                code="VIP-DEFAULT",
                created_by="system",
                expires_at=datetime(2099, 12, 31)  # Không bao giờ hết hạn
            )
            await vip_codes_table.insert(vip_code.to_dict()).execute()
            
        # Kiểm tra và tạo code PRO mặc định
        response = await pro_codes_table.select('*').eq('code', 'PRO-DEFAULT').execute()
        if not response.data:
            pro_code = VIPInviteCode(
                code="PRO-DEFAULT",
                created_by="system",
                expires_at=datetime(2099, 12, 31)  # Không bao giờ hết hạn
            )
            await pro_codes_table.insert(pro_code.to_dict()).execute()
            
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
        table = get_vip_codes_table() if code_type.upper() == "VIP" else get_pro_codes_table()
        codes_table = await table
        
        response = await codes_table.select('*').eq('code', code).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Code not found or already used")
        
        code_doc = response.data[0]
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
        table = get_vip_codes_table() if code_type.upper() == "VIP" else get_pro_codes_table()
        codes_table = await table
        users_table = await get_users_table()
        
        # Get and validate code
        response = await codes_table.select('*').eq('code', code).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Code not found or already used")
            
        code_doc = response.data[0]
        invite_code = VIPInviteCode.from_dict(code_doc)
        if not invite_code.is_valid():
            raise HTTPException(status_code=400, detail="Code has expired or already been used")
        
        # Update user status based on code type
        update_data = {
            f"is_{code_type.lower()}": True,
            f"{code_type.lower()}_level": code_type.upper(),
            f"{code_type.lower()}_amount": 0.0,
            f"{code_type.lower()}_year": datetime.utcnow().year
        }
        
        # Mark code as used
        invite_code.use_code()
        invite_code.expires_at = datetime.utcnow()
        await codes_table.update(invite_code.to_dict()).eq('id', invite_code.id).execute()
        
        # Update user
        await users_table.update(update_data).eq('id', user["id"]).execute()
        
        return {"success": True, "message": f"{code_type} status activated successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in redeem_code: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") 