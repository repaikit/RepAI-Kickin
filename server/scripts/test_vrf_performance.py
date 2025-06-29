#!/usr/bin/env python3
"""
Script test hiệu suất VRF Batch Manager
So sánh thời gian giữa VRF trực tiếp và batch VRF
"""

import asyncio
import time
import sys
import os

# Thêm đường dẫn để import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.chainlink_vrf import ChainlinkVRF, VRFBatchManager
from config.vrf_config import VRF_BATCH_CONFIG

async def test_direct_vrf():
    """Test VRF trực tiếp"""
    print("🧪 Testing Direct VRF...")
    vrf = ChainlinkVRF()
    
    start_time = time.time()
    results = []
    
    for i in range(5):  # Test 5 requests
        print(f"  Request {i+1}/5...")
        result = await vrf.get_direct_vrf(100)
        results.append(result)
        print(f"    Result: {result}")
    
    end_time = time.time()
    total_time = end_time - start_time
    avg_time = total_time / 5
    
    print(f"✅ Direct VRF completed in {total_time:.2f}s (avg: {avg_time:.2f}s per request)")
    return total_time, avg_time

async def test_batch_vrf():
    """Test Batch VRF"""
    print("🚀 Testing Batch VRF...")
    vrf = ChainlinkVRF()
    
    start_time = time.time()
    results = []
    
    # Tạo nhiều requests cùng lúc
    tasks = []
    for i in range(20):  # Test 20 requests
        task = vrf.get_random_int(100)
        tasks.append(task)
    
    print(f"  Sending {len(tasks)} requests to batch manager...")
    results = await asyncio.gather(*tasks)
    
    end_time = time.time()
    total_time = end_time - start_time
    avg_time = total_time / len(tasks)
    
    print(f"✅ Batch VRF completed in {total_time:.2f}s (avg: {avg_time:.2f}s per request)")
    print(f"  Results: {results[:5]}... (showing first 5)")
    return total_time, avg_time

async def test_cache_performance():
    """Test hiệu suất cache"""
    print("⚡ Testing Cache Performance...")
    vrf = ChainlinkVRF()
    
    # Đợi cache được fill
    print("  Waiting for cache to be filled...")
    await asyncio.sleep(5)
    
    start_time = time.time()
    results = []
    
    # Test 50 requests từ cache
    for i in range(50):
        result = await vrf.get_random_int(100)
        results.append(result)
    
    end_time = time.time()
    total_time = end_time - start_time
    avg_time = total_time / 50
    
    print(f"✅ Cache performance: {total_time:.2f}s for 50 requests (avg: {avg_time:.4f}s per request)")
    return total_time, avg_time

async def test_challenge_simulation():
    """Simulate một trận đấu thực tế"""
    print("🎮 Simulating Challenge Match...")
    vrf = ChainlinkVRF()
    
    start_time = time.time()
    
    # Simulate role assignment
    role_result = await vrf.get_random_int(2)
    print(f"  Role assignment: {role_result}")
    
    # Simulate skill selection for both players
    kicker_skill = await vrf.get_random_int(5)  # 5 skills
    goalkeeper_skill = await vrf.get_random_int(5)  # 5 skills
    print(f"  Kicker skill: {kicker_skill}, Goalkeeper skill: {goalkeeper_skill}")
    
    end_time = time.time()
    total_time = end_time - start_time
    
    print(f"✅ Challenge simulation completed in {total_time:.2f}s")
    return total_time

async def main():
    """Main test function"""
    print("🔬 VRF Performance Test Suite")
    print("=" * 50)
    
    try:
        # Test 1: Direct VRF
        direct_total, direct_avg = await test_direct_vrf()
        print()
        
        # Test 2: Batch VRF
        batch_total, batch_avg = await test_batch_vrf()
        print()
        
        # Test 3: Cache Performance
        cache_total, cache_avg = await test_cache_performance()
        print()
        
        # Test 4: Challenge Simulation
        challenge_time = await test_challenge_simulation()
        print()
        
        # Kết quả so sánh
        print("📊 Performance Comparison:")
        print("=" * 50)
        print(f"Direct VRF:     {direct_avg:.2f}s per request")
        print(f"Batch VRF:      {batch_avg:.2f}s per request")
        print(f"Cache VRF:      {cache_avg:.4f}s per request")
        print(f"Challenge Sim:  {challenge_time:.2f}s total")
        print()
        
        # Tính toán cải thiện
        if direct_avg > 0:
            improvement = ((direct_avg - batch_avg) / direct_avg) * 100
            print(f"🚀 Batch VRF improvement: {improvement:.1f}% faster than direct VRF")
        
        if batch_avg > 0:
            cache_improvement = ((batch_avg - cache_avg) / batch_avg) * 100
            print(f"⚡ Cache improvement: {cache_improvement:.1f}% faster than batch VRF")
        
        print("\n✅ All tests completed successfully!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main()) 