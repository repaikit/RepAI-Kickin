from fastapi import APIRouter, Depends, HTTPException
from typing import Any
from models.bot_goalkeeper import BotGoalkeeperModel
from services.bot_goalkeeper_service import get_or_create_bot_for_user
# feed_bot
from routes.users import get_current_user

router = APIRouter()

@router.get("/goalkeeper/me", response_model=BotGoalkeeperModel)
async def read_bot(current_user: dict = Depends(get_current_user)):
    return await get_or_create_bot_for_user(str(current_user.get('_id')))

# @router.post("/feed", response_model=BotGoalkeeperModel)
# async def feed_my_bot(current_user: dict = Depends(get_current_user)):
#     return await feed_bot(str(current_user.id))
