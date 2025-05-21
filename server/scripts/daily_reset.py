import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from utils.time_utils import get_vietnam_time, to_vietnam_time
from database.database import get_database, get_skills_collection
from utils.logger import api_logger
import random

# Create logs directory if it doesn't exist
os.makedirs('logs', exist_ok=True)

# Log start time
with open('logs/daily_reset.log', 'a') as f:
    f.write(f"[{get_vietnam_time().strftime('%Y-%m-%d %H:%M:%S')}] Starting daily matches reset\n")

async def reset_bot_skills():
    """Reset bot skills with new random skills"""
    try:
        db = await get_database()
        skills_collection = await get_skills_collection()
        
        # Get all available skills
        kicker_skills = await skills_collection.find({"type": "kicker"}).to_list(length=None)
        goalkeeper_skills = await skills_collection.find({"type": "goalkeeper"}).to_list(length=None)
        
        # Random 10 skills for each type
        selected_kicker_skills = random.sample([s["name"] for s in kicker_skills], min(10, len(kicker_skills)))
        selected_goalkeeper_skills = random.sample([s["name"] for s in goalkeeper_skills], min(10, len(goalkeeper_skills)))
        
        # Update bot skills
        bot_collection = db.bots
        await bot_collection.update_one(
            {"username": "bot"},
            {
                "$set": {
                    "kicker_skills": selected_kicker_skills,
                    "goalkeeper_skills": selected_goalkeeper_skills,
                    "last_skill_update": get_vietnam_time()
                }
            },
            upsert=True
        )
        
        return True
        
    except Exception as e:
        api_logger.error(f"[DailyReset] Error resetting bot skills: {str(e)}")
        return False

async def reset_daily_matches():
    """Reset remaining matches for all users to 5"""
    try:
        db = await get_database()
        now = get_vietnam_time()
        current_date = now.strftime('%Y-%m-%d')
        
        # Reset remaining matches to 5 and daily_tasks to empty for all users
        result = await db.users.update_many(
            {},
            {"$set": {"remaining_matches": 5, "daily_tasks": {}}}
        )
        
        # Reset bot skills
        await reset_bot_skills()

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
            f.write(f"[{get_vietnam_time().strftime('%Y-%m-%d %H:%M:%S')}] Completed daily matches reset\n")