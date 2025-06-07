import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import calendar
from utils.time_utils import get_vietnam_time
from database.database import get_users_table, get_leaderboard_weekly_table, get_leaderboard_monthly_table, get_settings_table
from utils.logger import api_logger
from ws_handlers.challenge_handler import update_user_levels

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
    settings_table = await get_settings_table()
    response = await settings_table.select("*").eq("id", "weekly_reset").execute()
    settings = response.data[0] if response.data else None
    return settings and settings.get("last_week") == current_week

async def save_weekly_leaderboard(current_week, board, top_10):
    leaderboard_weekly_table = await get_leaderboard_weekly_table()
    await leaderboard_weekly_table.insert({
        "week": current_week,
        "board": board,
        "top_10": [
            {
                "user_id": u["user_id"],
                "rank": idx + 1,
                "total_point": u.get("total_point", 0),
                "kicked_win": u.get("kicked_win", 0),
                "keep_win": u.get("keep_win", 0)
            }
            for idx, u in enumerate(top_10)
        ],
        "created_at": get_vietnam_time().isoformat()
    }).execute()

async def save_monthly_leaderboard(year, month, board, top_10):
    leaderboard_monthly_table = await get_leaderboard_monthly_table()
    await leaderboard_monthly_table.insert({
        "year": year,
        "month": month,
        "board": board,
        "top_10": [
            {
                "user_id": u["user_id"],
                "rank": idx + 1,
                "bonus_point": REWARD_TABLE[board][idx] if idx < len(REWARD_TABLE[board]) else 0,
                "total_point": u.get("total_point", 0),
                "kicked_win": u.get("kicked_win", 0),
                "keep_win": u.get("keep_win", 0)
            }
            for idx, u in enumerate(top_10)
        ],
        "created_at": get_vietnam_time().isoformat()
    }).execute()

