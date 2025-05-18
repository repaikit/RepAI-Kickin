import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from datetime import datetime
from database.database import get_database
from utils.logger import api_logger

REWARD_BASIC = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
REWARD_PRO   = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11]
REWARD_VIP   = [50, 40, 30, 20, 20, 20, 10, 10, 10, 10]

# Mốc thắng để lên level BASIC (ví dụ: 0, 100, 300, ... đến 10000+)
LEVEL_MILESTONES_BASIC = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800, 9100, 10500, 12000, 13600, 15300, 17100, 19000, 21000, 23100, 25300, 27600, 30000, 32500, 35100, 37800, 40600, 43500, 46500, 49600, 52800, 56100, 59500, 63000, 66600, 70300, 74100, 78000, 82000, 86100, 90300, 94600, 99000, 103500, 108100, 112800, 117600, 122500, 127500, 132600, 137800, 143100, 148500, 154000, 159600, 165300, 171100, 177000, 183000, 189100, 195300, 201600, 208000, 214500, 221100, 227800, 234600, 241500, 248500, 255600, 262800, 270100, 277500, 285000, 292600, 300300, 308100, 316000, 324000, 332100, 340300, 348600, 357000, 365500, 374100, 382800, 391600, 400500, 409500, 418600, 427800, 437100, 446500, 456000, 465600, 475300, 485100, 495000]
# Legend: mỗi 100 trận thắng sau level 100
LEGEND_STEP = 100
LEGEND_MAX = 10
# VIP: 5 cấp
VIP_LEVELS = [
    ("SILVER", 50),
    ("GOLD", 100),
    ("RUBY", 150),
    ("EMERALD", 200),
    ("DIAMOND", 500)
]

os.makedirs('logs', exist_ok=True)

# Log start time
with open('logs/weekly_reset.log', 'a') as f:
    f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting weekly reset check\n")

async def distribute_weekly_rewards():
    db = await get_database()
    now = datetime.utcnow()
    current_week = f"{now.year}-{now.isocalendar()[1]:02d}"
    distributed_at = now.isoformat()

    users = await db.users.find({}).to_list(length=None)
    
    # Xử lý từng bảng riêng biệt
    for board, history_field, reward_table in [
        ("basic", "basic_week_history", REWARD_BASIC),
        ("pro", "pro_week_history", REWARD_PRO),
        ("vip", "vip_week_history", REWARD_VIP)
    ]:
        # Lọc user theo điều kiện của từng bảng
        eligible_users = []
        for user in users:
            if board == "basic":  # Bảng BASIC: tất cả user
                eligible_users.append(user)
            elif board == "pro" and user.get("is_pro", False):  # Bảng PRO: chỉ user PRO
                eligible_users.append(user)
            elif board == "vip" and user.get("is_vip", False):  # Bảng VIP: chỉ user VIP
                eligible_users.append(user)

        # Tính tổng điểm 4 tuần gần nhất cho từng user đủ điều kiện
        user_points = []
        for user in eligible_users:
            week_history = user.get(history_field, [])
            # Lấy 4 tuần gần nhất
            last_4 = sorted(week_history, key=lambda x: x["week"], reverse=True)[:4]
            total = sum(item.get("point", 0) for item in last_4)
            
            # Thêm thông tin chi tiết về từng tuần
            weekly_points = [item.get("point", 0) for item in last_4]
            
            user_points.append({
                "user_id": user["_id"],
                "name": user.get("name", ""),
                "wallet": user.get("wallet", ""),
                "total_point": total,
                "weekly_points": weekly_points,
                "level": user.get("level", 1),
                "is_pro": user.get("is_pro", False),
                "vip_level": user.get("vip_level", "NONE"),
                "current_reward": user.get("bonus_point", 0.0)
            })

        # Xếp hạng
        user_points.sort(key=lambda x: x["total_point"], reverse=True)
        top_10 = user_points[:10]

        # Trao thưởng
        for idx, user_info in enumerate(top_10):
            reward = reward_table[idx]
            new_bonus_point = user_info["current_reward"] + reward
            
            await db.users.update_one(
                {"_id": user_info["user_id"]},
                {
                    "$set": {"bonus_point": new_bonus_point},
                    "$push": {
                        "reward_history": {
                            "week": current_week,
                            "board": board,
                            "rank": idx + 1,
                            "distributed_at": distributed_at,
                            "total_point": user_info["total_point"],
                            "weekly_points": user_info["weekly_points"],
                            "period": "4_weeks",
                            "previous_bonus_point": user_info["current_reward"],
                            "new_bonus_point": new_bonus_point,
                            "level": user_info["level"],
                            "is_pro": user_info["is_pro"],
                            "vip_level": user_info["vip_level"]
                        }
                    }
                }
            )

def get_basic_level(total_win):
    for i, milestone in enumerate(LEVEL_MILESTONES_BASIC):
        if total_win < milestone:
            return i
    return len(LEVEL_MILESTONES_BASIC)

def get_legend_level(total_win):
    if total_win < LEVEL_MILESTONES_BASIC[99]:
        return 0
    legend = (total_win - LEVEL_MILESTONES_BASIC[99]) // LEGEND_STEP + 1
    return min(legend, LEGEND_MAX)

def get_vip_level(vip_amount):
    level = "NONE"
    for name, amount in VIP_LEVELS:
        if vip_amount >= amount:
            level = name
    return level

