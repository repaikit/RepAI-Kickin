import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from utils.time_utils import get_vietnam_time, to_vietnam_time
from database.database import get_users_table, get_skills_table, get_bots_table
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
        skills_table = await get_skills_table()
        bots_table = await get_bots_table()
        
        # Get all available skills
        response = await skills_table.select("*").eq("type", "kicker").execute()
        kicker_skills = response.data
        response = await skills_table.select("*").eq("type", "goalkeeper").execute()
        goalkeeper_skills = response.data
        
        # Random 10 skills for each type
        selected_kicker_skills = random.sample([s["name"] for s in kicker_skills], min(10, len(kicker_skills)))
        selected_goalkeeper_skills = random.sample([s["name"] for s in goalkeeper_skills], min(10, len(goalkeeper_skills)))
        
        # Update bot skills
        response = await bots_table.upsert({
            "username": "bot",
            "kicker_skills": selected_kicker_skills,
            "goalkeeper_skills": selected_goalkeeper_skills,
            "last_skill_update": get_vietnam_time().isoformat()
        }).execute()
        
        if not response.data:
            raise Exception("Failed to update bot skills")
            
        return True
        
    except Exception as e:
        api_logger.error(f"[DailyReset] Error resetting bot skills: {str(e)}")
        return False

async def reset_daily_matches():
    """Reset remaining matches for all users to 5"""
    try:
        users_table = await get_users_table()
        now = get_vietnam_time()
        current_date = now.strftime('%Y-%m-%d')
        
        # Reset remaining matches to 5 and daily_tasks to empty for all users
        response = await users_table.update({
            "remaining_matches": 5,
            "daily_tasks": {}
        }).execute()
        
        if not response.data:
            raise Exception("Failed to reset user matches")
            
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