async def reward_top_10(users, board, current_week, now):
    users_table = await get_users_table()
    user_points = []
    for user in users:
        week_history = user.get("week_history", [])
        last_4 = sorted(week_history, key=lambda x: x["week"], reverse=True)[:4]
        total = sum(item.get("point", 0) for item in last_4)
        earliest_reset = min([w.get("reset_at") for w in last_4], default="9999-99-99T99:99:99")
        user_points.append({
            "user_id": user["id"],
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
        reward_history = user_info.get("reward_history", [])
        reward_history.append({
            "week": current_week,
            "board": board,
            "rank": idx + 1,
            "reward": reward,
            "distributed_at": now.isoformat()
        })
        await users_table.update({
            "bonus_point": new_bonus,
            "reward_history": reward_history
        }).eq("id", user_info["user_id"]).execute()
    # Lưu leaderboard tuần
    await save_weekly_leaderboard(
        current_week, board,
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

async def distribute_rewards(current_week):
    """Phân phối phần thưởng cho top 10 người chơi"""
    try:
        now = get_vietnam_time()
        users_table = await get_users_table()
        
        # BASIC
        response = await users_table.select("*").eq("is_pro", False).eq("is_vip", False).execute()
        basic_users = response.data
        await reward_top_10(basic_users, "BASIC", current_week, now)
        
        # PRO
        response = await users_table.select("*").eq("is_pro", True).eq("is_vip", False).execute()
        pro_users = response.data
        await reward_top_10(pro_users, "PRO", current_week, now)
        
        # VIP
        response = await users_table.select("*").eq("is_vip", True).execute()
        vip_users = response.data
        await reward_top_10(vip_users, "VIP", current_week, now)
        
        return True
    except Exception as e:
        api_logger.error(f"[WeeklyReward] Error distributing rewards: {str(e)}")
        return False

async def save_monthly_leaderboard_for_all_boards(now):
    users_table = await get_users_table()
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
        response = await users_table.select("*").match(query).execute()
        users = response.data
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
                "user_id": user["id"],
                "total_point": month_points,
                "kicked_win": month_kicked_win,
                "keep_win": month_keep_win
            })
        user_points.sort(
            key=lambda x: -x["total_point"]
        )
        top_10 = user_points[:10]
        await save_monthly_leaderboard(
            year, month, board,
            top_10
        )

async def reset_week(ignore_time_check=False, force_week=None):
    """Reset điểm tuần và trao thưởng"""
    try:
        # Kiểm tra quyền reset
        if not await validate_reset_permission(ignore_time_check=ignore_time_check):
            return False

        users_table = await get_users_table()
        settings_table = await get_settings_table()
        now = get_vietnam_time()
        if force_week:
            current_week = force_week
            week_number = int(current_week.split('-')[1])
        else:
            current_week = f"{now.year}-{now.isocalendar()[1]:02d}"
            week_number = int(current_week.split('-')[1])
        
        # Kiểm tra đã reset chưa
        if await check_already_reset(current_week):
            return False

        # 1. Lưu leaderboard tuần cho từng bảng TRƯỚC KHI RESET
        for board, query in {
            "BASIC": {"is_pro": False, "is_vip": False},
            "PRO": {"is_pro": True, "is_vip": False},
            "VIP": {"is_vip": True}
        }.items():
            response = await users_table.select("*").match(query).execute()
            users = response.data
            user_points = []
            for user in users:
                week_history = user.get("week_history", [])
                last_entry = week_history[-1] if week_history else None
                week_point = last_entry["point"] if last_entry and last_entry["week"] == current_week else user.get("total_point", 0)
                # BASIC: week_point là điểm tuần vừa reset, PRO/VIP: lấy total_point hiện tại
                if board == "BASIC":
                    point = user.get("total_point", 0)
                else:
                    point = user.get("total_point", 0)
                user_points.append({
                    "user_id": user["id"],
                    "total_point": point,
                    "kicked_win": user.get("kicked_win", 0),
                    "keep_win": user.get("keep_win", 0)
                })
            user_points.sort(
                key=lambda x: -x["total_point"]
            )
            top_10 = user_points[:10]
            await save_weekly_leaderboard(current_week, board, top_10)

        # 2. Phân phối phần thưởng
        await distribute_rewards(current_week)

        # 3. Reset điểm tuần cho tất cả user
        response = await users_table.select("*").execute()
        users = response.data
        for user in users:
            week_history = user.get("week_history", [])
            week_history.append({
                "week": current_week,
                "point": user.get("total_point", 0),
                "kicked_win": user.get("kicked_win", 0),
                "keep_win": user.get("keep_win", 0),
                "reset_at": now.isoformat()
            })
            # Giữ lại 4 tuần gần nhất
            week_history = sorted(week_history, key=lambda x: x["week"], reverse=True)[:4]
            
            # Reset các trường thống kê
            update_data = {
                "week_history": week_history,
                "total_point": 0,
                "kicked_win": 0,
                "keep_win": 0,
                "updated_at": now.isoformat()
            }
            
            # Cập nhật level nếu cần
            await update_user_levels(user, update_data)
            
            # Cập nhật user
            await users_table.update(update_data).eq("id", user["id"]).execute()

        # 4. Lưu thời điểm reset
        await settings_table.upsert({
            "id": "weekly_reset",
            "last_week": current_week,
            "last_reset": now.isoformat()
        }).execute()

        # 5. Lưu leaderboard tháng nếu là tuần cuối tháng
        if week_number % 4 == 0:
            await save_monthly_leaderboard_for_all_boards(now)

        return True
    except Exception as e:
        api_logger.error(f"[WeeklyReset] Error during reset: {str(e)}")
        return False

if __name__ == "__main__":
    try:
        asyncio.run(reset_week())
    finally:
        # Log completion time
        with open('logs/weekly_reset.log', 'a') as f:
            f.write(f"[{get_vietnam_time().strftime('%Y-%m-%d %H:%M:%S')}] Completed weekly reset\n") 