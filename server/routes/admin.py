from fastapi import APIRouter, HTTPException, Request, Depends, Body, Query
from typing import Optional, List
from models.user import User, UserUpdate
from models.invite_codes.vip_codes import VIPInviteCode
from models.nft import NFT
from database.database import get_users_table, get_vip_codes_table, get_pro_codes_table, get_nfts_table
from datetime import datetime
from bson import ObjectId
from utils.logger import api_logger
from utils.time_utils import get_vietnam_time
from pydantic import BaseModel
import secrets
import string

router = APIRouter()

class UserFilter(BaseModel):
    search: Optional[str] = None
    user_type: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    page: int = 1
    limit: int = 10

def generate_code(prefix: str = "VIP", groups: int = 3, group_length: int = 4) -> str:
    alphabet = string.ascii_uppercase + string.digits  # A-Z, 0-9
    code_groups = [
        ''.join(secrets.choice(alphabet) for _ in range(group_length))
        for _ in range(groups)
    ]
    return f"{prefix}-" + '-'.join(code_groups)

# Helper function để check quyền admin
async def require_admin(request: Request):
    user = getattr(request.state, 'user', None)
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin privileges required')

# User Management APIs
@router.get("/users")
async def get_users(filter: UserFilter = Depends()):
    """Lấy danh sách users với các bộ lọc"""
    try:
        users_table = await get_users_table()
        
        # Xây dựng query filter
        query = users_table.select('*')
        
        if filter.user_type and filter.user_type != "all":
            query = query.eq('user_type', filter.user_type)
        if filter.role and filter.role != "all":
            query = query.eq('role', filter.role)
        if filter.is_active is not None:
            query = query.eq('is_active', filter.is_active)
            
        # Tìm kiếm theo tên, email hoặc wallet
        if filter.search:
            query = query.or_(
                f"name.ilike.%{filter.search}%," +
                f"email.ilike.%{filter.search}%," +
                f"evm_address.ilike.%{filter.search}%," +
                f"sol_address.ilike.%{filter.search}%," +
                f"sui_address.ilike.%{filter.search}%"
            )
            
        # Tính toán offset và limit cho phân trang
        offset = (filter.page - 1) * filter.limit
        
        # Lấy tổng số users
        count_response = query.execute()
        total = len(count_response.data)
        
        # Lấy danh sách users với phân trang
        response = query.range(offset, offset + filter.limit - 1).execute()
        users = response.data
            
        return {
            "users": users,
            "total": total,
            "page": filter.page,
            "limit": filter.limit,
            "total_pages": (total + filter.limit - 1) // filter.limit
        }
        
    except Exception as e:
        api_logger.error(f"Error in get_users: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/users/{user_id}")
async def get_user(user_id: str):
    """Lấy thông tin chi tiết của một user"""
    try:
        users_table = await get_users_table()
        response = await users_table.select('*').eq('id', user_id).execute()
        user = response.data[0] if response.data else None
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        return user
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in get_user: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.patch("/users/{user_id}")
async def update_user(user_id: str, updates: UserUpdate):
    """Cập nhật thông tin của một user"""
    try:
        users_table = await get_users_table()
        
        # Kiểm tra user tồn tại
        response = await users_table.select('*').eq('id', user_id).execute()
        user = response.data[0] if response.data else None
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Lấy dữ liệu cập nhật từ request body
        update_data = updates.model_dump(exclude_unset=True)
        
        # Thêm thời gian cập nhật
        update_data["updated_at"] = get_vietnam_time().isoformat()
        
        # Cập nhật user
        result = await users_table.update(update_data).eq('id', user_id).execute()
        
        if result.data['count'] == 0:
            raise HTTPException(status_code=400, detail="No changes made")
            
        # Lấy thông tin user sau khi cập nhật
        updated_user = await users_table.select('*').eq('id', user_id).execute()
        updated_user = updated_user.data[0] if updated_user.data else None
        
        return updated_user
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in update_user: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    """Xóa một user"""
    try:
        users_table = await get_users_table()
        
        # Kiểm tra user tồn tại
        response = await users_table.select('*').eq('id', user_id).execute()
        user = response.data[0] if response.data else None
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Xóa user
        result = await users_table.delete().eq('id', user_id).execute()
        
        if result.data['count'] == 0:
            raise HTTPException(status_code=400, detail="Failed to delete user")
            
        return {"message": "User deleted successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in delete_user: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/users/{user_id}/activate")
