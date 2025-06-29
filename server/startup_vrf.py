#!/usr/bin/env python3
"""
VRF Startup Script - Khởi tạo VRF system ngay khi server start
"""

import asyncio
import sys
import os

# Thêm đường dẫn để import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.vrf_initializer import initialize_vrf_system, get_vrf_status
from utils.logger import api_logger
from config.vrf_config import VRF_BATCH_CONFIG

async def startup_vrf():
    """
    Khởi tạo VRF system khi server start
    """
    try:
        api_logger.info("🚀 Starting VRF system initialization...")
        
        # Khởi tạo VRF với pre-warm
        prewarm_size = VRF_BATCH_CONFIG.get("cache_size", 200) // 2  # Pre-warm 50% cache
        vrf_instance = await initialize_vrf_system(prewarm_size)
        
        # Kiểm tra trạng thái
        status = get_vrf_status()
        api_logger.info(f"✅ VRF system initialized successfully!")
        api_logger.info(f"   - Cache size: {status['cache_size']}")
        api_logger.info(f"   - Cache level: {status['cache_level']}")
        api_logger.info(f"   - Init duration: {status['init_duration']}")
        
        return vrf_instance
        
    except Exception as e:
        api_logger.error(f"❌ Error during VRF startup: {e}")
        return None

async def check_vrf_health():
    """
    Kiểm tra sức khỏe VRF system
    """
    try:
        status = get_vrf_status()
        
        if not status["initialized"]:
            api_logger.warning("⚠️ VRF system not initialized")
            return False
        
        cache_level = float(status["cache_level"].rstrip('%')) / 100
        
        if cache_level < 0.1:  # Cache dưới 10%
            api_logger.warning(f"⚠️ VRF cache low: {status['cache_level']}")
            return False
        
        api_logger.info(f"✅ VRF system healthy - Cache: {status['cache_level']}")
        return True
        
    except Exception as e:
        api_logger.error(f"❌ Error checking VRF health: {e}")
        return False

if __name__ == "__main__":
    # Test VRF startup
    asyncio.run(startup_vrf()) 