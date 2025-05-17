import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from datetime import datetime
from database.database import get_database
from utils.logger import api_logger

# Create logs directory if it doesn't exist
os.makedirs('logs', exist_ok=True)

# Log start time
with open('logs/weekly_reset.log', 'a') as f:
    f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting weekly reset check\n")

async def reset_week():
    """Reset weekly points for all users and archive them to history"""
    try:
        db = await get_database()
        now = datetime.utcnow()
        current_week = f"{now.year}-{now.isocalendar()[1]:02d}"
        reset_at = now.isoformat()
        # Get current settings
        settings = await db.settings.find_one({"_id": "weekly_reset"})
        # Check if reset is needed
        if not settings or settings.get("last_week") != current_week:
            api_logger.info(f"[WeeklyReset] Starting reset for week {current_week}")
            users = await db.users.find({}).to_list(length=None)
            for user in users:
                # Lưu lịch sử điểm tuần cho từng bảng
                for board in ["basic", "pro", "vip"]:
                    week_point = user.get(f"{board}_week_point", 0)
                    week_history_field = f"{board}_week_history"
                    history_entry = {
                        "week": current_week,
                        "point": week_point,
                        "reset_at": reset_at,
                        "user_type": user.get("user_type", "guest"),
                        "level": user.get("level", 1)
                    }
                    await db.users.update_one(
                        {"_id": user["_id"]},
                        {"$push": {week_history_field: history_entry}}
                    )
                # Reset điểm tuần về 0
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {
                        "basic_week_point": 0,
                        "pro_week_point": 0,
                        "vip_week_point": 0
                    }}
                )
            # Update last reset week
            await db.settings.update_one(
                {"_id": "weekly_reset"},
                {"$set": {"last_week": current_week}},
                upsert=True
            )
            api_logger.info(f"[WeeklyReset] Successfully reset week to {current_week}")
            return True
        else:
            api_logger.info(f"[WeeklyReset] No reset needed. Current week: {current_week}")
            return False
    except Exception as e:
        api_logger.error(f"[WeeklyReset] Error during reset: {str(e)}")
        return False

if __name__ == "__main__":
    try:
        asyncio.run(reset_week())
    finally:
        # Log completion time
        with open('logs/weekly_reset.log', 'a') as f:
            f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Completed weekly reset check\n") 