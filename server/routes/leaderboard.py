from fastapi import APIRouter, Query
from database.database import get_database
from bson import ObjectId

router = APIRouter()

@router.get("/leaderboard/weekly")
async def get_weekly_leaderboard(
    week: str = Query(..., description="Mã tuần, ví dụ: 2025-21"),
    board: str = Query(..., description="BASIC | PRO | VIP")
):
    db = await get_database()
    doc = await db.leaderboard_weekly.find_one({"week": week, "board": board.upper()})
    if not doc:
        return {"week": week, "board": board, "top_10": []}
    user_ids = [entry["user_id"] for entry in doc["top_10"]]
    users = await db.users.find({"_id": {"$in": [ObjectId(uid) for uid in user_ids]}}).to_list(length=len(user_ids))
    user_map = {str(u["_id"]): u for u in users}
    result = []
    for entry in doc["top_10"]:
        user = user_map.get(entry["user_id"], {})
        result.append({
            "user_id": entry["user_id"],
            "rank": entry["rank"],
            "name": user.get("name", ""),
            "avatar": user.get("avatar", ""),
            "level": user.get("level", 1),
            "total_point": entry.get("total_point", 0),
            "kicked_win": entry.get("kicked_win", 0),
            "keep_win": entry.get("keep_win", 0),
            "bonus_point": entry.get("bonus_point", 0)
        })
    return {
        "week": doc["week"],
        "board": doc["board"],
        "top_10": result
    }

@router.get("/leaderboard/monthly")
async def get_monthly_leaderboard(
    year: int = Query(..., description="Năm, ví dụ: 2025"),
    month: int = Query(..., description="Tháng, ví dụ: 5"),
    board: str = Query(..., description="BASIC | PRO | VIP")
):
    db = await get_database()
    doc = await db.leaderboard_monthly.find_one({"year": year, "month": month, "board": board.upper()})
    if not doc:
        return {"year": year, "month": month, "board": board, "top_10": []}
    user_ids = [entry["user_id"] for entry in doc["top_10"]]
    users = await db.users.find({"_id": {"$in": [ObjectId(uid) for uid in user_ids]}}).to_list(length=len(user_ids))
    user_map = {str(u["_id"]): u for u in users}
    result = []
    for entry in doc["top_10"]:
        user = user_map.get(entry["user_id"], {})
        result.append({
            "user_id": entry["user_id"],
            "rank": entry["rank"],
            "bonus_point": entry.get("bonus_point", 0),
            "name": user.get("name", ""),
            "avatar": user.get("avatar", ""),
            "level": user.get("level", 1),
            "total_point": entry.get("total_point", 0),
            "kicked_win": entry.get("kicked_win", 0),
            "keep_win": entry.get("keep_win", 0)
        })
    return {
        "year": doc["year"],
        "month": doc["month"],
        "board": doc["board"],
        "top_10": result
    } 