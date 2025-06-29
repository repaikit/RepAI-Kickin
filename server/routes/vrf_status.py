"""
API endpoints để kiểm tra trạng thái VRF system
"""

from fastapi import APIRouter, HTTPException
from utils.vrf_initializer import get_vrf_status, initialize_vrf_system
from utils.logger import api_logger

router = APIRouter()

@router.get("/vrf/status")
async def get_vrf_system_status():
    """
    Lấy trạng thái VRF system
    """
    try:
        status = get_vrf_status()
        return {
            "success": True,
            "data": status
        }
    except Exception as e:
        api_logger.error(f"Error getting VRF status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/vrf/initialize")
async def initialize_vrf():
    """
    Khởi tạo VRF system (admin only)
    """
    try:
        api_logger.info("Manual VRF initialization requested")
        vrf_instance = await initialize_vrf_system(100)
        
        status = get_vrf_status()
        return {
            "success": True,
            "message": "VRF system initialized successfully",
            "data": status
        }
    except Exception as e:
        api_logger.error(f"Error initializing VRF: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/vrf/health")
async def check_vrf_health():
    """
    Kiểm tra sức khỏe VRF system
    """
    try:
        status = get_vrf_status()
        
        if not status["initialized"]:
            return {
                "healthy": False,
                "status": "not_initialized",
                "message": "VRF system not initialized"
            }
        
        cache_level = float(status["cache_level"].rstrip('%')) / 100
        
        if cache_level < 0.1:  # Cache dưới 10%
            return {
                "healthy": False,
                "status": "low_cache",
                "message": f"VRF cache low: {status['cache_level']}",
                "cache_level": status["cache_level"]
            }
        
        return {
            "healthy": True,
            "status": "healthy",
            "message": "VRF system is healthy",
            "cache_level": status["cache_level"],
            "cache_size": status["cache_size"]
        }
        
    except Exception as e:
        api_logger.error(f"Error checking VRF health: {e}")
        return {
            "healthy": False,
            "status": "error",
            "message": f"Error checking VRF health: {str(e)}"
        } 