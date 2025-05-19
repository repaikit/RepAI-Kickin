from fastapi import APIRouter, HTTPException
from typing import List
from models.match import Match, MatchCreate, MatchUpdate
from database.database import get_matches_collection, get_users_collection
from bson import ObjectId
from utils.logger import api_logger
from datetime import datetime

router = APIRouter()

@router.post("/matches/", response_model=Match)
async def create_match(match: MatchCreate):
    try:
        matches_collection = get_matches_collection()
        match_dict = match.model_dump(by_alias=True)
        result = await matches_collection.insert_one(match_dict)
        created_match = await matches_collection.find_one({"_id": result.inserted_id})
        return Match(**created_match)
    except Exception as e:
        api_logger.error(f"Error creating match: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/matches/", response_model=List[Match])
async def get_matches():
    try:
        matches_collection = get_matches_collection()
        matches = []
        async for match in matches_collection.find():
            matches.append(Match(**match))
        return matches
    except Exception as e:
        api_logger.error(f"Error getting matches: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/matches/{match_id}", response_model=Match)
async def get_match(match_id: str):
    try:
        matches_collection = get_matches_collection()
        match = await matches_collection.find_one({"_id": ObjectId(match_id)})
        if match is None:
            raise HTTPException(status_code=404, detail="Match not found")
        return Match(**match)
    except Exception as e:
        api_logger.error(f"Error getting match {match_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/matches/status/{status}", response_model=List[Match])
async def get_matches_by_status(status: str):
    try:
        matches_collection = get_matches_collection()
        matches = []
        async for match in matches_collection.find({"status": status}):
            matches.append(Match(**match))
        return matches
    except Exception as e:
        api_logger.error(f"Error getting matches by status {status}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/matches/{match_id}", response_model=Match)
async def update_match(match_id: str, match: MatchUpdate):
    try:
        matches_collection = get_matches_collection()
        update_data = match.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No update data provided")
        
        result = await matches_collection.update_one(
            {"_id": ObjectId(match_id)},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Match not found")
        
        updated_match = await matches_collection.find_one({"_id": ObjectId(match_id)})
        return Match(**updated_match)
    except Exception as e:
        api_logger.error(f"Error updating match {match_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/matches/{match_id}")
async def delete_match(match_id: str):
    try:
        matches_collection = get_matches_collection()
        result = await matches_collection.delete_one({"_id": ObjectId(match_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Match not found")
        return {"message": "Match deleted successfully"}
    except Exception as e:
        api_logger.error(f"Error deleting match {match_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/matches/{match_id}/join")
async def join_match(match_id: str, player_id: str, role: str):
    try:
        matches_collection = get_matches_collection()
        users_collection = get_users_collection()
        
        # Check if match exists and is in waiting status
        match = await matches_collection.find_one({"_id": ObjectId(match_id)})
        if match is None:
            raise HTTPException(status_code=404, detail="Match not found")
        if match["status"] != "waiting":
            raise HTTPException(status_code=400, detail="Match is not in waiting status")
        
        # Check if user exists
        user = await users_collection.find_one({"_id": ObjectId(player_id)})
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if role is valid
        if role not in ["kicker", "goalkeeper"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        
        # Check if player is already in the match
        for player in match["players"]:
            if player["id"] == player_id:
                raise HTTPException(status_code=400, detail="Player already in match")
        
        # Add player to match
        new_player = {
            "id": player_id,
            "role": role,
            "score": 0,
            "skills": []
        }
        
        result = await matches_collection.update_one(
            {"_id": ObjectId(match_id)},
            {"$push": {"players": new_player}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to join match")
        
        updated_match = await matches_collection.find_one({"_id": ObjectId(match_id)})
        return Match(**updated_match)
    except Exception as e:
        api_logger.error(f"Error joining match {match_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/matches/{match_id}/complete")
async def complete_match(match_id: str, winner_id: str):
    try:
        matches_collection = get_matches_collection()
        users_collection = get_users_collection()
        
        # Check if match exists and is in progress
        match = await matches_collection.find_one({"_id": ObjectId(match_id)})
        if match is None:
            raise HTTPException(status_code=404, detail="Match not found")
        if match["status"] != "in_progress":
            raise HTTPException(status_code=400, detail="Match is not in progress")
        
        # Check if winner exists in match
        winner_found = False
        for player in match["players"]:
            if player["id"] == winner_id:
                winner_found = True
                break
        if not winner_found:
            raise HTTPException(status_code=400, detail="Winner not found in match")
        
        # Update match status and winner
        result = await matches_collection.update_one(
            {"_id": ObjectId(match_id)},
            {
                "$set": {
                    "status": "completed",
                    "winner": winner_id,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to complete match")
        
        # Update user stats
        for player in match["players"]:
            update_data = {}
            if player["id"] == winner_id:
                update_data = {
                    "$inc": {
                        "wins": 1,
                        "total_point": 10
                    }
                }
            else:
                update_data = {
                    "$inc": {
                        "losses": 1
                    }
                }
            
            await users_collection.update_one(
                {"_id": ObjectId(player["id"])},
                update_data
            )
        
        updated_match = await matches_collection.find_one({"_id": ObjectId(match_id)})
        return Match(**updated_match)
    except Exception as e:
        api_logger.error(f"Error completing match {match_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 