from fastapi import APIRouter, HTTPException
from utils.cache_manager import cache_manager

router = APIRouter()

@router.get("/cache/stats")
async def get_cache_stats():
    """
    Lấy thống kê về cache
    """
    return cache_manager.get_stats()

@router.post("/cache/clear")
async def clear_cache():
    """
    Xóa toàn bộ cache
    """
    cache_manager.clear()
    return {"message": "Cache cleared successfully"} 