#!/usr/bin/env python3
"""
Script test hiệu suất VRF với Pre-warming System
So sánh thời gian giữa có và không có pre-warming
"""

import asyncio
import time
import sys
import os

# Thêm đường dẫn để import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.vrf_initializer import initialize_vrf_system, get_vrf_status
from utils.chainlink_vrf import ChainlinkVRF

async def test_without_prewarm():
    """Test VRF không có pre-warming"""
    print("🧪 Testing VRF WITHOUT Pre-warming")
    print("=" * 50)
    
    # Tạo VRF instance mới (không pre-warm)
    vrf = ChainlinkVRF()
    
    start_time = time.time()
    results = []
    
    # Test 10 requests liên tiếp
    for i in range(10):
        print(f"  Request {i+1}/10...")
        request_start = time.time()
        result = await vrf.get_random_int(100)
        request_time = time.time() - request_start
        results.append(request_time)
        print(f"    Result: {result}, Time: {request_time:.2f}s")
    
    total_time = time.time() - start_time
    avg_time = total_time / 10
    
    print(f"✅ Without pre-warm completed in {total_time:.2f}s (avg: {avg_time:.2f}s per request)")
    return total_time, avg_time

async def test_with_prewarm():
    """Test VRF có pre-warming"""
    print("🚀 Testing VRF WITH Pre-warming")
    print("=" * 50)
    
    # Khởi tạo VRF với pre-warming
    print("  Initializing VRF with pre-warming...")
    vrf = await initialize_vrf_system(100)
    
    # Kiểm tra trạng thái
    status = get_vrf_status()
    print(f"  Cache size: {status['cache_size']}")
    print(f"  Cache level: {status['cache_level']}")
    
    start_time = time.time()
    results = []
    
    # Test 10 requests liên tiếp
    for i in range(10):
        print(f"  Request {i+1}/10...")
        request_start = time.time()
        result = await vrf.get_random_int(100)
        request_time = time.time() - request_start
        results.append(request_time)
        print(f"    Result: {result}, Time: {request_time:.4f}s")
    
    total_time = time.time() - start_time
    avg_time = total_time / 10
    
    print(f"✅ With pre-warm completed in {total_time:.2f}s (avg: {avg_time:.4f}s per request)")
    return total_time, avg_time

async def test_cache_performance():
    """Test hiệu suất cache"""
    print("⚡ Testing Cache Performance")
    print("=" * 50)
    
    # Khởi tạo VRF với pre-warming
    vrf = await initialize_vrf_system(200)
    
    # Đợi cache được fill
    await asyncio.sleep(2)
    
    start_time = time.time()
    results = []
    
    # Test 50 requests từ cache
    for i in range(50):
        result = await vrf.get_random_int(100)
        results.append(result)
    
    total_time = time.time() - start_time
    avg_time = total_time / 50
    
    print(f"✅ Cache performance: {total_time:.2f}s for 50 requests (avg: {avg_time:.4f}s per request)")
    return total_time, avg_time

async def test_first_request_performance():
    """Test hiệu suất request đầu tiên"""
    print("🎯 Testing First Request Performance")
    print("=" * 50)
    
    # Test 1: Không có pre-warm
    print("  Test 1: Without pre-warm")
    vrf1 = ChainlinkVRF()
    start_time = time.time()
    result1 = await vrf1.get_random_int(100)
    time1 = time.time() - start_time
    print(f"    Result: {result1}, Time: {time1:.2f}s")
    
    # Test 2: Có pre-warm
    print("  Test 2: With pre-warm")
    vrf2 = await initialize_vrf_system(100)
    start_time = time.time()
    result2 = await vrf2.get_random_int(100)
    time2 = time.time() - start_time
    print(f"    Result: {result2}, Time: {time2:.4f}s")
    
    improvement = ((time1 - time2) / time1) * 100
    print(f"  Improvement: {improvement:.1f}% faster with pre-warming")
    
    return time1, time2

async def test_challenge_simulation():
    """Simulate challenge với pre-warming"""
    print("🎮 Testing Challenge Simulation with Pre-warming")
    print("=" * 50)
    
    # Khởi tạo VRF với pre-warming
    vrf = await initialize_vrf_system(100)
    
    start_time = time.time()
    
    # Simulate role assignment
    role_result = await vrf.get_random_int(2)
    print(f"  Role assignment: {role_result}")
    
    # Simulate skill selection for both players
    kicker_skill = await vrf.get_random_int(5)
    goalkeeper_skill = await vrf.get_random_int(5)
    print(f"  Kicker skill: {kicker_skill}, Goalkeeper skill: {goalkeeper_skill}")
    
    end_time = time.time()
    total_time = end_time - start_time
    
    print(f"✅ Challenge simulation completed in {total_time:.4f}s")
    return total_time

async def main():
    """Main test function"""
    print("🔬 VRF Pre-warming Performance Test Suite")
    print("=" * 60)
    
    try:
        # Test 1: Without pre-warming
        without_total, without_avg = await test_without_prewarm()
        print()
        
        # Test 2: With pre-warming
        with_total, with_avg = await test_with_prewarm()
        print()
        
        # Test 3: Cache performance
        cache_total, cache_avg = await test_cache_performance()
        print()
        
        # Test 4: First request performance
        first_without, first_with = await test_first_request_performance()
        print()
        
        # Test 5: Challenge simulation
        challenge_time = await test_challenge_simulation()
        print()
        
        # Kết quả so sánh
        print("📊 Performance Comparison:")
        print("=" * 60)
        print(f"Without Pre-warm: {without_avg:.2f}s per request")
        print(f"With Pre-warm:    {with_avg:.4f}s per request")
        print(f"Cache Performance: {cache_avg:.4f}s per request")
        print(f"First Request:    {first_without:.2f}s → {first_with:.4f}s")
        print(f"Challenge Sim:    {challenge_time:.4f}s total")
        print()
        
        # Tính toán cải thiện
        if without_avg > 0:
            improvement = ((without_avg - with_avg) / without_avg) * 100
            print(f"🚀 Pre-warming improvement: {improvement:.1f}% faster")
        
        if first_without > 0:
            first_improvement = ((first_without - first_with) / first_without) * 100
            print(f"🎯 First request improvement: {first_improvement:.1f}% faster")
        
        if cache_avg > 0:
            cache_improvement = ((with_avg - cache_avg) / with_avg) * 100
            print(f"⚡ Cache improvement: {cache_improvement:.1f}% faster than pre-warm")
        
        print("\n✅ All pre-warming tests completed successfully!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main()) 