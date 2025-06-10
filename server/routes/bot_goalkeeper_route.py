from fastapi import APIRouter, Depends, HTTPException
from models.bot_goalkeeper import BotGoalkeeperModel
from services.bot_goalkeeper_service import (
    get_or_create_bot_for_user,
    feed_bot,
    get_user_available_skill_points,
    reset_bot_for_user,
    update_bot_energy_and_skills,
    attempt_save)
from routes.users import get_current_user
from datetime import timedelta

# Số giờ giả lập đã trôi qua (có thể chỉnh trực tiếp trong file)
TIMEPASS_HOURS: float = 8  # ví dụ simulate 8 tiếng đã trôi
router = APIRouter()

@router.get("/goalkeeper/me", response_model=BotGoalkeeperModel)
async def read_bot(current_user: dict = Depends(get_current_user)):
    return await get_or_create_bot_for_user(str(current_user.get('id')))

@router.post("/goalkeeper/feed", response_model=BotGoalkeeperModel)
async def feed_my_bot(current_user=Depends(get_current_user)):
    await feed_bot(str(current_user["_id"]), 1)
    # Sau khi feed xong, lấy lại object bot đầy đủ
    bot = await get_or_create_bot_for_user(str(current_user["_id"]))
    return bot
@router.get("/goalkeeper/point", response_model=int)
async def feed_my_bot(current_user: dict = Depends(get_current_user)):
    return await get_user_available_skill_points(str(current_user.get('_id')))

@router.post("/goalkeeper/reset", response_model=BotGoalkeeperModel)
async def reset(current_user=Depends(get_current_user)):
    """Reset bot theo tier: Basic weekly, Pro monthly, VIP none"""
    try:
        bot = await reset_bot_for_user(str(current_user.get('_id')))
        return bot
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.post("/goalkeeper/update", response_model=BotGoalkeeperModel)
async def update_state(current_user=Depends(get_current_user)):
    """Cập nhật trạng thái bot với giả lập TIMEPASS_HOURS giờ đã trôi (nếu TIMEPASS_HOURS > 0)"""
    try:
        user_id = str(current_user.get("_id") or current_user.get("id"))
        # Lấy bot hiện tại để biết last_energy_deduction
        bot = await get_or_create_bot_for_user(user_id)
        if TIMEPASS_HOURS > 0:
            # Tính thời điểm giả lập
            simulated_now = bot.last_energy_deduction + timedelta(hours=TIMEPASS_HOURS)
            return await update_bot_energy_and_skills(user_id, simulated_now)
        # Nếu TIMEPASS_HOURS = 0 thì cập nhật bình thường
        return await update_bot_energy_and_skills(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/goalkeeper/catch", response_model=BotGoalkeeperModel)
async def read_bot(current_user: dict = Depends(get_current_user)):
    return await attempt_save(str(current_user.get('_id')))
