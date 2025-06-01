from fastapi import APIRouter, HTTPException, Request, Depends, Body, Query
from typing import Optional, List
from models.user import User, UserUpdate
from models.invite_codes.vip_codes import VIPInviteCode
from models.nft import NFT
from database.database import get_users_collection, get_vip_codes_collection, get_pro_codes_collection, get_nfts_collection
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
        users_collection = await get_users_collection()
        
        # Xây dựng query filter
        query = {}
        if filter.user_type and filter.user_type != "all":
            query["user_type"] = filter.user_type
        if filter.role and filter.role != "all":
            query["role"] = filter.role
        if filter.is_active is not None:
            query["is_active"] = filter.is_active
            
        # Tìm kiếm theo tên, email hoặc wallet
        if filter.search:
            search_query = {
                "$or": [
                    {"name": {"$regex": filter.search, "$options": "i"}},
                    {"email": {"$regex": filter.search, "$options": "i"}},
                    {"evm_address": {"$regex": filter.search, "$options": "i"}},
                    {"sol_address": {"$regex": filter.search, "$options": "i"}},
                    {"sui_address": {"$regex": filter.search, "$options": "i"}}
                ]
            }
            query.update(search_query)
            
        # Tính toán skip và limit cho phân trang
        skip = (filter.page - 1) * filter.limit
        
        # Lấy tổng số users
        total = await users_collection.count_documents(query)
        
        # Lấy danh sách users
        users = await users_collection.find(query).skip(skip).limit(filter.limit).to_list(length=None)
        
        # Chuyển đổi ObjectId thành string
        for user in users:
            user["_id"] = str(user["_id"])
            
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
        users_collection = await get_users_collection()
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        user["_id"] = str(user["_id"])
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
        users_collection = await get_users_collection()
        
        # Kiểm tra user tồn tại
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Lấy dữ liệu cập nhật từ request body
        update_data = updates.model_dump(exclude_unset=True)
        
        # Thêm thời gian cập nhật
        update_data["updated_at"] = get_vietnam_time().isoformat()
        
        # Cập nhật user
        result = await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="No changes made")
            
        # Lấy thông tin user sau khi cập nhật
        updated_user = await users_collection.find_one({"_id": ObjectId(user_id)})
        updated_user["_id"] = str(updated_user["_id"])
        
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
        users_collection = await get_users_collection()
        
        # Kiểm tra user tồn tại
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Xóa user
        result = await users_collection.delete_one({"_id": ObjectId(user_id)})
        
        if result.deleted_count == 0:
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
        users_collection = await get_users_collection()
        
        # Kiểm tra user tồn tại
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Cập nhật trạng thái active
        result = await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "is_active": True,
                    "updated_at": get_vietnam_time().isoformat()
                }
            }
        )
        
        if result.modified_count == 0:
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
        users_collection = await get_users_collection()
        
        # Kiểm tra user tồn tại
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Cập nhật trạng thái active
        result = await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "is_active": False,
                    "updated_at": get_vietnam_time().isoformat()
                }
            }
        )
        
        if result.modified_count == 0:
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
        users_collection = await get_users_collection()
        
        # Kiểm tra user tồn tại
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Cập nhật role thành admin
        result = await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "role": "admin",
                    "updated_at": get_vietnam_time().isoformat()
                }
            }
        )
        
        if result.modified_count == 0:
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
        users_collection = await get_users_collection()
        
        # Kiểm tra user tồn tại
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Cập nhật role thành user
        result = await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "role": "user",
                    "updated_at": get_vietnam_time().isoformat()
                }
            }
        )
        
        if result.modified_count == 0:
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
        collection = get_vip_codes_collection() if code_type.upper() == "VIP" else get_pro_codes_collection()
        codes_collection = await collection

        # Build query
        query = {}
        if status and status != "all":
            query["status"] = status

        # Calculate pagination
        skip = (page - 1) * limit
        total = await codes_collection.count_documents(query)
        
        # Get codes
        codes = await codes_collection.find(query).skip(skip).limit(limit).to_list(length=None)
        
        # Convert ObjectId to string
        for code in codes:
            code["_id"] = str(code["_id"])
            
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
        collection = get_vip_codes_collection() if code_type.upper() == "VIP" else get_pro_codes_collection()
        codes_collection = await collection
        
        codes = []
        code_prefix = prefix or code_type.upper()
        
        for _ in range(count):
            code = generate_code(prefix=code_prefix)
            code_doc = VIPInviteCode(code=code)
            await codes_collection.insert_one(code_doc.to_dict())
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
        collection = get_vip_codes_collection() if code_type.upper() == "VIP" else get_pro_codes_collection()
        codes_collection = await collection
        
        result = await codes_collection.delete_one({"_id": ObjectId(code_id)})
        if result.deleted_count == 0:
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
        nfts_collection = await get_nfts_collection()

        # Build query
        query = {}
        if wallet_address:
            query["wallet_address"] = wallet_address
        if status and status != "all":
            query["status"] = status

        # Calculate pagination
        skip = (page - 1) * limit
        total = await nfts_collection.count_documents(query)
        
        # Get NFTs
        nfts = await nfts_collection.find(query).skip(skip).limit(limit).to_list(length=None)
        
        # Convert ObjectId to string
        for nft in nfts:
            nft["_id"] = str(nft["_id"])
            
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
        nfts_collection = await get_nfts_collection()
        nft = await nfts_collection.find_one({"_id": ObjectId(nft_id)})
        
        if not nft:
            raise HTTPException(status_code=404, detail="NFT not found")
            
        nft["_id"] = str(nft["_id"])
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
        nfts_collection = await get_nfts_collection()
        
        # Add creation timestamp
        nft_data["created_at"] = get_vietnam_time().isoformat()
        nft_data["updated_at"] = nft_data["created_at"]
        
        # Insert NFT
        result = await nfts_collection.insert_one(nft_data)
        
        # Get created NFT
        created_nft = await nfts_collection.find_one({"_id": result.inserted_id})
        created_nft["_id"] = str(created_nft["_id"])
        
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
        nfts_collection = await get_nfts_collection()
        
        # Check if NFT exists
        nft = await nfts_collection.find_one({"_id": ObjectId(nft_id)})
        if not nft:
            raise HTTPException(status_code=404, detail="NFT not found")
        
        # Add update timestamp
        nft_data["updated_at"] = get_vietnam_time().isoformat()
        
        # Update NFT
        result = await nfts_collection.update_one(
            {"_id": ObjectId(nft_id)},
            {"$set": nft_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="No changes made")
            
        # Get updated NFT
        updated_nft = await nfts_collection.find_one({"_id": ObjectId(nft_id)})
        updated_nft["_id"] = str(updated_nft["_id"])
        
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
        nfts_collection = await get_nfts_collection()
        
        # Check if NFT exists
        nft = await nfts_collection.find_one({"_id": ObjectId(nft_id)})
        if not nft:
            raise HTTPException(status_code=404, detail="NFT not found")
            
        # Delete NFT
        result = await nfts_collection.delete_one({"_id": ObjectId(nft_id)})
        
        if result.deleted_count == 0:
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
        nfts_collection = await get_nfts_collection()
        
        # Check if NFT exists
        nft = await nfts_collection.find_one({"_id": ObjectId(nft_id)})
        if not nft:
            raise HTTPException(status_code=404, detail="NFT not found")
            
        # Update NFT status
        result = await nfts_collection.update_one(
            {"_id": ObjectId(nft_id)},
            {
                "$set": {
                    "status": "active",
                    "updated_at": get_vietnam_time().isoformat()
                }
            }
        )
        
        if result.modified_count == 0:
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
        nfts_collection = await get_nfts_collection()
        
        # Check if NFT exists
        nft = await nfts_collection.find_one({"_id": ObjectId(nft_id)})
        if not nft:
            raise HTTPException(status_code=404, detail="NFT not found")
            
        # Update NFT status
        result = await nfts_collection.update_one(
            {"_id": ObjectId(nft_id)},
            {
                "$set": {
                    "status": "inactive",
                    "updated_at": get_vietnam_time().isoformat()
                }
            }
        )
        
        if result.modified_count == 0:
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
        nfts_collection = await get_nfts_collection()
        
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
        result = await nfts_collection.insert_one(collection_data)
        
        # Get created collection
        created_collection = await nfts_collection.find_one({"_id": result.inserted_id})
        created_collection["_id"] = str(created_collection["_id"])
        
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
        nfts_collection = await get_nfts_collection()

        # Build query
        query = {"type": "collection"}
        if owner_address:
            query["owner_address"] = owner_address
        if chain:
            query["chain"] = chain
        if status:
            query["status"] = status

        # Calculate pagination
        skip = (page - 1) * limit
        total = await nfts_collection.count_documents(query)
        
        # Get collections
        collections = await nfts_collection.find(query).skip(skip).limit(limit).to_list(length=None)
        
        # Convert ObjectId to string
        for collection in collections:
            collection["_id"] = str(collection["_id"])
            
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
        nfts_collection = await get_nfts_collection()
        
        # Check if collection exists
        collection = await nfts_collection.find_one({
            "_id": ObjectId(collection_id),
            "type": "collection"
        })
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        
        # Add update timestamp
        collection_data["updated_at"] = get_vietnam_time().isoformat()
        
        # Update collection
        result = await nfts_collection.update_one(
            {"_id": ObjectId(collection_id)},
            {"$set": collection_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="No changes made")
            
        # Get updated collection
        updated_collection = await nfts_collection.find_one({"_id": ObjectId(collection_id)})
        updated_collection["_id"] = str(updated_collection["_id"])
        
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
        nfts_collection = await get_nfts_collection()
        
        # Check if collection exists
        collection = await nfts_collection.find_one({
            "_id": ObjectId(collection_id),
            "type": "collection"
        })
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
            
        # Delete collection and all its NFTs
        result = await nfts_collection.delete_many({
            "$or": [
                {"_id": ObjectId(collection_id)},
                {"collection_id": collection_id}
            ]
        })
        
        if result.deleted_count == 0:
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
        users_collection = await get_users_collection()
        vip_codes_collection = await get_vip_codes_collection()
        pro_codes_collection = await get_pro_codes_collection()
        nfts_collection = await get_nfts_collection()

        user_count = await users_collection.count_documents({})
        vip_code_count = await vip_codes_collection.count_documents({})
        pro_code_count = await pro_codes_collection.count_documents({})
        code_count = vip_code_count + pro_code_count
        nft_count = await nfts_collection.count_documents({})

        return {
            "userCount": user_count,
            "codeCount": code_count,
            "nftCount": nft_count
        }
    except Exception as e:
        api_logger.error(f"Error in dashboard_stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error") 