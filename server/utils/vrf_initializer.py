"""
VRF Initializer - Khởi tạo và pre-warm VRF system ngay khi server start
"""

import asyncio
import threading
import time
from typing import Optional
from utils.chainlink_vrf import ChainlinkVRF
from utils.logger import api_logger

class VRFInitializer:
    """
    Singleton class để khởi tạo VRF system
    """
    _instance: Optional['VRFInitializer'] = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, 'initialized'):
            self.initialized = False
            self.vrf_instance: Optional[ChainlinkVRF] = None
            self.prewarm_completed = False
            self.init_start_time = None
            self.init_duration = None
    
    async def initialize_vrf(self, prewarm_size: int = 10) -> ChainlinkVRF:
        """
        Khởi tạo VRF system và pre-warm cache
        """
        if self.initialized and self.vrf_instance:
            api_logger.info("[VRF Init] VRF already initialized, returning existing instance")
            return self.vrf_instance
        
        self.init_start_time = time.time()
        api_logger.info("[VRF Init] Starting VRF initialization...")
        
        try:
            # Khởi tạo VRF instance
            self.vrf_instance = ChainlinkVRF()
            api_logger.info("[VRF Init] VRF instance created successfully")
            
            # Pre-warm cache
            api_logger.info(f"[VRF Init] Pre-warming cache with {prewarm_size} numbers...")
            await self.vrf_instance.batch_manager.prewarm_cache(prewarm_size)
            
            self.prewarm_completed = True
            self.initialized = True
            self.init_duration = time.time() - self.init_start_time
            
            api_logger.info(f"[VRF Init] VRF initialization completed in {self.init_duration:.2f}s")
            
            return self.vrf_instance
            
        except Exception as e:
            api_logger.error(f"[VRF Init] Error initializing VRF: {e}")
            # Fallback: tạo instance mà không pre-warm
            if not self.vrf_instance:
                self.vrf_instance = ChainlinkVRF()
            self.initialized = True
            return self.vrf_instance
    
    def get_vrf_instance(self) -> Optional[ChainlinkVRF]:
        """
        Lấy VRF instance (synchronous)
        """
        return self.vrf_instance
    
    async def get_vrf_instance_async(self) -> ChainlinkVRF:
        """
        Lấy VRF instance (asynchronous)
        """
        if not self.initialized:
            return await self.initialize_vrf()
        return self.vrf_instance
    
    def get_status(self) -> dict:
        """
        Lấy trạng thái VRF system
        """
        if not self.vrf_instance:
            return {
                "initialized": False,
                "prewarm_completed": False,
                "cache_size": 0,
                "init_duration": None
            }
        
        cache_size = len(self.vrf_instance.batch_manager.cached_numbers)
        cache_level = cache_size / self.vrf_instance.batch_manager.cache_size
        
        return {
            "initialized": self.initialized,
            "prewarm_completed": self.prewarm_completed,
            "cache_size": cache_size,
            "cache_level": f"{cache_level:.1%}",
            "init_duration": f"{self.init_duration:.2f}s" if self.init_duration else None,
            "batch_manager": {
                "batch_size": self.vrf_instance.batch_manager.batch_size,
                "cache_size": self.vrf_instance.batch_manager.cache_size,
                "pending_requests": len(self.vrf_instance.batch_manager.pending_requests),
                "is_processing": self.vrf_instance.batch_manager.is_processing
            }
        }

# Global instance
vrf_initializer = VRFInitializer()

async def initialize_vrf_system(prewarm_size: int = 100) -> ChainlinkVRF:
    """
    Helper function để khởi tạo VRF system
    """
    return await vrf_initializer.initialize_vrf(prewarm_size)

def get_vrf_status() -> dict:
    """
    Helper function để lấy trạng thái VRF
    """
    return vrf_initializer.get_status() 