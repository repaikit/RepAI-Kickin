from fastapi import APIRouter, HTTPException
from typing import List
from server.models.skill import Skill, SkillCreate, SkillUpdate
from server.database.database import get_skills_collection
from bson import ObjectId
from server.utils.logger import api_logger
from enum import Enum

class SkillType(str, Enum):
    KICKER = "kicker"
    GOALKEEPER = "goalkeeper"

router = APIRouter()

@router.post("/skills/", response_model=Skill)
async def create_skill(skill: SkillCreate):
    try:
        skills_collection = await get_skills_collection()
        skill_dict = skill.model_dump(by_alias=True)
        result = await skills_collection.insert_one(skill_dict)
        created_skill = await skills_collection.find_one({"_id": result.inserted_id})
        api_logger.info(f"Created new skill with id: {result.inserted_id}")
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

@router.get("/skills/type/{skill_type}", response_model=List[Skill])
async def get_skills_by_type(skill_type: SkillType):
    """
    Get all skills by type (kicker or goalkeeper)
    """
    try:
        skills_collection = await get_skills_collection()
        skills = await skills_collection.find({"type": skill_type}).to_list(length=None)
        return [Skill(**skill) for skill in skills]
    except Exception as e:
        api_logger.error(f"Error getting skills by type {skill_type}: {str(e)}")
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