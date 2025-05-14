from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import List, Optional
from server.models.user import User, UserCreate, UserUpdate
from database.database import get_users_collection, get_skills_collection
from bson import ObjectId
from utils.logger import api_logger
from datetime import datetime, timedelta
import uuid
import random
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr

class PrivyUserInfo(BaseModel):
    privy_id: str
    email: Optional[str] = None
    wallet: Optional[str] = None
    name: Optional[str] = None
    is_verified: bool = True  # Frontend đã xác thực qua Privy

class UserResponse(BaseModel):
    total: int
    users: List[User]
    page: int
    size: int

class ConvertGuestRequest(BaseModel):
    session_id: str
    privy_info: PrivyUserInfo

router = APIRouter()

@router.post("/guest", response_model=User)
async def create_guest_user(request: Request):
    """Create a new guest user with random skills"""
    try:
        # Generate session ID
        session_id = str(uuid.uuid4())
        
        # Get random kicker and goalkeeper skills
        users_collection = await get_users_collection()
        skills_collection = await get_skills_collection()
        
        kicker_skills = await skills_collection.find({"type": "kicker"}).to_list(length=None)
        goalkeeper_skills = await skills_collection.find({"type": "goalkeeper"}).to_list(length=None)
        
        if not kicker_skills or not goalkeeper_skills:
            raise HTTPException(status_code=500, detail="No skills found in database")
        
        # Select random skills
        random_kicker = random.choice(kicker_skills)
        random_goalkeeper = random.choice(goalkeeper_skills)
        
        # Generate random avatar using Dicebear
        avatar_seed = str(uuid.uuid4())
        avatar_url = f"https://api.dicebear.com/7.x/adventurer/svg?seed={avatar_seed}"
        
        # Create guest user
        guest_user_data = UserCreate(
            session_id=session_id,
            guest_created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=7),  # Guest user expires in 7 days
            kicker_skills=[random_kicker["name"]],
            goalkeeper_skills=[random_goalkeeper["name"]],
            avatar=avatar_url,
            device_info={
                "user_agent": request.headers.get("user-agent"),
                "ip": request.client.host if request.client else None
            }
        ).dict(by_alias=True)
        
        # Insert into database
        result = await users_collection.insert_one(guest_user_data)
        
        # Get created user
        created_user = await users_collection.find_one({"_id": result.inserted_id})
        return User(**created_user)
    except Exception as e:
        api_logger.error(f"Error creating guest user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/guest/{session_id}", response_model=User)
async def get_guest_user(session_id: str):
    """Get guest user by session ID"""
    try:
        users_collection = await get_users_collection()
        user = await users_collection.find_one({"session_id": session_id})
        
        if not user:
            raise HTTPException(status_code=404, detail="Guest user not found")
            
        return User(**user)
    except Exception as e:
        api_logger.error(f"Error getting guest user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/convert-guest", response_model=User)
async def convert_guest_to_user(request: ConvertGuestRequest):
    """Convert guest user to regular user using Privy info from frontend"""
    try:
        users_collection = await get_users_collection()
        
        # Find guest user
        guest_user = await users_collection.find_one({"session_id": request.session_id})
        if not guest_user:
            raise HTTPException(status_code=404, detail="Guest user not found")
            
        # Check if user already exists with same Privy ID
        existing_user = await users_collection.find_one({"privy_id": request.privy_info.privy_id})
        if existing_user:
            raise HTTPException(status_code=400, detail="User already registered with this Privy ID")
        
        # Update user with Privy info
        update_data = {
            "user_type": "user",
            "converted_to_user": True,
            "converted_at": datetime.utcnow(),
            "privy_id": request.privy_info.privy_id,
            "is_verified": request.privy_info.is_verified
        }
        
        if request.privy_info.email:
            update_data["email"] = request.privy_info.email
        if request.privy_info.wallet:
            update_data["wallet"] = request.privy_info.wallet
        if request.privy_info.name:
            update_data["name"] = request.privy_info.name
            
        await users_collection.update_one(
            {"session_id": request.session_id},
            {"$set": update_data}
        )
        
        # Get updated user
        updated_user = await users_collection.find_one({"session_id": request.session_id})
        return User(**updated_user)
    except Exception as e:
        api_logger.error(f"Error converting guest user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/me", response_model=User)
