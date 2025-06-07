from datetime import datetime, timedelta
from database.database import get_users_table
from utils.logger import api_logger

async def cleanup_inactive_guest_accounts():
    """Xóa các tài khoản guest sau 7 ngày tạo nếu chưa upgrade"""
    try:
        users_table = await get_users_table()
        cutoff_date = datetime.utcnow() - timedelta(days=7)
        
        # Tìm và xóa các guest accounts được tạo trước 7 ngày
        response = await users_table.delete().eq("user_type", "guest").lt("created_at", cutoff_date.isoformat()).execute()
        
        if response.data:
            api_logger.info(f"Cleaned up {len(response.data)} guest accounts older than 7 days")
            
    except Exception as e:
        api_logger.error(f"Error cleaning up guest accounts: {str(e)}") 