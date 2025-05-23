from fastapi import APIRouter, HTTPException, Body, Request
from typing import List, Dict, Any
from models.skill import Skill, SkillCreate, SkillUpdate, SkillType
from database.database import get_skills_collection, get_database
from bson import ObjectId
from utils.logger import api_logger
import traceback
import random
from datetime import datetime

router = APIRouter()

@router.post("/skills/", response_model=Skill)
async def create_skill(skill: SkillCreate):
    try:
        skills_collection = await get_skills_collection()
        skill_dict = skill.model_dump(by_alias=True)
        result = await skills_collection.insert_one(skill_dict)
        created_skill = await skills_collection.find_one({"_id": result.inserted_id})
        return Skill(**created_skill)
    except Exception as e:
        api_logger.error(f"Error creating skill: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/skills/", response_model=List[Skill])
async def get_skills():
    try:
        skills_collection = await get_skills_collection()
        skills = []
        async for skill in skills_collection.find():
            skills.append(Skill(**skill))
        return skills
    except Exception as e:
        api_logger.error(f"Error getting skills: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/skills/{skill_id}", response_model=Skill)
async def get_skill(skill_id: str):
    try:
        skills_collection = await get_skills_collection()
        skill = await skills_collection.find_one({"_id": ObjectId(skill_id)})
        if skill is None:
            raise HTTPException(status_code=404, detail="Skill not found")
        return Skill(**skill)
    except Exception as e:
        api_logger.error(f"Error getting skill {skill_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/skills/type/{skill_type}/raw", response_model=List[Dict[str, Any]])
async def get_skills_by_type_raw(skill_type: str):
    """
    Get raw skills data by type for debugging
    """
    try:
        skills_collection = await get_skills_collection()
        
        # Log the query
        query = {"type": skill_type}
        
        # Get skills
        skills = await skills_collection.find(query).to_list(length=None)
        
        # Convert ObjectId to string for JSON serialization
        result = []
        for skill in skills:
            skill_dict = dict(skill)
            if "_id" in skill_dict:
                skill_dict["_id"] = str(skill_dict["_id"])
            result.append(skill_dict)
            
        return result
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
        skills_collection = await get_skills_collection()
        
        # Log the query
        query = {"type": skill_type}
        
        # Get skills
        skills = await skills_collection.find(query).to_list(length=None)
        
        # Convert to Skill models
        result = []
        for skill in skills:
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
        skills_collection = await get_skills_collection()
        update_data = skill.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No update data provided")
        
        result = await skills_collection.update_one(
            {"_id": ObjectId(skill_id)},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Skill not found")
        
        updated_skill = await skills_collection.find_one({"_id": ObjectId(skill_id)})
        return Skill(**updated_skill)
    except Exception as e:
        api_logger.error(f"Error updating skill {skill_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/skills/{skill_id}")
async def delete_skill(skill_id: str):
    try:
        skills_collection = await get_skills_collection()
        result = await skills_collection.delete_one({"_id": ObjectId(skill_id)})
        if result.deleted_count == 0:
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
    user_id = str(request.state.user["_id"])
    db = await get_database()
    skills_collection = await get_skills_collection()

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

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

    all_skills = await skills_collection.find({"type": skill_type}).to_list(length=None)
    all_skill_names = [s["name"] for s in all_skills]
    available_skills = [s for s in all_skill_names if s not in current_skills]

    if not available_skills:
        raise HTTPException(status_code=400, detail="You already own all available skills of this type.")

    new_skill = random.choice(available_skills)

    update_result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$inc": {
                "available_skill_points": -required_points
            },
            "$push": {
                f"{skill_type}_skills": new_skill,
                "skill_history": {
                    "type": skill_type,
                    "skill": new_skill,
                    "bought_at": datetime.utcnow().isoformat(),
                    "action": "buy",
                    "points_spent": required_points
                }
            }
        }
    )
    if update_result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update user with new skill.")

    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    # Lấy số điểm skill còn lại
    remaining_skill_points = updated_user.get("available_skill_points", 0)
    return {
        "message": "Skill bought successfully",
        "skill": new_skill,
        "remaining_skill_points": remaining_skill_points
    } 