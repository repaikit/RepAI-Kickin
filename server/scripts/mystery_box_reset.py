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
with open('logs/mystery_box_reset.log', 'a') as f:
    f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting mystery box reset\n")

async def reset_mystery_box():
    """Reset mystery box for all users"""
    try:
        db = await get_database()
        now = datetime.utcnow()
        current_time = now.strftime('%Y-%m-%d %H:%M:%S')
        
        api_logger.info(f"[MysteryBoxReset] Starting reset at {current_time}")
        
        # Reset mystery box for all users
        result = await db.users.update_many(
            {},
            {
                "$set": {
                    "can_open_mystery_box": True,
                    "last_mystery_box_reset": now
                }
            }
        )
        
        api_logger.info(f"[MysteryBoxReset] Successfully reset mystery box")
        api_logger.info(f"[MysteryBoxReset] Modified {result.modified_count} users")
        return True
            
    except Exception as e:
        api_logger.error(f"[MysteryBoxReset] Error during reset: {str(e)}")
        return False

if __name__ == "__main__":
    try:
        asyncio.run(reset_mystery_box())
    finally:
        # Log completion time
        with open('logs/mystery_box_reset.log', 'a') as f:
            f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Completed mystery box reset\n") 