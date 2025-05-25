from datetime import datetime, timedelta
from typing import Dict, List, Tuple
from utils.time_utils import get_vietnam_time

def get_week_number(date: datetime) -> str:
    """Lấy số tuần trong năm theo định dạng YYYY-WW"""
    # Sử dụng isocalendar() để lấy tuần chính xác
    year, week, _ = date.isocalendar()
    return f"{year}-{week:02d}"

def get_current_week() -> str:
    """Lấy tuần hiện tại"""
    return get_week_number(get_vietnam_time())

def get_week_dates(week_number: str) -> List[str]:
    """Lấy danh sách các ngày trong tuần theo định dạng YYYY-MM-DD"""
    year, week = map(int, week_number.split("-"))
    # Tìm ngày đầu tiên của tuần
    first_day = datetime(year, 1, 1)
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
    
    # Khởi tạo dữ liệu cho tuần hiện tại nếu chưa có
    if current_week not in user_data["weekly_logins"]:
        user_data["weekly_logins"][current_week] = {}
    
    # Chỉ ghi nhận đăng nhập, không cần điểm
    user_data["weekly_logins"][current_week][current_date_str] = True
    
    return user_data

def get_weekly_stats(user_data: Dict) -> List[Dict]:
    """Lấy thống kê đăng nhập của 5 tuần gần nhất"""
    weeks = get_last_5_weeks()
    stats = []
    
    # Debug log
    print("Weekly logins from user_data:", user_data.get("weekly_logins", {}))
    
    for week in weeks:
        week_dates = get_week_dates(week)
        week_data = {
            "week": week,
            "dates": [],
            "total_points": 0
        }
        
        # Debug log
        print(f"Processing week {week}")
        print(f"Week dates: {week_dates}")
        print(f"Week logins: {user_data.get('weekly_logins', {}).get(week, {})}")
        
        for date in week_dates:
            has_login = user_data.get("weekly_logins", {}).get(week, {}).get(date, False)
            # Debug log
            print(f"Date {date} has_login: {has_login}")
            
            week_data["dates"].append({
                "date": date,
                "points": 0,
                "has_login": has_login
            })
        
        stats.append(week_data)
    
    return stats 