from fastapi import APIRouter, HTTPException, Body, Request
from typing import List, Dict, Any
from models.skill import Skill, SkillCreate, SkillUpdate, SkillType
from database.database import get_skills_table, get_users_table
from utils.logger import api_logger
import traceback
import random
from datetime import datetime

router = APIRouter()

@router.post("/skills/", response_model=Skill)
async def create_skill(skill: SkillCreate):
    try:
        skills_table = await get_skills_table()
        skill_dict = skill.model_dump(by_alias=True)
        response = await skills_table.insert(skill_dict).execute()
        created_skill = response.data[0] if response.data else None
        if not created_skill:
            raise HTTPException(status_code=500, detail="Failed to create skill")
        return Skill(**created_skill)
    except Exception as e:
        api_logger.error(f"Error creating skill: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/skills/", response_model=List[Skill])
async def get_skills():
    try:
        skills_table = await get_skills_table()
        response = await skills_table.select('*').execute()
        skills = [Skill(**skill) for skill in response.data]
        return skills
    except Exception as e:
        api_logger.error(f"Error getting skills: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/skills/{skill_id}", response_model=Skill)
async def get_skill(skill_id: str):
    try:
        skills_table = await get_skills_table()
        response = await skills_table.select('*').eq('id', skill_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Skill not found")
        return Skill(**response.data[0])
    except Exception as e:
        api_logger.error(f"Error getting skill {skill_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/skills/type/{skill_type}/raw", response_model=List[Dict[str, Any]])
async def get_skills_by_type_raw(skill_type: str):
    """
    Get raw skills data by type for debugging
    """
    try:
        skills_table = await get_skills_table()
        response = await skills_table.select('*').eq('type', skill_type).execute()
        return response.data
    except Exception as e:
        api_logger.error(f"Error getting raw skills by type {skill_type}: {str(e)}")
        api_logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/skills/type/{skill_type}", response_model=List[Skill])
async def get_skills_by_type(skill_type: str):
    """
    Get all skills by type (kicker or goalkeeper)
    """
    try:
        skills_table = await get_skills_table()
        response = await skills_table.select('*').eq('type', skill_type).execute()
        
        # Convert to Skill models
        result = []
        for skill in response.data:
            try:
                skill_model = Skill(**skill)
                result.append(skill_model)
            except Exception as model_error:
                api_logger.error(f"Error converting skill to model: {str(model_error)}")
                api_logger.error(f"Skill data: {skill}")
                api_logger.error(traceback.format_exc())
                raise
                
        return result
    except Exception as e:
        api_logger.error(f"Error getting skills by type {skill_type}: {str(e)}")
        api_logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/skills/{skill_id}", response_model=Skill)
async def update_skill(skill_id: str, skill: SkillUpdate):
    try:
        skills_table = await get_skills_table()
        update_data = skill.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No update data provided")
        
        response = await skills_table.update(update_data).eq('id', skill_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Skill not found")
        
        return Skill(**response.data[0])
    except Exception as e:
        api_logger.error(f"Error updating skill {skill_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/skills/{skill_id}")
async def delete_skill(skill_id: str):
    try:
        skills_table = await get_skills_table()
        response = await skills_table.delete().eq('id', skill_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Skill not found")
        return {"message": "Skill deleted successfully"}
    except Exception as e:
        api_logger.error(f"Error deleting skill {skill_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/buy_skill")
async def buy_skill(
    request: Request,
    skill_type: str = Body(..., embed=True)
):
    """
    Mua skill mới cho user, dùng available_skill_points.
    - skill_type: 'kicker' hoặc 'goalkeeper'
    - Kicker skills cost 10 skill_point
    - Goalkeeper skills cost 5 skill_point
    """
    try:
        user_id = request.state.user["id"]
        users_table = await get_users_table()
        skills_table = await get_skills_table()

        # Get user data
        response = await users_table.select('*').eq('id', user_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        user = response.data[0]

        if skill_type == "kicker":
            current_skills = user.get("kicker_skills", [])
            required_points = 10
        elif skill_type == "goalkeeper":
            current_skills = user.get("goalkeeper_skills", [])
            required_points = 10
        else:
            raise HTTPException(status_code=400, detail="Invalid skill_type (must be 'kicker' or 'goalkeeper')")

        # Kiểm tra available_skill_points
        available_skill_points = user.get("available_skill_points", 0)

        if available_skill_points < required_points:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough skill points to buy skill (need {required_points}, have {available_skill_points})"
            )

        # Get available skills
        skills_response = await skills_table.select('*').eq('type', skill_type).execute()
        all_skills = skills_response.data
        all_skill_names = [s["name"] for s in all_skills]
        available_skills = [s for s in all_skill_names if s not in current_skills]

        if not available_skills:
            raise HTTPException(status_code=400, detail="You already own all available skills of this type.")

        new_skill = random.choice(available_skills)

        # Update user data
        update_data = {
            "available_skill_points": available_skill_points - required_points
        }
        
        # Add new skill to user's skills
        if skill_type == "kicker":
            kicker_skills = user.get("kicker_skills", [])
            kicker_skills.append(new_skill)
            update_data["kicker_skills"] = kicker_skills
        else:
            goalkeeper_skills = user.get("goalkeeper_skills", [])
            goalkeeper_skills.append(new_skill)
            update_data["goalkeeper_skills"] = goalkeeper_skills
            
        # Add to skill history
        skill_history = user.get("skill_history", [])
        skill_history.append({
            "type": skill_type,
            "skill": new_skill,
            "bought_at": datetime.utcnow().isoformat(),
            "action": "buy",
            "points_spent": required_points
        })
        update_data["skill_history"] = skill_history

        # Update user
        response = await users_table.update(update_data).eq('id', user_id).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to update user with new skill.")

        updated_user = response.data[0]
        remaining_skill_points = updated_user.get("available_skill_points", 0)
        
        return {
            "message": "Skill bought successfully",
            "skill": new_skill,
            "remaining_skill_points": remaining_skill_points
        }
    except Exception as e:
        api_logger.error(f"Error buying skill: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 