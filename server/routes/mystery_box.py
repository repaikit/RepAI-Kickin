from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
from database.database import get_database
from utils.logger import api_logger
from bson import ObjectId
import random
from utils.time_utils import get_vietnam_time, to_vietnam_time, format_vietnam_time
from ws_handlers.waiting_room import manager as waiting_room_manager

router = APIRouter()

class BoxOpenRequest(BaseModel):
    is_free: bool = True

@router.get("/status")
async def get_box_status(request: Request):
    """
    Get mystery box status for current user
    """
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authorized")
    
    db = await get_database()
    
    # Get user's last box open time
    last_open = user.get("last_box_open")
    
    # Get current time in Vietnam timezone
    now = get_vietnam_time()
    
    # Calculate next open time
    next_open = None
    if last_open:
        # Convert last_open to Vietnam timezone if it's a string or naive datetime
        if isinstance(last_open, str):
            last_open = to_vietnam_time(datetime.fromisoformat(last_open.replace('Z', '+00:00')))
        elif isinstance(last_open, datetime) and last_open.tzinfo is None:
            last_open = to_vietnam_time(last_open)
            
        next_open = last_open + timedelta(hours=5)
        if next_open <= now:
            next_open = None
    
    return {
        "success": True,
        "data": {
            "can_open": next_open is None,
            "next_open": format_vietnam_time(next_open) if next_open else None,
            "time_until_open": int((next_open - now).total_seconds()) if next_open else 0
        }
    }

