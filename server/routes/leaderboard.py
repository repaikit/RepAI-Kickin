from fastapi import APIRouter, Query
from database.database import get_leaderboard_weekly_table, get_leaderboard_monthly_table, get_users_table
from utils.logger import api_logger

router = APIRouter()

@router.get("/leaderboard/weekly")
async def get_weekly_leaderboard(
    week: str = Query(..., description="Mã tuần, ví dụ: 2025-21"),
    board: str = Query(..., description="BASIC | PRO | VIP")
):
    try:
        leaderboard_table = await get_leaderboard_weekly_table()
        users_table = await get_users_table()
        
        # Get leaderboard data
        response = await leaderboard_table.select('*').eq('week', week).eq('board', board.upper()).execute()
        if not response.data:
            return {"week": week, "board": board, "top_10": []}
            
        doc = response.data[0]
        user_ids = [entry["user_id"] for entry in doc["top_10"]]
        
        # Get user data
        users_response = await users_table.select('*').in_('id', user_ids).execute()
        users = users_response.data
        user_map = {u["id"]: u for u in users}
        
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
    except Exception as e:
        api_logger.error(f"Error in get_weekly_leaderboard: {str(e)}")
        raise

@router.get("/leaderboard/monthly")
async def get_monthly_leaderboard(
    year: int = Query(..., description="Năm, ví dụ: 2025"),
    month: int = Query(..., description="Tháng, ví dụ: 5"),
    board: str = Query(..., description="BASIC | PRO | VIP")
):
    try:
        leaderboard_table = await get_leaderboard_monthly_table()
        users_table = await get_users_table()
        
        # Get leaderboard data
        response = await leaderboard_table.select('*').eq('year', year).eq('month', month).eq('board', board.upper()).execute()
        if not response.data:
            return {"year": year, "month": month, "board": board, "top_10": []}
            
        doc = response.data[0]
        user_ids = [entry["user_id"] for entry in doc["top_10"]]
        
        # Get user data
        users_response = await users_table.select('*').in_('id', user_ids).execute()
        users = users_response.data
        user_map = {u["id"]: u for u in users}
        
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
    except Exception as e:
        api_logger.error(f"Error in get_monthly_leaderboard: {str(e)}")
        raise 