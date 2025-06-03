from datetime import datetime, timedelta
import random
from motor.motor_asyncio import AsyncIOMotorClient
from models.bot_goalkeeper import BotGoalkeeperModel
from database.database import get_database, get_skills_collection,get_users_collection
from bson import ObjectId
from typing import Any, Dict, List, Optional

MAX_HOURS = 5  # tối đa 5 giờ energy

async def _get_bot_collection():
    db = await get_database()
    return db.bot_goalkeepers

# Initialize MongoDB client (configure URI elsewhere)
client = AsyncIOMotorClient()

# Core logic
async def get_or_create_bot_for_user(user_id: str) -> BotGoalkeeperModel:
    db = await get_database()
    bot_coll = db.bot_goalkeepers

    skills_collection = await get_skills_collection()
    goalkeeper_skills = await skills_collection.find({"type": "goalkeeper"}).to_list(length=None)
    selected_goalkeeper_skills = random.sample([s["name"] for s in goalkeeper_skills], min(10, len(goalkeeper_skills)))

    # Tìm bot theo user_id
    bot_doc = await bot_coll.find_one({"user_id": user_id})
    if bot_doc:
        print(f"Bot found for user {user_id}: {bot_doc}")
        return BotGoalkeeperModel(**bot_doc)
    # Lấy user_name từ bảng users (nếu cần)
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    user_name = user_doc.get("name", "") if user_doc else ""
    if not user_doc:
        user_name = "unknown"
    else:
        if user_doc.get("user_type") == "guest":
            user_name = "guest_" + user_id[-4:]
        else:
            user_name = user_doc.get("name", "user_" + user_id[-4:])

    bot_data = {
        "user_id": (user_id),
        "user_name": "bot_goalkeeper_" + user_name,
        "skill": selected_goalkeeper_skills,
        "energy": 0,
        "feed_quota": 0,
        "last_skill_increase": datetime.utcnow(),
        "last_energy_deduction": datetime.utcnow(),
        "last_reset": datetime.utcnow(),
        "created_at": datetime.utcnow(),
    }
    result = await bot_coll.insert_one(bot_data)
    bot_data["_id"] = result.inserted_id
    print(f"Created new bot for user {user_id}: {bot_data}")
    return BotGoalkeeperModel(**bot_data)

async def get_user_available_skill_points(user_id: str) -> int:
    await get_or_create_bot_for_user(user_id)
    users_coll = await get_users_collection()
    user = await users_coll.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError(f"User {user_id} không tồn tại")
    if "available_skill_points" not in user:
        await users_coll.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"available_skill_points": 0}}
        )
        return 0

    return user.get("available_skill_points", 0)


async def feed_bot(user_id: str, needed_points: int) -> Dict[str, Any]:
    """
    - Trừ `points` từ available_skill_points của user
    - Cộng `points` vào feed_quota của bot (mỗi point = 1 giờ)
    - Trả về trạng thái mới của user và bot
    """
    await get_or_create_bot_for_user(user_id)  # đảm bảo bot đã có sẵn

    if needed_points <= 0:
        raise ValueError("Points phải > 0")

    bot = await update_bot_energy_and_skills(user_id)

    # 1. Lấy collections
    users_coll = await get_users_collection()

    # 2. Lấy user và kiểm tra điểm
    user = await users_coll.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError(f"User {user_id} không tồn tại")
    if "available_skill_points" not in user:
        avail = 0
        await users_coll.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"available_skill_points": 0}}
        )
    else:
        avail = user.get("available_skill_points", 0)

    if avail < needed_points:
        raise ValueError(f"Không đủ điểm: bạn chỉ có {avail} available_skill_points")

    # 3. Trừ điểm của user
    await users_coll.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"available_skill_points": -needed_points}}
    )

    # 4. Lấy hoặc tạo bot, rồi cộng thêm feed_quota
    bot_coll = await _get_bot_collection()
    new_quota = bot.feed_quota + needed_points
    await bot_coll.update_one(
        {"user_id": user_id},
        {"$set": {
            "feed_quota": new_quota,
            # reset thời điểm trừ năng lượng từ giờ
            "last_energy_deduction": datetime.utcnow()
        }}
    )

    return {
        "user_available_skill_points": avail - needed_points,
        "bot_feed_quota": new_quota,
    }

