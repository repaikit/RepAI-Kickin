from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
from database.database import get_database
from utils.logger import api_logger
from bson import ObjectId
import random

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
    now = datetime.utcnow()
    
    # If never opened or last open was more than 5 hours ago
    can_open = not last_open or (now - last_open) > timedelta(hours=5)
    
    if can_open:
        next_open = None
        time_until_open = 0
    else:
        next_open = last_open + timedelta(hours=5)
        time_until_open = int((next_open - now).total_seconds())
    
    return {
        "success": True,
        "data": {
            "can_open": can_open,
            "next_open": next_open.replace(microsecond=0).isoformat() + "Z" if next_open else None,
            "time_until_open": time_until_open
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
    
    # Check if user can open box
    last_open = user.get("last_box_open")
    now = datetime.utcnow()
    
    if last_open and (now - last_open) <= timedelta(hours=5):
        raise HTTPException(status_code=400, detail="Must wait 5 hours between box opens")
    
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
                    "$set": {"last_box_open": now}
                }
            )
        else:
            await db.users.update_one(
                {"_id": user["_id"]},
                {
                    "$push": {"goalkeeper_skills": reward["name"]},
                    "$set": {"last_box_open": now}
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
                        "opened_at": now.isoformat()
                    }
                }
            }
        )
        
        return {
            "success": True,
            "data": {
                "reward_type": "skill",
                "skill_type": skill_type,
                "skill_name": reward["name"],
                "skill_value": reward["point"]
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
                "$set": {"last_box_open": now}
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
                        "opened_at": now.isoformat()
                    }
                }
            }
        )
        
        return {
            "success": True,
            "data": {
                "reward_type": "remaining_matches",
                "amount": matches
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