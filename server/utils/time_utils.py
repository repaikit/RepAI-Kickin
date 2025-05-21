from datetime import datetime
import pytz

# Set Vietnam timezone
VIETNAM_TZ = pytz.timezone('Asia/Ho_Chi_Minh')

def get_vietnam_time() -> datetime:
    """Get current time in Vietnam timezone"""
    return datetime.now(VIETNAM_TZ)

def to_vietnam_time(dt: datetime) -> datetime:
    """Convert any datetime to Vietnam timezone"""
    if dt.tzinfo is None:
        return VIETNAM_TZ.localize(dt)
    return dt.astimezone(VIETNAM_TZ)

def format_vietnam_time(dt: datetime) -> str:
    """Format datetime in Vietnam timezone to ISO format"""
    return to_vietnam_time(dt).isoformat() 