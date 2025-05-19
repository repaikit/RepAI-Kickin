from datetime import datetime, timedelta
from database.database import get_users_collection
from utils.logger import api_logger
from bson import ObjectId

async def cleanup_inactive_guest_accounts():
    """Xóa các tài khoản guest sau 7 ngày tạo nếu chưa upgrade"""
    try:
        users_collection = await get_users_collection()
        cutoff_date = datetime.utcnow() - timedelta(days=7)
        
        # Tìm và xóa các guest accounts được tạo trước 7 ngày
        result = await users_collection.delete_many({
            "user_type": "guest",
            "created_at": {"$lt": cutoff_date}
        })
        
        if result.deleted_count > 0:
            api_logger.info(f"Cleaned up {result.deleted_count} guest accounts older than 7 days")
            
    except Exception as e:
        api_logger.error(f"Error cleaning up guest accounts: {str(e)}") 