@router.post("/open")
async def open_box(request: Request, box_request: BoxOpenRequest):
    """
    Open mystery box
    """
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authorized")
    
    db = await get_database()
    
    # Get current time in Vietnam timezone
    now = get_vietnam_time()
    
    # Check if user can open box
    last_open = user.get("last_box_open")
    
    if last_open:
        # Convert last_open to Vietnam timezone if it's a string or naive datetime
        if isinstance(last_open, str):
            last_open = to_vietnam_time(datetime.fromisoformat(last_open.replace('Z', '+00:00')))
        elif isinstance(last_open, datetime) and last_open.tzinfo is None:
            last_open = to_vietnam_time(last_open)
            
        if (now - last_open) <= timedelta(hours=5):
            next_open = last_open + timedelta(hours=5)
            time_until_open = int((next_open - now).total_seconds())
            raise HTTPException(
                status_code=400, 
                detail=f"Must wait 5 hours between box opens. Next open time: {format_vietnam_time(next_open)}"
            )
    
    # Generate reward (only skill or remaining_matches)
    reward_type = random.choice(["skill", "remaining_matches"])
    
    if reward_type == "skill":
        # Randomly choose between kicker and goalkeeper skills
        skill_type = random.choice(["kicker", "goalkeeper"])
        
        # Get skills based on type
        skills = await db.skills.find({"type": skill_type}).to_list(length=None)
        if not skills:
            raise HTTPException(status_code=500, detail=f"No {skill_type} skills available")
        
        # Lọc skill theo mốc point từng level
        user_level = user.get("level", 1)
        if user_level < 4:
            available_skills = [s for s in skills if 100 <= s.get("point", 0) <= 120]
        else:
            available_skills = [s for s in skills if 121 <= s.get("point", 0) <= 150]
        if not available_skills:
            raise HTTPException(status_code=500, detail="No suitable skills available for your level")
        
        # Select random skill
        reward = random.choice(available_skills)
        
        # Add skill to user's collection
        if skill_type == "kicker":
            await db.users.update_one(
                {"_id": user["_id"]},
                {
                    "$push": {"kicker_skills": reward["name"]},
                    "$set": {
                        "last_box_open": format_vietnam_time(now),
                        "next_box_open": format_vietnam_time(now + timedelta(hours=5))
                    }
                }
            )
        else:
            await db.users.update_one(
                {"_id": user["_id"]},
                {
                    "$push": {"goalkeeper_skills": reward["name"]},
                    "$set": {
                        "last_box_open": format_vietnam_time(now),
                        "next_box_open": format_vietnam_time(now + timedelta(hours=5))
                    }
                }
            )
            
        # Add to mystery box history
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$push": {
                    "mystery_box_history": {
                        "reward_type": "skill",
                        "skill_type": skill_type,
                        "skill_name": reward["name"],
                        "skill_value": reward["point"],
                        "opened_at": format_vietnam_time(now)
                    }
                }
            }
        )
        # Broadcast user update
        updated_user = await db.users.find_one({"_id": user["_id"]})
        if waiting_room_manager:
            await waiting_room_manager.broadcast({
                "type": "user_updated",
                "user": {
                    "id": str(updated_user["_id"]),
                    "name": updated_user.get("name", "Anonymous"),
                    "avatar": updated_user.get("avatar", ""),
                    "user_type": updated_user.get("user_type", "guest"),
                    "remaining_matches": updated_user.get("remaining_matches", 0),
                    "level": updated_user.get("level", 1),
                    "kicker_skills": updated_user.get("kicker_skills", []),
                    "goalkeeper_skills": updated_user.get("goalkeeper_skills", []),
                    "total_point": updated_user.get("total_point", 0),
                }
            })
        return {
            "success": True,
            "data": {
                "reward_type": "skill",
                "skill_type": skill_type,
                "skill_name": reward["name"],
                "skill_value": reward["point"],
                "next_open": format_vietnam_time(now + timedelta(hours=5))
            }
        }
    else:  # remaining_matches
        # Get user's level to determine number of matches
        user_level = user.get("level", 1)
        matches = 5  # Default 5 matches for all levels
        
        # Add matches to user
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$inc": {"remaining_matches": matches},
                "$set": {
                    "last_box_open": format_vietnam_time(now),
                    "next_box_open": format_vietnam_time(now + timedelta(hours=5))
                }
            }
        )
        
        # Add to mystery box history
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$push": {
                    "mystery_box_history": {
                        "reward_type": "remaining_matches",
                        "amount": matches,
                        "opened_at": format_vietnam_time(now)
                    }
                }
            }
        )
        # Broadcast user update
        updated_user = await db.users.find_one({"_id": user["_id"]})
        if waiting_room_manager:
            await waiting_room_manager.broadcast({
                "type": "user_updated",
                "user": {
                    "id": str(updated_user["_id"]),
                    "name": updated_user.get("name", "Anonymous"),
                    "avatar": updated_user.get("avatar", ""),
                    "user_type": updated_user.get("user_type", "guest"),
                    "remaining_matches": updated_user.get("remaining_matches", 0),
                    "level": updated_user.get("level", 1),
                    "kicker_skills": updated_user.get("kicker_skills", []),
                    "goalkeeper_skills": updated_user.get("goalkeeper_skills", []),
                    "total_point": updated_user.get("total_point", 0),
                }
            })
        return {
            "success": True,
            "data": {
                "reward_type": "remaining_matches",
                "amount": matches,
                "next_open": format_vietnam_time(now + timedelta(hours=5))
            }
        }

@router.get("/history")
async def get_box_history(request: Request, limit: int = 10, skip: int = 0):
    """
    Get mystery box history for current user
    """
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authorized")
    
    try:
        history = user.get("mystery_box_history", [])
        total = len(history)
        
        # Sort by open time (newest first)
        history.sort(key=lambda x: x["opened_at"], reverse=True)
        
        # Paginate
        history = history[skip:skip + limit]
        
        return {
            "success": True,
            "data": {
                "history": history,
                "total": total,
                "limit": limit,
                "skip": skip
            }
        }
        
    except Exception as e:
        api_logger.error(f"[MysteryBox] Error getting history: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

    # Get current time in Vietnam timezone
    now = get_vietnam_time()

    # Update last open time
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "last_mystery_box_open": now.isoformat(),
                "opened_at": now.isoformat()
            }
        }
    ) 