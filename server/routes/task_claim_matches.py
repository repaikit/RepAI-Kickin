from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timedelta
from database.database import get_database

router = APIRouter()

CLAIM_INTERVAL_HOURS = 5
CLAIM_AMOUNT = 50

@router.get("/tasks/claim-matches-status")
async def claim_matches_status(request: Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authorized")
    last_claim = user.get("last_claim_matches")
    now = datetime.utcnow()
    if not last_claim:
        can_claim = True
        next_claim = None
        time_until_claim = 0
    else:
        if isinstance(last_claim, str):
            last_claim = datetime.fromisoformat(last_claim)
        can_claim = (now - last_claim) >= timedelta(hours=CLAIM_INTERVAL_HOURS)
        next_claim = last_claim + timedelta(hours=CLAIM_INTERVAL_HOURS)
        time_until_claim = int((next_claim - now).total_seconds()) if not can_claim else 0
    return {
        "success": True,
        "data": {
            "can_claim": can_claim,
            "next_claim": next_claim.replace(microsecond=0).isoformat() + "Z" if next_claim else None,
            "time_until_claim": time_until_claim
        }
    }

@router.post("/tasks/claim-matches")
async def claim_matches(request: Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authorized")
    db = await get_database()
    last_claim = user.get("last_claim_matches")
    now = datetime.utcnow()
    if last_claim:
        if isinstance(last_claim, str):
            last_claim = datetime.fromisoformat(last_claim)
        if (now - last_claim) < timedelta(hours=CLAIM_INTERVAL_HOURS):
            next_claim = last_claim + timedelta(hours=CLAIM_INTERVAL_HOURS)
            time_until_claim = int((next_claim - now).total_seconds())
            return {
                "success": False,
                "message": "You need to wait before claiming again.",
                "next_claim": next_claim.replace(microsecond=0).isoformat() + "Z",
                "time_until_claim": time_until_claim
            }
    # Cộng 50 matches và cập nhật last_claim_matches
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$inc": {"remaining_matches": CLAIM_AMOUNT},
            "$set": {"last_claim_matches": now}
        }
    )
    return {
        "success": True,
        "data": {
            "claimed": CLAIM_AMOUNT,
            "now": now.replace(microsecond=0).isoformat() + "Z"
        }
    }