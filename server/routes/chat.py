from fastapi import APIRouter, Request, HTTPException
from database.database import get_chat_messages_table, get_users_table
from utils.logger import api_logger
from datetime import datetime
from utils.time_utils import to_vietnam_time, VIETNAM_TZ
import pytz

router = APIRouter()

@router.get("/history")
async def get_chat_history(request: Request, limit: int = 50):
    """
    Get chat history with user information
    """
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authorized")
    
    try:
        chat_messages_table = await get_chat_messages_table()
        users_table = await get_users_table()
        
        # Get messages with user information
        messages_response = await chat_messages_table.select(
            '*, users!inner(*)'
        ).order('timestamp', desc=True).limit(limit).execute()
        
        messages = messages_response.data
        
        # Format messages to match the expected structure
        formatted_messages = []
        for msg in messages:
            # Get user info
            user_info = msg['users']
            
            # Convert timestamp to Vietnam timezone if it's a datetime object
            timestamp = msg["timestamp"]
            if isinstance(timestamp, datetime):
                # If timestamp is naive (no timezone), add Vietnam timezone
                if timestamp.tzinfo is None:
                    timestamp = VIETNAM_TZ.localize(timestamp)
                else:
                    # If it has timezone, convert to Vietnam time
                    timestamp = timestamp.astimezone(VIETNAM_TZ)
            
            formatted_messages.append({
                "type": "chat_message",
                "from_id": msg["from_id"],
                "message": msg["message"],
                "timestamp": timestamp.isoformat() if isinstance(timestamp, datetime) else timestamp,
                "timezone": msg.get("timezone", "Asia/Ho_Chi_Minh"),
                "utc_offset": msg.get("utc_offset", "+07:00"),
                "from": {
                    "id": user_info["id"],
                    "name": user_info["name"],
                    "avatar": user_info["avatar"],
                    "user_type": user_info["user_type"],
                    "role": user_info["role"],
                    "is_active": user_info["is_active"],
                    "is_verified": user_info["is_verified"],
                    "trend": user_info["trend"],
                    "level": user_info["level"],
                    "is_pro": user_info["is_pro"],
                    "position": user_info["position"],
                    "total_point": user_info["total_point"],
                    "bonus_point": user_info["bonus_point"],
                    "total_kicked": user_info["total_kicked"],
                    "kicked_win": user_info["kicked_win"],
                    "total_keep": user_info["total_keep"],
                    "keep_win": user_info["keep_win"],
                    "legend_level": user_info["legend_level"],
                    "vip_level": user_info["vip_level"]
                }
            })
        
        # Sort messages back to chronological order
        formatted_messages.sort(key=lambda x: x["timestamp"])
        
        return {
            "success": True,
            "data": {
                "messages": formatted_messages
            }
        }

    except Exception as e:
        api_logger.error(f"[Chat] Error in get_chat_history handler: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") 