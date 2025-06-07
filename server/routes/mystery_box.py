from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
from database.database import get_users_table, get_skills_table
from utils.logger import api_logger
import random
from utils.time_utils import get_vietnam_time, to_vietnam_time, format_vietnam_time
from ws_handlers.waiting_room import manager as waiting_room_manager

router = APIRouter()

class BoxOpenRequest(BaseModel):
    is_free: bool = True
    box_type: str = "regular"  # "regular" or "level_up"

def get_level_up_shots(level: int) -> int:
    """Get number of shots for level up mystery box based on user level"""
    if level == 1:
        return 5  # Special case for level 1
    elif level <= 3:
        return 20  # Level 2-3
    else:
        return 50  # Level 4+

@router.get("/status")
async def get_box_status(request: Request):
    """
    Get mystery box status for current user
    """
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authorized")
    
    # Get user's last box open time
    last_regular_open = user.get("last_regular_box_open")
    
    # Get current time in Vietnam timezone
    now = get_vietnam_time()
    
    # Calculate next open time for regular box (5 hours)
    next_regular_open = None
    if last_regular_open:
        if isinstance(last_regular_open, str):
            last_regular_open = to_vietnam_time(datetime.fromisoformat(last_regular_open.replace('Z', '+00:00')))
        elif isinstance(last_regular_open, datetime) and last_regular_open.tzinfo is None:
            last_regular_open = to_vietnam_time(last_regular_open)
            
        next_regular_open = last_regular_open + timedelta(hours=5)
        if next_regular_open <= now:
            next_regular_open = None

    # Get user's level and shots for level up box
    user_level = user.get("level", 1)
    level_up_shots = get_level_up_shots(user_level)
    can_open_level_up = user.get("can_open_level_up_box", False)
    
    return {
        "success": True,
        "data": {
            "regular": {
                "can_open": next_regular_open is None,
                "next_open": format_vietnam_time(next_regular_open) if next_regular_open else None,
                "time_until_open": int((next_regular_open - now).total_seconds()) if next_regular_open else 0,
                "shots": 5  # Regular box always gives 5 shots
            },
            "level_up": {
                "can_open": can_open_level_up,  # Only check this flag
                "shots": level_up_shots,
                "level": user_level,
                "description": f"Level {user_level} Mystery Box ({level_up_shots} shots)",
                "available": can_open_level_up
            }
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
    
    users_table = await get_users_table()
    skills_table = await get_skills_table()
    now = get_vietnam_time()
    
    # Check if user can open box
    if box_request.box_type == "level_up":
        # Only check can_open_level_up_box, ignore cooldown
        if not user.get("can_open_level_up_box", False):
            raise HTTPException(status_code=400, detail="Level up box is only available when leveling up")
        box_type = "level_up"
        user_level = user.get("level", 1)
        shots = get_level_up_shots(user_level)
    else:
        last_open = user.get("last_regular_box_open")
        box_type = "regular"
        shots = 5  # Regular box always gives 5 shots
        if last_open:
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
    
    try:
        # Generate reward
        reward_type = random.choice(["skill", "remaining_matches"])
        
        if reward_type == "skill":
            skill_type = random.choice(["kicker", "goalkeeper"])
            response = await skills_table.select('*').eq('type', skill_type).execute()
            skills = response.data
            if not skills:
                raise HTTPException(status_code=500, detail=f"No {skill_type} skills available")
            
            # Filter skills based on level and box type
            user_level = user.get("level", 1)
            if box_request.box_type == "level_up":
                # For level up box, get higher tier skills
                available_skills = [s for s in skills if s.get("point", 0) >= 150]
            else:
                # For regular box, use existing logic
                if user_level < 4:
                    available_skills = [s for s in skills if 100 <= s.get("point", 0) <= 120]
                else:
                    available_skills = [s for s in skills if 121 <= s.get("point", 0) <= 150]
            if not available_skills:
                raise HTTPException(status_code=500, detail="No suitable skills available for your level")
            reward = random.choice(available_skills)
            
            # Update user's skills
            update_data = {
                "last_regular_box_open" if box_type == "regular" else "last_level_up_box_open": format_vietnam_time(now),
                "next_regular_box_open" if box_type == "regular" else "next_level_up_box_open": format_vietnam_time(now + timedelta(hours=5))
            }
            if box_type == "level_up":
                update_data["can_open_level_up_box"] = False
                
            # Add skill to user's skills
            if skill_type == "kicker":
                kicker_skills = user.get("kicker_skills", [])
                kicker_skills.append(reward["name"])
                update_data["kicker_skills"] = kicker_skills
            else:
                goalkeeper_skills = user.get("goalkeeper_skills", [])
                goalkeeper_skills.append(reward["name"])
                update_data["goalkeeper_skills"] = goalkeeper_skills
                
            await users_table.update(update_data).eq('id', user["id"]).execute()
            
            # Add to mystery box history
            history_entry = {
                "reward_type": "skill",
                "skill_type": skill_type,
                "skill_name": reward["name"],
                "skill_value": reward["point"],
                "opened_at": format_vietnam_time(now),
                "box_type": box_type,
                "shots": shots
            }
        else:  # remaining_matches
            # Update user's remaining matches and box open time
            update_data = {
                "remaining_matches": user.get("remaining_matches", 0) + shots,
                "last_regular_box_open" if box_type == "regular" else "last_level_up_box_open": format_vietnam_time(now),
                "next_regular_box_open" if box_type == "regular" else "next_level_up_box_open": format_vietnam_time(now + timedelta(hours=5))
            }
            if box_type == "level_up":
                update_data["can_open_level_up_box"] = False
                
            await users_table.update(update_data).eq('id', user["id"]).execute()
            
            history_entry = {
                "reward_type": "remaining_matches",
                "amount": shots,
                "opened_at": format_vietnam_time(now),
                "box_type": box_type,
                "shots": shots
            }
            
        # Add to history
        mystery_box_history = user.get("mystery_box_history", [])
        mystery_box_history.append(history_entry)
        await users_table.update({"mystery_box_history": mystery_box_history}).eq('id', user["id"]).execute()
        
        # Get updated user data
        response = await users_table.select('*').eq('id', user["id"]).execute()
        updated_user = response.data[0] if response.data else None
        
        # Broadcast user update
        if waiting_room_manager and updated_user:
            await waiting_room_manager.broadcast({
                "type": "user_updated",
                "user": {
                    "id": updated_user["id"],
                    "name": updated_user.get("name", "Anonymous"),
                    "avatar": updated_user.get("avatar", ""),
                    "user_type": updated_user.get("user_type", "guest"),
                    "remaining_matches": updated_user.get("remaining_matches", 0),
                    "level": updated_user.get("level", 1),
                    "kicker_skills": updated_user.get("kicker_skills", []),
                    "goalkeeper_skills": updated_user.get("goalkeeper_skills", []),
                    "total_point": updated_user.get("total_point", 0),
                    "can_open_level_up_box": updated_user.get("can_open_level_up_box", False)
                }
            })
            
        return {
            "success": True,
            "data": {
                "reward_type": reward_type,
                "box_type": box_type,
                "next_open": format_vietnam_time(now + timedelta(hours=5)),
                "shots": shots,
                **({"skill_type": skill_type, "skill_name": reward["name"], "skill_value": reward["point"]} if reward_type == "skill" else {"amount": shots})
            }
        }
    except Exception as e:
        api_logger.error(f"Error opening mystery box: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
        api_logger.error(f"Error getting mystery box history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 