from fastapi import APIRouter, HTTPException
from database.database import get_database, get_skills_collection
from utils.logger import api_logger
from typing import Dict, List
import traceback
import random
from datetime import datetime

router = APIRouter()

async def get_or_create_bot():
    """Get or create bot with random skills"""
    try:
        db = await get_database()
        skills_collection = await get_skills_collection()
        
        # Get all available skills
        kicker_skills = await skills_collection.find({"type": "kicker"}).to_list(length=None)
        goalkeeper_skills = await skills_collection.find({"type": "goalkeeper"}).to_list(length=None)
        
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
            "created_at": datetime.utcnow(),
            "last_skill_update": datetime.utcnow()
        }
        
        # Store bot in a separate collection
        bot_collection = db.bots
        await bot_collection.delete_many({})  # Clear existing bot
        result = await bot_collection.insert_one(bot_data)
        
        return bot_data
        
    except Exception as e:
        api_logger.error(f"Error creating bot: {str(e)}")
        api_logger.error(f"Stack trace: {traceback.format_exc()}")
        raise

@router.get("/bot/skills", response_model=Dict[str, List[str]])
async def get_bot_skills():
    """Get current bot skills"""
    try:
        db = await get_database()
        
        # Get bot from bots collection
        bot = await db.bots.find_one({"username": "bot"})
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