async def update_all_user_levels():
    db = await get_database()
    users = await db.users.find({}).to_list(length=None)
    for user in users:
        total_win = user.get("kicked_win", 0) + user.get("keep_win", 0)
        new_level = get_basic_level(total_win)
        is_pro = new_level >= 100
        if is_pro:
            new_level = 100
            legend_level = get_legend_level(total_win)
        else:
            legend_level = 0
        vip_amount = user.get("vip_amount", 0)
        vip_level = get_vip_level(vip_amount)
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "level": new_level,
                "is_pro": is_pro,
                "legend_level": legend_level,
                "vip_level": vip_level
            }}
        )

async def reset_week():
    """Reset weekly points for all users and archive them to history"""
    try:
        db = await get_database()
        now = datetime.utcnow()
        current_week = f"{now.year}-{now.isocalendar()[1]:02d}"
        reset_at = now.isoformat()
        
        # Get current settings
        settings = await db.settings.find_one({"_id": "weekly_reset"})
        
        # Check if reset is needed
        if not settings or settings.get("last_week") != current_week:
            api_logger.info(f"[WeeklyReset] Starting reset for week {current_week}")
            
            users = await db.users.find({}).to_list(length=None)
            for user in users:
                # Lưu lịch sử trước khi reset
                stats_history = {
                    "week": current_week,
                    "reset_at": reset_at,
                    "total_kicked": user.get("total_kicked", 0),
                    "kicked_win": user.get("kicked_win", 0),
                    "total_keep": user.get("total_keep", 0),
                    "keep_win": user.get("keep_win", 0),
                    "user_type": user.get("user_type", "guest"),
                    "level": user.get("level", 1),
                    "is_pro": user.get("is_pro", False),
                    "vip_level": user.get("vip_level", "NONE")
                }

                # Lưu lịch sử skill trước khi reset
                skill_history_entry = {
                    "week": current_week,
                    "reset_at": reset_at,
                    "kicker_skills": user.get("kicker_skills", []),
                    "goalkeeper_skills": user.get("goalkeeper_skills", []),
                    "action": "reset"
                }

                # Reset skill, chỉ giữ lại skill đầu tiên (index 0)
                kicker_skills = user.get("kicker_skills", [])
                goalkeeper_skills = user.get("goalkeeper_skills", [])
                
                # Chỉ giữ lại skill đầu tiên nếu có
                new_kicker_skills = [kicker_skills[0]] if kicker_skills else []
                new_goalkeeper_skills = [goalkeeper_skills[0]] if goalkeeper_skills else []

                # Update user với skill mới và lịch sử
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {
                            "kicker_skills": new_kicker_skills,
                            "goalkeeper_skills": new_goalkeeper_skills
                        },
                        "$push": {
                            "skill_history": skill_history_entry
                        }
                    }
                )
                
                # Lưu lịch sử điểm tuần cho từng bảng
                for board in ["basic", "pro", "vip"]:
                    week_point = user.get(f"{board}_week_point", 0)
                    week_history_field = f"{board}_week_history"
                    history_entry = {
                        "week": current_week,
                        "point": week_point,
                        "reset_at": reset_at,
                        "user_type": user.get("user_type", "guest"),
                        "level": user.get("level", 1),
                        "is_pro": user.get("is_pro", False),
                        "vip_level": user.get("vip_level", "NONE")
                    }
                    await db.users.update_one(
                        {"_id": user["_id"]},
                        {
                            "$push": {
                                week_history_field: history_entry,
                                "stats_history": stats_history
                            }
                        }
                    )

            # Reset điểm tuần cho từng bảng theo quy tắc mới
            # BASIC: reset mỗi tuần
            await db.users.update_many({}, {
                "$set": {"basic_week_point": 0}
            })
            # PRO: chỉ reset khi tuần chia hết cho 4
            week_number = int(current_week.split('-')[1])
            if week_number % 4 == 0:
                await db.users.update_many({}, {
                    "$set": {"pro_week_point": 0}
                })
            # VIP: không reset vip_week_point
            # Nếu muốn lưu lịch sử thì vẫn push vào vip_week_history như trên, nhưng không reset về 0

            # Reset các trường khác về 0 như cũ
            await db.users.update_many({}, {
                "$set": {
                    "total_kicked": 0,
                    "kicked_win": 0,
                    "total_keep": 0,
                    "keep_win": 0
                }
            })

            # Update last reset week
            await db.settings.update_one(
                {"_id": "weekly_reset"},
                {"$set": {"last_week": current_week}},
                upsert=True
            )
            api_logger.info(f"[WeeklyReset] Successfully reset week to {current_week}")
            
            # Kiểm tra xem có phải tuần thứ 4 không
            if week_number % 4 == 0:  # Mỗi 4 tuần trao thưởng 1 lần
                api_logger.info(f"[WeeklyReward] Week {current_week} is reward week")
                await distribute_weekly_rewards()
            
            # Cập nhật lại level/legend/vip cho toàn bộ user
            await update_all_user_levels()
            return True
        else:
            api_logger.info(f"[WeeklyReset] No reset needed. Current week: {current_week}")
            return False
    except Exception as e:
        api_logger.error(f"[WeeklyReset] Error during reset: {str(e)}")
        return False

if __name__ == "__main__":
    try:
        asyncio.run(reset_week())
    finally:
        # Log completion time
        with open('logs/weekly_reset.log', 'a') as f:
            f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Completed weekly reset check\n") 