async def activate_user(user_id: str):
    """Kích hoạt một user"""
    try:
        users_table = await get_users_table()
        
        # Kiểm tra user tồn tại
        response = await users_table.select('*').eq('id', user_id).execute()
        user = response.data[0] if response.data else None
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Cập nhật trạng thái active
        result = await users_table.update({
            "is_active": True,
            "updated_at": get_vietnam_time().isoformat()
        }).eq('id', user_id).execute()
        
        if result.data['count'] == 0:
            raise HTTPException(status_code=400, detail="Failed to activate user")
            
        return {"message": "User activated successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in activate_user: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/users/{user_id}/deactivate")
async def deactivate_user(user_id: str):
    """Vô hiệu hóa một user"""
    try:
        users_table = await get_users_table()
        
        # Kiểm tra user tồn tại
        response = await users_table.select('*').eq('id', user_id).execute()
        user = response.data[0] if response.data else None
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Cập nhật trạng thái active
        result = await users_table.update({
            "is_active": False,
            "updated_at": get_vietnam_time().isoformat()
        }).eq('id', user_id).execute()
        
        if result.data['count'] == 0:
            raise HTTPException(status_code=400, detail="Failed to deactivate user")
            
        return {"message": "User deactivated successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in deactivate_user: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/users/{user_id}/make-admin")
