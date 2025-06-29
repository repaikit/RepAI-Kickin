#!/usr/bin/env python3
"""
Start Server with VRF Initialization
Script để start server với VRF system được khởi tạo đúng cách
"""

import asyncio
import sys
import os
import uvicorn
from pathlib import Path

# Thêm đường dẫn để import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from startup_vrf import startup_vrf, check_vrf_health
from utils.vrf_initializer import get_vrf_status
from utils.logger import api_logger

async def initialize_vrf_before_server():
    """Khởi tạo VRF trước khi start server"""
    print("🚀 Initializing VRF system before server start...")
    
    try:
        # Khởi tạo VRF
        vrf_instance = await startup_vrf()
        
        if vrf_instance:
            # Kiểm tra trạng thái
            status = get_vrf_status()
            print(f"✅ VRF system initialized successfully!")
            print(f"   - Cache size: {status['cache_size']}")
            print(f"   - Cache level: {status['cache_level']}")
            print(f"   - Init duration: {status['init_duration']}")
            
            # Kiểm tra health
            health = await check_vrf_health()
            if health['healthy']:
                print(f"✅ VRF system is healthy: {health['message']}")
            else:
                print(f"⚠️ VRF system has issues: {health['message']}")
            
            return True
        else:
            print("❌ VRF system initialization failed")
            return False
            
    except Exception as e:
        print(f"❌ Error initializing VRF: {e}")
        return False

def start_server():
    """Start FastAPI server"""
    print("🌐 Starting FastAPI server...")
    
    # Cấu hình server
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "false").lower() == "true"
    
    print(f"   - Host: {host}")
    print(f"   - Port: {port}")
    print(f"   - Reload: {reload}")
    
    # Start server
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )

async def main():
    """Main function"""
    print("🎮 RepAI-Kickin Server with VRF")
    print("=" * 50)
    
    try:
        # Bước 1: Khởi tạo VRF
        vrf_success = await initialize_vrf_before_server()
        
        if vrf_success:
            print("\n✅ VRF system ready!")
        else:
            print("\n⚠️ VRF system initialization failed, server will start with fallback")
        
        # Bước 2: Start server
        print("\n🚀 Starting server...")
        start_server()
        
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except Exception as e:
        print(f"\n❌ Error starting server: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Chạy với asyncio để khởi tạo VRF trước
    asyncio.run(main()) 