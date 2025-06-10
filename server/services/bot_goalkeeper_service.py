from datetime import datetime, timedelta
import random
from fastapi import HTTPException
from models.bot_goalkeeper import BotGoalkeeperModel
from database.database import get_database, get_skills_collection
from bson import ObjectId

# Initialize MongoDB client (configure URI elsewhere)
client = AsyncIOMotorClient()

# Core logic
async def get_or_create_bot_for_user(user_id: str) -> BotGoalkeeperModel:
    db = await get_database()
    bot_coll = db.bot_goalkeepers
    
    
    skills_collection = await get_skills_collection()
    goalkeeper_skills = await skills_collection.find({"type": "goalkeeper"}).to_list(length=None)
    selected_goalkeeper_skills = random.sample([s["name"] for s in goalkeeper_skills], min(10, len(goalkeeper_skills)))

    # Find bot by user_id
    response = await bot_table.select('*').eq('user_id', user_id).execute()
    bot_data = response.data[0] if response.data else None
    
    if bot_data:
        print(f"Bot found for user {user_id}: {bot_data}")
        return BotGoalkeeperModel(**bot_data)

    # Get user name from users table
    response = await client.table('users').select('name,user_type').eq('id', user_id).execute()
    user_data = response.data[0] if response.data else None
    
    if not user_data:
        user_name = "unknown"
    else:
        if user_data.get("user_type") == "guest":
            user_name = "guest_" + user_id[-4:]
        else:
            user_name = user_data.get("name", "user_" + user_id[-4:])

    bot_data = {
        "user_id": user_id,
        "user_name": "bot_goalkeeper_" + user_name,
        "skill": selected_goalkeeper_skills,
        "energy": 100.0,
        "feed_quota": 5,
        "last_skill_increase": datetime.utcnow(),
        "last_energy_deduction": datetime.utcnow(),
        "last_reset": datetime.utcnow(),
        "created_at": datetime.utcnow(),
    }
    
    response = await bot_table.insert(bot_data).execute()
    bot_data["id"] = response.data[0]["id"]
    print(f"Created new bot for user {user_id}: {bot_data}")
    return BotGoalkeeperModel(**bot_data)

# async def feed_bot(user_id: str) -> BotGoalkeeperModel:
#     bot = await get_or_create_bot_for_user(user_id)
#     if bot.feed_quota <= 0:
#         raise HTTPException(status_code=400, detail="No feed quota remaining")
#     # Each feed adds 5 hours = 50% energy (10% per hour)
#     bot.energy = min(bot.energy + 50.0, 100.0)
#     bot.feed_quota -= 1
#     bot.last_energy_deduction = datetime.utcnow()
#     await bot_coll.update_one({"_id": bot.id}, {"$set": {"energy": bot.energy, "feed_quota": bot.feed_quota, "last_energy_deduction": bot.last_energy_deduction}})
#     return bot

# async def _hourly_update():
#     now = datetime.utcnow()
#     async for doc in bot_coll.find({}):
#         bot = BotGoalkeeperModel(**doc)
#         # Deduct energy 10% per hour
#         elapsed = now - bot.last_energy_deduction
#         hours = int(elapsed.total_seconds() // 3600)
#         if hours <= 0:
#             continue
#         new_energy = max(bot.energy - 10.0 * hours, 0.0)
#         update = {"energy": new_energy, "last_energy_deduction": now}
#         # Auto increase skill if energy > 50%
#         if new_energy > 50.0:
#             incr_times = hours
#             update['skill'] = bot.skill + incr_times
#             update['last_skill_increase'] = now
#         await bot_coll.update_one({"_id": bot.id}, {"$set": update})

# async def _reset_bots():
#     now = datetime.utcnow()
#     cursor = bot_coll.find({})
#     async for doc in cursor:
#         bot = BotGoalkeeperModel(**doc)
#         user = await user_coll.find_one({"_id": bot.user_id})
#         plan = user.get('plan', 'BASIC').upper()
#         since_reset = now - bot.last_reset
#         reset_needed = False
#         if plan == 'BASIC' and since_reset >= timedelta(weeks=1):
#             reset_needed = True
#         elif plan == 'PRO' and since_reset >= timedelta(days=30):
#             reset_needed = True
#         elif plan == 'VIP':
#             reset_needed = False
#         if reset_needed:
#             await bot_coll.update_one({"_id": bot.id}, {"$set": {
#                 "skill": 10,
#                 "energy": 100.0,
#                 "feed_quota": 5,
#                 "last_reset": now
#             }})

# # Scheduler setup
# scheduler = AsyncIOScheduler()
# scheduler.add_job(_hourly_update, 'interval', hours=1)
# scheduler.add_job(_reset_bots, 'cron', hour=0, minute=0)
# scheduler.start()