async def update_bot_energy_and_skills(user_id: str, now: Optional[datetime] = None) -> BotGoalkeeperModel:
    """
    - Giảm feed_quota (giờ năng lượng) theo thời gian trôi qua
    - Auto tăng skill tương ứng với số giờ trôi qua mà năng lượng tại mỗi giờ > 50%
    - Trả về BotGoalkeeperModel mới nhất
    """
    if now is None:
        now = datetime.utcnow()
    bot_coll = await _get_bot_collection()
    bot = await get_or_create_bot_for_user(user_id)

    last_ded = bot.last_energy_deduction
    elapsed = now - last_ded
    hours_passed = int(elapsed.total_seconds() // 3600)

    if hours_passed > 0:
        initial_quota = bot.feed_quota
        # Tính feed_quota mới
        new_quota = max(initial_quota - hours_passed, 0)
        # Tính số giờ đủ điều kiện để tăng skill
        skill_hours = sum(
            1 for h in range(1, hours_passed + 1)
            if (initial_quota - h) / MAX_HOURS > 0.5
        )
        # Chuẩn bị cập nhật thời gian và quota
        updates: Dict[str, Any] = {
            "feed_quota": new_quota,
            "last_energy_deduction": last_ded + timedelta(hours=hours_passed),
        }
        # Cập nhật last_skill_increase nếu có skill được tăng
        if skill_hours > 0:
            updates["last_skill_increase"] = bot.last_skill_increase + timedelta(hours=skill_hours)

        # Cập nhật feed_quota và các timestamp
        await bot_coll.update_one({"user_id": user_id}, {"$set": updates})
        # Tăng skill tương ứng
        for _ in range(skill_hours):
            await add_skill_for_bot(user_id)
        # Cập nhật đối tượng bot cho các bước tiếp theo
        bot.feed_quota = new_quota
        bot.last_energy_deduction = updates["last_energy_deduction"]
        if skill_hours > 0:
            bot.last_skill_increase = updates["last_skill_increase"]

    # Lấy lại document bot mới nhất
    updated = await bot_coll.find_one({"user_id": user_id})
    energy_percent = round(min(updated.get("feed_quota", 0), MAX_HOURS) / MAX_HOURS * 100, 2)
    await bot_coll.update_one(
        {"user_id": user_id},
        {"$set": {"energy": energy_percent}}
    )
    updated["energy"] = energy_percent
    return BotGoalkeeperModel(**updated)


async def add_skill_for_bot(user_id: str) -> None:
    """
    Thêm 1 skill mới cho bot từ danh sách kỹ năng goalkeeper.
    Nếu không còn skill nào mới, không thêm.
    """
    bot_coll = await _get_bot_collection()
    bot = await get_or_create_bot_for_user(user_id)

    skills_coll = await get_skills_collection()
    all_skills = await skills_coll.find({"type": "goalkeeper"}).to_list(length=None)
    all_names = [s["name"] for s in all_skills]

    current: List[str] = bot.skill
    pool = list(set(all_names) - set(current))
    if not pool:
        # Đã có đầy đủ, không thêm
        return
    new_skill = random.choice(pool)

    await bot_coll.update_one(
        {"user_id": user_id},
        {
            "$push": {"skill": new_skill},
            "$set": {"last_skill_increase": datetime.utcnow()}
        }
    )

async def reset_bot_for_user(user_id: str) -> BotGoalkeeperModel:
    """Reset bot stats based on user tier:
       - Basic (is_pro=False and is_vip=False): reset weekly
       - Pro: reset monthly
       - VIP: no reset
    """
    users_coll = await get_users_collection()
    user = await users_coll.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError(f"User {user_id} không tồn tại")
    now = datetime.utcnow()
    bot_coll = await _get_bot_collection()
    bot = await get_or_create_bot_for_user(user_id)
    print(user.get("is_pro"), user.get("is_vip"))

    # Determine reset period start
    if not user.get("is_pro") and not user.get("is_vip"):
        # Basic account: reset weekly (from Monday)
        start = now - timedelta(days=now.weekday())
    elif user.get("is_pro"):
        # Pro account: reset monthly (from 1st day)
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        # VIP account: no reset needed
        return bot

    # If last_reset is before start of current period, perform reset
    if bot.last_reset < start:
        # Reinitialize skills
        skills_coll = await get_skills_collection()
        all_skills = await skills_coll.find({"type": "goalkeeper"}).to_list(length=None)
        selected_skills = random.sample(
            [s["name"] for s in all_skills],
            min(10, len(all_skills))
        )
        updates = {
            "skill": selected_skills,
            "last_skill_increase": now,
            "last_reset": now,
        }
        await bot_coll.update_one({"user_id": user_id}, {"$set": updates})
        bot = await bot_coll.find_one({"user_id": user_id})
    else:
        return bot
    return BotGoalkeeperModel(**bot)

async def attempt_save(user_id: str) -> bool:
    bot = await update_bot_energy_and_skills(user_id)
    remaining = bot.feed_quota
    if remaining <= 0:
        return False
    percent = remaining / MAX_HOURS
    if percent > 0.5:
        return True
    return random.random() < percent