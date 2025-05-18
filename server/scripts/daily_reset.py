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
with open('logs/daily_reset.log', 'a') as f:
    f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting daily matches reset\n")

async def reset_daily_matches():
    """Reset remaining matches for all users to 5"""
    try:
        db = await get_database()
        now = datetime.utcnow()
        current_date = now.strftime('%Y-%m-%d')
        
        api_logger.info(f"[DailyReset] Starting reset for date {current_date}")
        
        # Reset remaining matches to 5 and daily_tasks to empty for all users
        result = await db.users.update_many(
            {},
            {"$set": {"remaining_matches": 5, "daily_tasks": {}}}
        )
        
        api_logger.info(f"[DailyReset] Successfully reset matches for {current_date}")
        api_logger.info(f"[DailyReset] Modified {result.modified_count} users")
        return True
            
    except Exception as e:
        api_logger.error(f"[DailyReset] Error during reset: {str(e)}")
        return False

if __name__ == "__main__":
    try:
        asyncio.run(reset_daily_matches())
    finally:
        # Log completion time
        with open('logs/daily_reset.log', 'a') as f:
            f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Completed daily matches reset\n")