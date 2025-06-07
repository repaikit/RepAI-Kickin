from fastapi import APIRouter, HTTPException, Request, Body
from datetime import datetime, timedelta
from database.database import get_users_table
from pydantic import BaseModel
import logging
import traceback
from utils.logger import api_logger
from utils.time_utils import get_vietnam_time, to_vietnam_time
from ws_handlers.waiting_room import manager as waiting_room_manager

router = APIRouter()

class TaskClaimRequest(BaseModel):
    task_id: str

DAILY_TASKS = [
    {"id": "play_5_matches", "name": "Play 5 matches", "reward": 10},
    {"id": "win_3_matches", "name": "Win 3 matches", "reward": 15},
    {"id": "login", "name": "Login today", "reward": 5},
]

@router.get("/tasks/daily")
async def get_daily_tasks(request: Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authorized")
    
    users_table = await get_users_table()
    user_tasks = user.get("daily_tasks", {})

    # Get current time in Vietnam timezone
    now = get_vietnam_time()
    today = now.date()

    # Lọc match_history trong ngày hiện tại
    matches_today = 0
    for m in user.get("match_history", []):
        try:
            # Log each match entry
            api_logger.debug(f"Processing match history entry: {m}")
            
            # Handle different timestamp formats
            timestamp_data = m.get("timestamp")
            match_timestamp = None
            
            if timestamp_data:
                try:
                    if isinstance(timestamp_data, dict) and "$date" in timestamp_data:
                        match_timestamp = to_vietnam_time(datetime.fromisoformat(timestamp_data["$date"].replace('Z', '+00:00')))
                    elif isinstance(timestamp_data, str):
                        match_timestamp = to_vietnam_time(datetime.fromisoformat(timestamp_data.replace('Z', '+00:00')))
                    elif isinstance(timestamp_data, datetime):
                        match_timestamp = to_vietnam_time(timestamp_data)
                    else:
                        api_logger.warning(f"Unexpected timestamp format in match history: {timestamp_data}. Skipping entry.")
                        continue
                    # Convert to ISO string for consistency
                    match_timestamp = match_timestamp.isoformat()
                    if datetime.fromisoformat(match_timestamp).date() == today:
                        matches_today += 1
                except Exception as e:
                    api_logger.warning(f"Invalid timestamp format in match history: {timestamp_data}. Error: {str(e)}")
                    continue
            else:
                api_logger.warning(f"Match history entry missing timestamp: {m}. Skipping entry.")

        except Exception as e:
            api_logger.error(f"Error processing match history entry {m}: {str(e)}")
            api_logger.error(f"Traceback: {traceback.format_exc()}")
            continue

    # Đếm số trận, số trận thắng, v.v.
    total_matches = matches_today
    win_matches = sum(
        1 for m in user.get("match_history", []) if m.get("winner_id") == str(user["id"])
    )

    # Xác định trạng thái từng nhiệm vụ và cập nhật vào daily_tasks
    tasks = []
    updates = {}
    
    for task in DAILY_TASKS:
        task_id = task["id"]
        current_status = user_tasks.get(task_id, {"completed": False, "claimed": False})
        
        # Xác định trạng thái hoàn thành
        if task_id == "play_5_matches":
            completed = total_matches >= 5
        elif task_id == "win_3_matches":
            completed = win_matches >= 3
        elif task_id == "login":
            completed = True  # Đăng nhập là hoàn thành
        else:
            completed = current_status.get("completed", False)
            
        # Nếu trạng thái thay đổi, cập nhật vào daily_tasks
        if completed != current_status.get("completed", False):
            updates[f"daily_tasks.{task_id}.completed"] = completed
            
        tasks.append({
            **task,
            "completed": completed,
            "claimed": current_status.get("claimed", False)
        })
    
    # Cập nhật daily_tasks nếu có thay đổi
    if updates:
        await users_table.update(updates).eq('id', user["id"]).execute()
    
    return {"success": True, "data": tasks}

@router.post("/tasks/daily/claim")
async def claim_daily_task(request: Request, task_request: TaskClaimRequest):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authorized")
    
    users_table = await get_users_table()
    user_tasks = user.get("daily_tasks", {})
    
    if task_request.task_id not in [t["id"] for t in DAILY_TASKS]:
        raise HTTPException(status_code=400, detail="Invalid task id")
    
    task_status = user_tasks.get(task_request.task_id, {"completed": False, "claimed": False})
    if not task_status.get("completed"):
        raise HTTPException(status_code=400, detail="Task not completed yet")
    if task_status.get("claimed"):
        raise HTTPException(status_code=400, detail="Reward already claimed")
    
    # Lấy số matches thưởng từ task
    reward = next(t["reward"] for t in DAILY_TASKS if t["id"] == task_request.task_id)
    
    # Cập nhật remaining_matches và đánh dấu task đã claim
    await users_table.update({
        "remaining_matches": user.get("remaining_matches", 0) + reward,
        f"daily_tasks.{task_request.task_id}.claimed": True
    }).eq('id', user["id"]).execute()
    
    # Broadcast user update
    response = await users_table.select('*').eq('id', user["id"]).execute()
    updated_user = response.data[0] if response.data else None
    
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
            }
        })
    
    return {
        "success": True, 
        "reward": reward,
        "message": f"Successfully claimed {reward} matches!"
    }