async def make_admin(user_id: str):
    """Cấp quyền admin cho một user"""
    try:
        users_table = await get_users_table()
        
        # Kiểm tra user tồn tại
        response = await users_table.select('*').eq('id', user_id).execute()
        user = response.data[0] if response.data else None
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Cập nhật role thành admin
        result = await users_table.update({
            "role": "admin",
            "updated_at": get_vietnam_time().isoformat()
        }).eq('id', user_id).execute()
        
        if result.data['count'] == 0:
            raise HTTPException(status_code=400, detail="Failed to make user admin")
            
        return {"message": "User is now an admin"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in make_admin: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/users/{user_id}/remove-admin")
async def remove_admin(user_id: str):
    """Xóa quyền admin của một user"""
    try:
        users_table = await get_users_table()
        
        # Kiểm tra user tồn tại
        response = await users_table.select('*').eq('id', user_id).execute()
        user = response.data[0] if response.data else None
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Cập nhật role thành user
        result = await users_table.update({
            "role": "user",
            "updated_at": get_vietnam_time().isoformat()
        }).eq('id', user_id).execute()
        
        if result.data['count'] == 0:
            raise HTTPException(status_code=400, detail="Failed to remove admin role")
            
        return {"message": "Admin role removed successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in remove_admin: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Code Management APIs
@router.get("/codes")
async def list_codes(
    request: Request,
    code_type: str = Query(..., description="Type of codes to list (VIP or PRO)"),
    status: Optional[str] = Query(None, description="Filter by status (used, unused, all)"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Items per page")
):
    """List all codes with filtering and pagination"""
    # Kiểm tra quyền admin
    user = getattr(request.state, "user", None)
    if not user or user.get("role") not in ["admin", "owner", "developer"]:
        raise HTTPException(status_code=403, detail="No permission")

    try:
        collection = get_vip_codes_table() if code_type.upper() == "VIP" else get_pro_codes_table()
        codes_table = await collection

        # Build query
        query = codes_table.select('*')
        if status and status != "all":
            query = query.eq('status', status)

        # Calculate pagination
        skip = (page - 1) * limit
        total = await query.execute()
        
        # Get codes
        response = await query.range(skip, skip + limit - 1).execute()
        codes = response.data
        
        return {
            "codes": codes,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
        
    except Exception as e:
        api_logger.error(f"Error in list_codes: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/codes/generate", response_model=List[str])
async def generate_codes(
    request: Request, 
    code_type: str = Query(..., description="Type of codes to generate (VIP or PRO)"),
    count: int = Query(10, description="Number of codes to generate"),
    prefix: Optional[str] = Query(None, description="Custom prefix for codes")
):
    """Generate VIP or PRO invite codes (admin/developer only)"""
    # Kiểm tra quyền admin
    user = getattr(request.state, "user", None)
    if not user or user.get("role") not in ["admin", "owner", "developer"]:
        raise HTTPException(status_code=403, detail="No permission")

    try:
        collection = get_vip_codes_table() if code_type.upper() == "VIP" else get_pro_codes_table()
        codes_table = await collection
        
        codes = []
        code_prefix = prefix or code_type.upper()
        
        for _ in range(count):
            code = generate_code(prefix=code_prefix)
            code_doc = VIPInviteCode(code=code)
            await codes_table.insert(code_doc.to_dict()).execute()
            codes.append(code)
        
        return codes
        
    except Exception as e:
        api_logger.error(f"Error in generate_codes: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/codes/{code_id}")
async def delete_code(
    request: Request,
    code_id: str,
    code_type: str = Query(..., description="Type of code to delete (VIP or PRO)")
):
    """Delete a specific code"""
    # Kiểm tra quyền admin
    user = getattr(request.state, "user", None)
    if not user or user.get("role") not in ["admin", "owner", "developer"]:
        raise HTTPException(status_code=403, detail="No permission")

    try:
        collection = get_vip_codes_table() if code_type.upper() == "VIP" else get_pro_codes_table()
        codes_table = await collection
        
        result = await codes_table.delete().eq('id', code_id).execute()
        if result.data['count'] == 0:
            raise HTTPException(status_code=404, detail="Code not found")
            
        return {"message": "Code deleted successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in delete_code: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# NFT Management APIs
@router.get("/nfts")
async def list_nfts(
    request: Request,
    wallet_address: Optional[str] = Query(None, description="Filter by wallet address"),
    status: Optional[str] = Query(None, description="Filter by status (active, inactive, all)"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Items per page")
):
    """List all NFTs with filtering and pagination"""
    # Kiểm tra quyền admin
    user = getattr(request.state, "user", None)
    if not user or user.get("role") not in ["admin", "owner", "developer"]:
        raise HTTPException(status_code=403, detail="No permission")

    try:
        nfts_table = await get_nfts_table()

        # Build query
        query = nfts_table.select('*')
        if wallet_address:
            query = query.eq('wallet_address', wallet_address)
        if status and status != "all":
            query = query.eq('status', status)

        # Calculate pagination
        skip = (page - 1) * limit
        total = await query.execute()
        
        # Get NFTs
        response = await query.range(skip, skip + limit - 1).execute()
        nfts = response.data
        
        return {
            "nfts": nfts,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
        
    except Exception as e:
        api_logger.error(f"Error in list_nfts: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/nfts/{nft_id}")
async def get_nft(
    request: Request,
    nft_id: str
):
    """Get NFT details by ID"""
    # Kiểm tra quyền admin
    user = getattr(request.state, "user", None)
    if not user or user.get("role") not in ["admin", "owner", "developer"]:
        raise HTTPException(status_code=403, detail="No permission")

    try:
        nfts_table = await get_nfts_table()
        response = await nfts_table.select('*').eq('id', nft_id).execute()
        nft = response.data[0] if response.data else None
        
        if not nft:
            raise HTTPException(status_code=404, detail="NFT not found")
            
        return nft
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in get_nft: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/nfts", dependencies=[Depends(require_admin)])
async def create_nft(
    request: Request,
    nft_data: dict = Body(...)
):
    """Create a new NFT"""
    try:
        nfts_table = await get_nfts_table()
        
        # Add creation timestamp
        nft_data["created_at"] = get_vietnam_time().isoformat()
        nft_data["updated_at"] = nft_data["created_at"]
        
        # Insert NFT
        result = await nfts_table.insert(nft_data).execute()
        
        # Get created NFT
        response = await nfts_table.select('*').eq('id', result.data['id']).execute()
        created_nft = response.data[0] if response.data else None
        
        return created_nft
        
    except Exception as e:
        api_logger.error(f"Error in create_nft: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.patch("/nfts/{nft_id}", dependencies=[Depends(require_admin)])
async def update_nft(
    request: Request,
    nft_id: str,
    nft_data: dict = Body(...)
):
    """Update NFT details"""
    try:
        nfts_table = await get_nfts_table()
        
        # Check if NFT exists
        response = await nfts_table.select('*').eq('id', nft_id).execute()
        nft = response.data[0] if response.data else None
        if not nft:
            raise HTTPException(status_code=404, detail="NFT not found")
        
        # Add update timestamp
        nft_data["updated_at"] = get_vietnam_time().isoformat()
        
        # Update NFT
        result = await nfts_table.update(nft_data).eq('id', nft_id).execute()
        
        if result.data['count'] == 0:
            raise HTTPException(status_code=400, detail="No changes made")
            
        # Get updated NFT
        response = await nfts_table.select('*').eq('id', nft_id).execute()
        updated_nft = response.data[0] if response.data else None
        
        return updated_nft
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in update_nft: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/nfts/{nft_id}", dependencies=[Depends(require_admin)])
async def delete_nft(
    request: Request,
    nft_id: str
):
    """Delete an NFT"""
    try:
        nfts_table = await get_nfts_table()
        
        # Check if NFT exists
        response = await nfts_table.select('*').eq('id', nft_id).execute()
        nft = response.data[0] if response.data else None
        if not nft:
            raise HTTPException(status_code=404, detail="NFT not found")
            
        # Delete NFT
        result = await nfts_table.delete().eq('id', nft_id).execute()
        
        if result.data['count'] == 0:
            raise HTTPException(status_code=400, detail="Failed to delete NFT")
            
        return {"message": "NFT deleted successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in delete_nft: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/nfts/{nft_id}/activate")
async def activate_nft(
    request: Request,
    nft_id: str
):
    """Activate an NFT"""
    try:
        nfts_table = await get_nfts_table()
        
        # Check if NFT exists
        response = await nfts_table.select('*').eq('id', nft_id).execute()
        nft = response.data[0] if response.data else None
        if not nft:
            raise HTTPException(status_code=404, detail="NFT not found")
            
        # Update NFT status
        result = await nfts_table.update({
            "status": "active",
            "updated_at": get_vietnam_time().isoformat()
        }).eq('id', nft_id).execute()
        
        if result.data['count'] == 0:
            raise HTTPException(status_code=400, detail="Failed to activate NFT")
            
        return {"message": "NFT activated successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in activate_nft: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/nfts/{nft_id}/deactivate")
async def deactivate_nft(
    request: Request,
    nft_id: str
):
    """Deactivate an NFT"""
    try:
        nfts_table = await get_nfts_table()
        
        # Check if NFT exists
        response = await nfts_table.select('*').eq('id', nft_id).execute()
        nft = response.data[0] if response.data else None
        if not nft:
            raise HTTPException(status_code=404, detail="NFT not found")
            
        # Update NFT status
        result = await nfts_table.update({
            "status": "inactive",
            "updated_at": get_vietnam_time().isoformat()
        }).eq('id', nft_id).execute()
        
        if result.data['count'] == 0:
            raise HTTPException(status_code=400, detail="Failed to deactivate NFT")
            
        return {"message": "NFT deactivated successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in deactivate_nft: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/nfts/collection", dependencies=[Depends(require_admin)])
async def create_nft_collection(
    request: Request,
    collection_data: dict = Body(...)
):
    """Create a new NFT collection"""
    try:
        nfts_table = await get_nfts_table()
        
        # Validate required fields
        required_fields = ["name", "contract_address", "chain", "description", "image_url"]
        for field in required_fields:
            if field not in collection_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

        # Add collection metadata
        collection_data.update({
            "type": "collection",
            "created_at": get_vietnam_time().isoformat(),
            "updated_at": get_vietnam_time().isoformat(),
            "status": "active",
            "total_nfts": 0,
            "owner_address": collection_data.get("owner_address", user.get("evm_address"))
        })

        # Insert collection
        result = await nfts_table.insert(collection_data).execute()
        
        # Get created collection
        response = await nfts_table.select('*').eq('id', result.data['id']).execute()
        created_collection = response.data[0] if response.data else None
        
        return created_collection
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in create_nft_collection: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/nfts/collections")
async def list_nft_collections(
    request: Request,
    owner_address: Optional[str] = Query(None, description="Filter by owner address"),
    chain: Optional[str] = Query(None, description="Filter by blockchain"),
    status: Optional[str] = Query(None, description="Filter by status (active/inactive)"),
    page: int = Query(1, description="Page number"),
    limit: int = Query(10, description="Items per page")
):
    """List all NFT collections with filtering and pagination"""
    # Kiểm tra quyền admin
    user = getattr(request.state, "user", None)
    if not user or user.get("role") not in ["admin", "owner", "developer"]:
        raise HTTPException(status_code=403, detail="No permission")

    try:
        nfts_table = await get_nfts_table()

        # Build query
        query = nfts_table.select('*').eq('type', 'collection')
        if owner_address:
            query = query.eq('owner_address', owner_address)
        if chain:
            query = query.eq('chain', chain)
        if status:
            query = query.eq('status', status)

        # Calculate pagination
        skip = (page - 1) * limit
        total = await query.execute()
        
        # Get collections
        response = await query.range(skip, skip + limit - 1).execute()
        collections = response.data
        
        return {
            "collections": collections,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
        
    except Exception as e:
        api_logger.error(f"Error in list_nft_collections: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.patch("/nfts/collection/{collection_id}", dependencies=[Depends(require_admin)])
async def update_nft_collection(
    request: Request,
    collection_id: str,
    collection_data: dict = Body(...)
):
    """Update NFT collection details"""
    try:
        nfts_table = await get_nfts_table()
        
        # Check if collection exists
        response = await nfts_table.select('*').eq('id', collection_id).eq('type', 'collection').execute()
        collection = response.data[0] if response.data else None
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        
        # Add update timestamp
        collection_data["updated_at"] = get_vietnam_time().isoformat()
        
        # Update collection
        result = await nfts_table.update(collection_data).eq('id', collection_id).eq('type', 'collection').execute()
        
        if result.data['count'] == 0:
            raise HTTPException(status_code=400, detail="No changes made")
            
        # Get updated collection
        response = await nfts_table.select('*').eq('id', collection_id).eq('type', 'collection').execute()
        updated_collection = response.data[0] if response.data else None
        
        return updated_collection
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in update_nft_collection: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/nfts/collection/{collection_id}", dependencies=[Depends(require_admin)])
async def delete_nft_collection(
    request: Request,
    collection_id: str
):
    """Delete an NFT collection and all its NFTs"""
    try:
        nfts_table = await get_nfts_table()
        
        # Check if collection exists
        response = await nfts_table.select('*').eq('id', collection_id).eq('type', 'collection').execute()
        collection = response.data[0] if response.data else None
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
            
        # Delete collection and all its NFTs
        result = await nfts_table.delete().eq('id', collection_id).eq('type', 'collection').execute()
        
        if result.data['count'] == 0:
            raise HTTPException(status_code=400, detail="Failed to delete collection")
            
        return {"message": "Collection and its NFTs deleted successfully"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        api_logger.error(f"Error in delete_nft_collection: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/dashboard-stats")
async def dashboard_stats(request: Request):
    """Tổng hợp thống kê cho dashboard admin"""
    # Kiểm tra quyền admin
    user = getattr(request.state, 'user', None)
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin privileges required')
    try:
        users_table = await get_users_table()
        vip_codes_table = await get_vip_codes_table()
        pro_codes_table = await get_pro_codes_table()
        nfts_table = await get_nfts_table()

        user_count = await users_table.count().execute()
        vip_code_count = await vip_codes_table.count().execute()
        pro_code_count = await pro_codes_table.count().execute()
        code_count = vip_code_count + pro_code_count
        nft_count = await nfts_table.count().execute()

        return {
            "userCount": user_count,
            "codeCount": code_count,
            "nftCount": nft_count
        }
    except Exception as e:
        api_logger.error(f"Error in dashboard_stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") 