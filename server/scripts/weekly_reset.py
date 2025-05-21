import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import calendar
from utils.time_utils import get_vietnam_time
from database.database import get_database
from utils.logger import api_logger
from ws_handlers.challenge_handler import update_user_levels
from bson import ObjectId

REWARD_TABLE = {
    "BASIC": [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    "PRO":   [20, 19, 18, 17, 16, 15, 14, 13, 12, 11],
    "VIP":   [50, 40, 30, 20, 20, 20, 10, 10, 10, 10]
}

os.makedirs('logs', exist_ok=True)

async def validate_reset_permission(ignore_time_check=False):
    """Kiểm tra quyền thực hiện reset. Nếu ignore_time_check=True thì luôn cho phép (dùng cho test)."""
    if ignore_time_check:
        return True
    now = get_vietnam_time()
    # Chỉ cho phép reset vào 00:00 thứ 2
    if now.weekday() != 0 or now.hour != 0:
        return False
    return True

async def check_already_reset(current_week: str) -> bool:
    """Kiểm tra xem đã reset tuần này chưa"""
    db = await get_database()
    settings = await db.settings.find_one({"_id": "weekly_reset"})
    return settings and settings.get("last_week") == current_week

async def save_weekly_leaderboard(db, current_week, board, top_10):
    await db.leaderboard_weekly.insert_one({
        "week": current_week,
        "board": board,
        "top_10": [
            {
                "user_id": str(u["user_id"]),
                "rank": idx + 1,
                "total_point": u.get("total_point", 0),
                "kicked_win": u.get("kicked_win", 0),
                "keep_win": u.get("keep_win", 0)
            }
            for idx, u in enumerate(top_10)
        ],
        "created_at": get_vietnam_time().isoformat()
    })

async def save_monthly_leaderboard(db, year, month, board, top_10):
    await db.leaderboard_monthly.insert_one({
        "year": year,
        "month": month,
        "board": board,
        "top_10": [
            {
                "user_id": str(u["user_id"]),
                "rank": idx + 1,
                "bonus_point": REWARD_TABLE[board][idx] if idx < len(REWARD_TABLE[board]) else 0,
                "total_point": u.get("total_point", 0),
                "kicked_win": u.get("kicked_win", 0),
                "keep_win": u.get("keep_win", 0)
            }
            for idx, u in enumerate(top_10)
        ],
        "created_at": get_vietnam_time().isoformat()
    })

async def reward_top_10(db, users, board, current_week, now):
    user_points = []
    for user in users:
        week_history = user.get("week_history", [])
        last_4 = sorted(week_history, key=lambda x: x["week"], reverse=True)[:4]
        total = sum(item.get("point", 0) for item in last_4)
        earliest_reset = min([w.get("reset_at") for w in last_4], default="9999-99-99T99:99:99")
        user_points.append({
            "user_id": user["_id"],
            "name": user.get("name", ""),
            "avatar": user.get("avatar", ""),
            "bonus_point": user.get("bonus_point", 0.0),
            "total_point": total,
            "kicked_win": user.get("kicked_win", 0),
            "keep_win": user.get("keep_win", 0),
            "earliest_reset": earliest_reset,
            "current_bonus": user.get("bonus_point", 0.0)
        })
    user_points.sort(
        key=lambda x: (
            -x["total_point"],
            -(x["kicked_win"] + x["keep_win"]),
            x["earliest_reset"],
            x["name"]
        )
    )
    top_10 = user_points[:10]
    for idx, user_info in enumerate(top_10):
        reward = REWARD_TABLE[board][idx]
        new_bonus = user_info["current_bonus"] + reward
        await db.users.update_one(
            {"_id": user_info["user_id"]},
            {
                "$set": {"bonus_point": new_bonus},
                "$push": {
                    "reward_history": {
                        "week": current_week,
                        "board": board,
                        "rank": idx + 1,
                        "reward": reward,
                        "distributed_at": now.isoformat()
                    }
                }
            }
        )
    # Lưu leaderboard tuần
    await save_weekly_leaderboard(
        db, current_week, board,
        [
            {
                "user_id": u["user_id"],
                "name": u["name"],
                "avatar": u.get("avatar", ""),
                "bonus_point": u.get("bonus_point", 0),
                "total_point": u["total_point"],
                "kicked_win": u.get("kicked_win", 0),
                "keep_win": u.get("keep_win", 0),
                "rank": idx + 1
            }
            for idx, u in enumerate(top_10)
        ]
    )

async def distribute_rewards(db, current_week):
    """Phân phối phần thưởng cho top 10 người chơi"""
    try:
        now = get_vietnam_time()
        # BASIC
        basic_users = await db.users.find({"is_pro": False, "is_vip": False}).to_list(length=None)
        await reward_top_10(db, basic_users, "BASIC", current_week, now)
        # PRO
        pro_users = await db.users.find({"is_pro": True, "is_vip": False}).to_list(length=None)
        await reward_top_10(db, pro_users, "PRO", current_week, now)
        # VIP
        vip_users = await db.users.find({"is_vip": True}).to_list(length=None)
        await reward_top_10(db, vip_users, "VIP", current_week, now)
        api_logger.info(f"[WeeklyReward] Successfully distributed rewards for week {current_week}")
        return True
    except Exception as e:
        api_logger.error(f"[WeeklyReward] Error distributing rewards: {str(e)}")
        return False

async def save_monthly_leaderboard_for_all_boards(db, now):
    year = now.year
    month = now.month
    weeks_in_month = set()
    for day in range(1, calendar.monthrange(year, month)[1] + 1):
        d = now.replace(day=day)
        weeks_in_month.add(f"{year}-{d.isocalendar()[1]:02d}")
    for board, query in {
        "BASIC": {"is_pro": False, "is_vip": False},
        "PRO": {"is_pro": True, "is_vip": False},
        "VIP": {"is_vip": True}
    }.items():
        users = await db.users.find(query).to_list(length=None)
        user_points = []
        for user in users:
            if board == "BASIC":
                month_points = sum(
                    w.get("point", 0)
                    for w in user.get("week_history", [])
                    if w["week"] in weeks_in_month
                )
                # Nếu week_history có kicked_win/keep_win thì cộng tổng, nếu không thì lấy từ user hiện tại
                month_kicked_win = sum(
                    w.get("kicked_win", 0)
                    for w in user.get("week_history", [])
                    if w["week"] in weeks_in_month
                )
                month_keep_win = sum(
                    w.get("keep_win", 0)
                    for w in user.get("week_history", [])
                    if w["week"] in weeks_in_month
                )
                # Nếu không có dữ liệu trong week_history thì fallback về user hiện tại
                if month_kicked_win == 0:
                    month_kicked_win = user.get("kicked_win", 0)
                if month_keep_win == 0:
                    month_keep_win = user.get("keep_win", 0)
            else:
                month_points = user.get("total_point", 0)
                month_kicked_win = user.get("kicked_win", 0)
                month_keep_win = user.get("keep_win", 0)
            user_points.append({
                "user_id": user["_id"],
                "total_point": month_points,
                "kicked_win": month_kicked_win,
                "keep_win": month_keep_win
            })
        user_points.sort(
            key=lambda x: -x["total_point"]
        )
        top_10 = user_points[:10]
        await save_monthly_leaderboard(
            db, year, month, board,
            top_10
        )

async def reset_week(ignore_time_check=False, force_week=None):
    """Reset điểm tuần và trao thưởng"""
    try:
        # Kiểm tra quyền reset
        if not await validate_reset_permission(ignore_time_check=ignore_time_check):
            api_logger.info("[WeeklyReset] Not authorized to reset at this time")
            return False

        db = await get_database()
        now = get_vietnam_time()
        if force_week:
            current_week = force_week
            week_number = int(current_week.split('-')[1])
        else:
            current_week = f"{now.year}-{now.isocalendar()[1]:02d}"
            week_number = int(current_week.split('-')[1])
        
        # Kiểm tra đã reset chưa
        if await check_already_reset(current_week):
            api_logger.info(f"[WeeklyReset] Week {current_week} already reset")
            return False
            
        api_logger.info(f"[WeeklyReset] Starting reset for week {current_week}")
        
        # Reset tất cả trong 1 lần update
        users = await db.users.find({}).to_list(length=None)
        for user in users:
            # Lưu lịch sử tuần với điểm thực tế
            await db.users.update_one(
                {"_id": user["_id"]},
                {
                    "$push": {
                        "week_history": {
                            "week": current_week,
                            "point": user.get("total_point", 0),
                            "reset_at": now.isoformat()
                        }
                    }
                }
            )
            # Reset kicker_skills và goalkeeper_skills: chỉ giữ lại skill ở index 0
            new_kicker_skills = user.get("kicker_skills", [])[:1]
            new_goalkeeper_skills = user.get("goalkeeper_skills", [])[:1]
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {
                    "kicker_skills": new_kicker_skills,
                    "goalkeeper_skills": new_goalkeeper_skills
                }}
            )
            # Reset total_point về 0
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"total_point": 0, "total_kicked": 0, "kicked_win": 0, "total_keep": 0, "keep_win": 0}}
            )

        # Lưu leaderboard tuần cho từng bảng
        for board, query in {
            "BASIC": {"is_pro": False, "is_vip": False},
            "PRO": {"is_pro": True, "is_vip": False},
            "VIP": {"is_vip": True}
        }.items():
            users = await db.users.find(query).to_list(length=None)
            user_points = []
            for user in users:
                week_history = user.get("week_history", [])
                last_entry = week_history[-1] if week_history else None
                week_point = last_entry["point"] if last_entry and last_entry["week"] == current_week else 0
                # BASIC: week_point là điểm tuần vừa reset, PRO/VIP: lấy total_point hiện tại
                if board == "BASIC":
                    point = week_point
                else:
                    point = user.get("total_point", 0)
                user_points.append({
                    "user_id": user["_id"],
                    "total_point": point,
                    "kicked_win": user.get("kicked_win", 0),
                    "keep_win": user.get("keep_win", 0)
                })
            user_points.sort(key=lambda x: -x["total_point"])
            top_10 = user_points[:10]
            await save_weekly_leaderboard(db, current_week, board, top_10)

        # Cập nhật tuần reset cuối
        await db.settings.update_one(
            {"_id": "weekly_reset"},
            {"$set": {"last_week": current_week}},
            upsert=True
        )
        
        # Trao thưởng mỗi 4 tuần
        if week_number % 4 == 0:
            api_logger.info(f"[WeeklyReward] Week {current_week} is reward week")
            await distribute_rewards(db, current_week)
        
        # Nếu là tuần cuối tháng thì tổng hợp và lưu leaderboard tháng
        last_day = calendar.monthrange(now.year, now.month)[1]
        last_date = now.replace(day=last_day)
        last_week_of_month = f"{now.year}-{last_date.isocalendar()[1]:02d}"
        if current_week == last_week_of_month:
            api_logger.info(f"[MonthlyLeaderboard] Saving monthly leaderboard for {now.year}-{now.month}")
            await save_monthly_leaderboard_for_all_boards(db, now)
        
        # Cập nhật level cho tất cả người chơi
        users = await db.users.find({}).to_list(length=None)
        for user in users:
            await update_user_levels(str(user["_id"]), db)
            
        api_logger.info(f"[WeeklyReset] Successfully completed reset for week {current_week}")
        return True
        
    except Exception as e:
        api_logger.error(f"[WeeklyReset] Error during reset: {str(e)}")
        return False

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--ignore-time-check', action='store_true', help='Bỏ qua kiểm tra thời gian để test reset bất cứ lúc nào')
    parser.add_argument('--force-week', type=str, help='Ép mã tuần, ví dụ: 2025-21')
    args = parser.parse_args()
    try:
        asyncio.run(reset_week(ignore_time_check=args.ignore_time_check, force_week=args.force_week))
    finally:
        # Log completion time
        with open('logs/weekly_reset.log', 'a') as f:
            f.write(f"[{get_vietnam_time().strftime('%Y-%m-%d %H:%M:%S')}] Completed weekly reset check\n") 