async def get_current_user(session_id: str):
    """Get current user by session ID"""
    try:
        users_collection = await get_users_collection()
        user = await users_collection.find_one({"session_id": session_id})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        return User(**user)
    except Exception as e:
        api_logger.error(f"Error getting current user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/me", response_model=User)
async def update_user(session_id: str, user_update: UserUpdate):
    """Update user information"""
    try:
        users_collection = await get_users_collection()
        
        # Find user
        user = await users_collection.find_one({"session_id": session_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Update user
        update_data = user_update.dict(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        await users_collection.update_one(
            {"session_id": session_id},
            {"$set": update_data}
        )
        
        # Get updated user
        updated_user = await users_collection.find_one({"session_id": session_id})
        return User(**updated_user)
    except Exception as e:
        api_logger.error(f"Error updating user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/me")
async def delete_user(session_id: str):
    """Delete user account"""
    try:
        users_collection = await get_users_collection()
        
        # Find user
        user = await users_collection.find_one({"session_id": session_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Delete user
        await users_collection.delete_one({"session_id": session_id})
        
        return JSONResponse(
            status_code=200,
            content={"message": "User deleted successfully"}
        )
    except Exception as e:
        api_logger.error(f"Error deleting user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/users", response_model=UserResponse)
async def get_users(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    user_type: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc"
):
    """Get list of users with pagination and filtering"""
    try:
        users_collection = await get_users_collection()
        
        # Build query
        query = {}
        if user_type:
            query["user_type"] = user_type
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"wallet": {"$regex": search, "$options": "i"}}
            ]
            
        # Calculate skip
        skip = (page - 1) * size
        
        # Get total count
        total = await users_collection.count_documents(query)
        
        # Get users
        sort_direction = -1 if sort_order == "desc" else 1
        users = await users_collection.find(query).sort(sort_by, sort_direction).skip(skip).limit(size).to_list(length=None)
        
        return UserResponse(
            total=total,
            users=[User(**user) for user in users],
            page=page,
            size=size
        )
    except Exception as e:
        api_logger.error(f"Error getting users: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/users/{user_id}", response_model=User)
async def get_user_by_id(user_id: str):
    """Get user by ID"""
    try:
        users_collection = await get_users_collection()
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        return User(**user)
    except Exception as e:
        api_logger.error(f"Error getting user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/users/privy/{privy_id}", response_model=User)
async def get_user_by_privy_id(privy_id: str):
    """Get user by Privy ID"""
    try:
        users_collection = await get_users_collection()
        user = await users_collection.find_one({"privy_id": privy_id})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        return User(**user)
    except Exception as e:
        api_logger.error(f"Error getting user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/users/email/{email}", response_model=User)
async def get_user_by_email(email: EmailStr):
    """Get user by email"""
    try:
        users_collection = await get_users_collection()
        user = await users_collection.find_one({"email": email})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        return User(**user)
    except Exception as e:
        api_logger.error(f"Error getting user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/users/wallet/{wallet}", response_model=User)
async def get_user_by_wallet(wallet: str):
    """Get user by wallet address"""
    try:
        users_collection = await get_users_collection()
        user = await users_collection.find_one({"wallet": wallet})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        return User(**user)
    except Exception as e:
        api_logger.error(f"Error getting user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/users/{user_id}", response_model=User)
async def update_user_by_id(user_id: str, user_update: UserUpdate):
    """Update user by ID"""
    try:
        users_collection = await get_users_collection()
        
        # Find user
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Update user
        update_data = user_update.dict(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        
        # Get updated user
        updated_user = await users_collection.find_one({"_id": ObjectId(user_id)})
        return User(**updated_user)
    except Exception as e:
        api_logger.error(f"Error updating user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/users/{user_id}")
async def delete_user_by_id(user_id: str):
    """Delete user by ID"""
    try:
        users_collection = await get_users_collection()
        
        # Find user
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        # Delete user
        await users_collection.delete_one({"_id": ObjectId(user_id)})
        
        return JSONResponse(
            status_code=200,
            content={"message": "User deleted successfully"}
        )
    except Exception as e:
        api_logger.error(f"Error deleting user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


