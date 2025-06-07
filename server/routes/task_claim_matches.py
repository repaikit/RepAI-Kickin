from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional
from datetime import datetime, timedelta
from database.database import get_users_table
from utils.time_utils import get_vietnam_time, to_vietnam_time, format_vietnam_time
from utils.logger import api_logger
from ws_handlers.waiting_room import manager as waiting_room_manager

router = APIRouter()

CLAIM_INTERVAL_HOURS = 5
CLAIM_AMOUNT = 50

@router.get("/tasks/claim-matches-status")
async def claim_matches_status(request: Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authorized")
    last_claim = user.get("last_claim_matches")
    now = get_vietnam_time()
    if not last_claim:
        can_claim = True
        next_claim = None
        time_until_claim = 0
    else:
        # Convert last_claim to Vietnam timezone if it's a string or naive datetime
        if isinstance(last_claim, str):
            last_claim = to_vietnam_time(datetime.fromisoformat(last_claim.replace('Z', '+00:00')))
        elif isinstance(last_claim, datetime) and last_claim.tzinfo is None:
            last_claim = to_vietnam_time(last_claim)
            
        can_claim = (now - last_claim) >= timedelta(hours=CLAIM_INTERVAL_HOURS)
        next_claim = last_claim + timedelta(hours=CLAIM_INTERVAL_HOURS)
        time_until_claim = int((next_claim - now).total_seconds()) if not can_claim else 0
    return {
        "success": True,
        "data": {
            "can_claim": can_claim,
            "next_claim": format_vietnam_time(next_claim) if next_claim else None,
            "time_until_claim": time_until_claim
        }
    }

@router.post("/tasks/claim-matches")
async def claim_matches(request: Request):
    try:
        user = getattr(request.state, "user", None)
        if not user:
            raise HTTPException(status_code=401, detail="Not authorized")
            
        users_table = await get_users_table()
        last_claim = user.get("last_claim_matches")
        now = get_vietnam_time()
        
        if last_claim:
            # Convert last_claim to Vietnam timezone if it's a string or naive datetime
            if isinstance(last_claim, str):
                last_claim = to_vietnam_time(datetime.fromisoformat(last_claim.replace('Z', '+00:00')))
            elif isinstance(last_claim, datetime) and last_claim.tzinfo is None:
                last_claim = to_vietnam_time(last_claim)
                
            if (now - last_claim) < timedelta(hours=CLAIM_INTERVAL_HOURS):
                next_claim = last_claim + timedelta(hours=CLAIM_INTERVAL_HOURS)
                time_until_claim = int((next_claim - now).total_seconds())
                return {
                    "success": False,
                    "message": "You need to wait before claiming again.",
                    "next_claim": next_claim.isoformat(),
                    "time_until_claim": time_until_claim
                }
                
        # Cộng 50 matches và cập nhật last_claim_matches
        next_claim_time = now + timedelta(hours=CLAIM_INTERVAL_HOURS)
        update_data = {
            "remaining_matches": user.get("remaining_matches", 0) + CLAIM_AMOUNT,
            "last_claim_matches": now.isoformat(),
            "next_claim_matches": next_claim_time.isoformat()
        }
        
        # Update user
        response = await users_table.update(update_data).eq('id', user["id"]).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to update user")
            
        updated_user = response.data[0]
        
        # Broadcast user update
        if waiting_room_manager:
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
                }
            })
            
        return {
            "success": True,
            "data": {
                "claimed": CLAIM_AMOUNT,
                "now": format_vietnam_time(now)
            }
        }
    except Exception as e:
        api_logger.error(f"Error claiming matches: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))