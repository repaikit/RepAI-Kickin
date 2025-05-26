from datetime import datetime, timedelta
from typing import Dict, List, Tuple
from utils.time_utils import get_vietnam_time, to_vietnam_time, format_vietnam_time

def get_week_number(date: datetime) -> str:
    """Lấy số tuần trong năm theo định dạng YYYY-WW"""
    # Chuyển đổi về giờ Việt Nam
    date = to_vietnam_time(date)
    
    # Tính tuần dựa trên ngày đầu tiên của năm
    year = date.year
    first_day = datetime(year, 1, 1)
    first_day = to_vietnam_time(first_day)
    
    # Điều chỉnh để ngày đầu tiên là thứ 2
    while first_day.weekday() != 0:
        first_day += timedelta(days=1)
    
    # Tính số tuần
    delta = date - first_day
    week = (delta.days // 7) + 1
    
    # Nếu tuần > 52, có thể là tuần đầu tiên của năm sau
    if week > 52:
        next_year = year + 1
        next_first_day = datetime(next_year, 1, 1)
        next_first_day = to_vietnam_time(next_first_day)
        while next_first_day.weekday() != 0:
            next_first_day += timedelta(days=1)
        if date >= next_first_day:
            return f"{next_year}-01"
    
    return f"{year}-{week:02d}"

def get_current_week() -> str:
    """Lấy tuần hiện tại"""
    return get_week_number(get_vietnam_time())

def get_week_dates(week_number: str) -> List[str]:
    """Lấy danh sách các ngày trong tuần theo định dạng YYYY-MM-DD"""
    year, week = map(int, week_number.split("-"))
    
    # Tìm ngày đầu tiên của năm
    first_day = datetime(year, 1, 1)
    first_day = to_vietnam_time(first_day)
    
    # Điều chỉnh để ngày đầu tiên là thứ 2
    while first_day.weekday() != 0:
        first_day += timedelta(days=1)
    
    # Tính ngày đầu tiên của tuần cần tìm
    start_date = first_day + timedelta(weeks=week-1)
    
    # Tạo danh sách 7 ngày trong tuần
    return [(start_date + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]

def get_last_5_weeks() -> List[str]:
    """Lấy danh sách 5 tuần gần nhất, bao gồm tuần hiện tại"""
    current_week = get_current_week()
    year, week = map(int, current_week.split("-"))
    weeks = []
    
    for i in range(4, -1, -1):  # 4 tuần trước + tuần hiện tại
        if week - i >= 0:
            weeks.append(f"{year}-{week-i:02d}")
        else:
            # Nếu tuần trước thuộc năm trước
            prev_year = year - 1
            prev_week = 52 + (week - i)  # 52 tuần trong năm
            weeks.append(f"{prev_year}-{prev_week:02d}")
    
    return weeks

def update_weekly_login(user_data: Dict, points: int = 0) -> Dict:
    """Cập nhật thông tin đăng nhập theo tuần"""
    current_date = get_vietnam_time()
    current_week = get_week_number(current_date)
    current_date_str = current_date.strftime("%Y-%m-%d")
    
    # Khởi tạo weekly_logins nếu chưa có
    if "weekly_logins" not in user_data:
        user_data["weekly_logins"] = {}
    
    # Xóa dữ liệu cũ của ngày hiện tại trong tất cả các tuần
    for week in list(user_data["weekly_logins"].keys()):
        if current_date_str in user_data["weekly_logins"][week]:
            del user_data["weekly_logins"][week][current_date_str]
    
    # Khởi tạo dữ liệu cho tuần hiện tại nếu chưa có
    if current_week not in user_data["weekly_logins"]:
        user_data["weekly_logins"][current_week] = {}
    
    # Ghi nhận đăng nhập cho ngày hiện tại, lưu cả điểm
    user_data["weekly_logins"][current_week][current_date_str] = {"login": True, "points": points}
    
    return user_data

def get_weekly_stats(user_data: Dict) -> List[Dict]:
    """Lấy thống kê đăng nhập của 5 tuần gần nhất"""
    weeks = get_last_5_weeks()
    stats = []
    week_history_map = {w['week']: w['point'] for w in user_data.get('week_history', [])}
    total_point = user_data.get("total_point", 0)
    for idx, week in enumerate(weeks):
        week_dates = get_week_dates(week)
        # Lấy điểm tuần từ week_history nếu có, tuần hiện tại thì lấy total_point
        if idx == len(weeks) - 1:
            week_point = total_point
        else:
            week_point = week_history_map.get(week, 0)
        week_data = {
            "week": week,
            "dates": [],
            "total_points": week_point
        }
        for date in week_dates:
            has_login = bool(user_data.get("weekly_logins", {}).get(week, {}).get(date, False))
            week_data["dates"].append({
                "date": date,
                "has_login": has_login
            })
        stats.append(week_data)
    return stats 