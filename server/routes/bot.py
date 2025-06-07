from fastapi import APIRouter, HTTPException
from database.database import get_skills_table, get_bots_table
from utils.logger import api_logger
from typing import Dict, List
import traceback
import random
from datetime import datetime

router = APIRouter()

async def get_or_create_bot():
    """Get or create bot with random skills"""
    try:
        skills_table = await get_skills_table()
        bots_table = await get_bots_table()
        
        # Get all available skills
        kicker_response = await skills_table.select('*').eq('type', 'kicker').execute()
        goalkeeper_response = await skills_table.select('*').eq('type', 'goalkeeper').execute()
        
        kicker_skills = kicker_response.data
        goalkeeper_skills = goalkeeper_response.data
        
        # Random 10 skills for each type
        selected_kicker_skills = random.sample([s["name"] for s in kicker_skills], min(10, len(kicker_skills)))
        selected_goalkeeper_skills = random.sample([s["name"] for s in goalkeeper_skills], min(10, len(goalkeeper_skills)))
        
        # Create bot data
        bot_data = {
            "username": "bot",
            "is_bot": True,
            "kicker_skills": selected_kicker_skills,
            "goalkeeper_skills": selected_goalkeeper_skills,
            "remaining_matches": 5,
            "daily_tasks": {},
            "created_at": datetime.utcnow().isoformat(),
            "last_skill_update": datetime.utcnow().isoformat()
        }
        
        # Store bot in bots table
        await bots_table.delete().eq('username', 'bot').execute()  # Clear existing bot
        result = await bots_table.insert(bot_data).execute()
        
        return bot_data
        
    except Exception as e:
        api_logger.error(f"Error creating bot: {str(e)}")
        api_logger.error(f"Stack trace: {traceback.format_exc()}")
        raise

@router.get("/bot/skills", response_model=Dict[str, List[str]])
async def get_bot_skills():
    """Get current bot skills"""
    try:
        bots_table = await get_bots_table()
        
        # Get bot from bots table
        response = await bots_table.select('*').eq('username', 'bot').execute()
        bot = response.data[0] if response.data else None
        
        if not bot:
            bot = await get_or_create_bot()
            
        # Get skills
        kicker_skills = bot.get("kicker_skills", [])
        goalkeeper_skills = bot.get("goalkeeper_skills", [])
        
        return {
            "kicker_skills": kicker_skills,
            "goalkeeper_skills": goalkeeper_skills
        }
        
    except Exception as e:
        api_logger.error(f"Error getting bot skills: {str(e)}")
        api_logger.error(f"Stack trace: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get bot skills: {str(e)}"
        )