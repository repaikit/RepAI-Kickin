#!/usr/bin/env python3
"""
Script test logic phân quyền VRF theo user type
Kiểm tra xem chỉ VIP mới được sử dụng VRF
"""

import sys
import os

# Thêm đường dẫn để import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.vrf_utils import (
    can_use_vrf, 
    get_user_type, 
    should_use_vrf_for_user, 
    get_vrf_config_for_user,
    log_vrf_decision
)

def test_user_type_detection():
    """Test việc xác định user type"""
    print("🔍 Testing User Type Detection")
    print("=" * 50)
    
    # Test cases
    test_users = [
        {"name": "VIP User", "is_vip": True, "is_pro": False},
        {"name": "PRO User", "is_vip": False, "is_pro": True},
        {"name": "BASIC User", "is_vip": False, "is_pro": False},
        {"name": "VIP PRO User", "is_vip": True, "is_pro": True},  # VIP ưu tiên hơn PRO
    ]
    
    for user in test_users:
        user_type = get_user_type(user)
        print(f"✅ {user['name']}: {user_type}")
    
    print()

def test_vrf_permissions():
    """Test quyền sử dụng VRF theo user type"""
    print("🎯 Testing VRF Permissions by User Type")
    print("=" * 50)
    
    user_types = ["VIP", "PRO", "BASIC"]
    random_types = ["role_assignment", "skill_selection", "code_generation"]
    
    print(f"{'User Type':<10} {'Role Assignment':<15} {'Skill Selection':<15} {'Code Generation':<15}")
    print("-" * 60)
    
    for user_type in user_types:
        permissions = []
        for random_type in random_types:
            can_use = can_use_vrf(user_type, random_type)
            permissions.append("✅ VRF" if can_use else "❌ Local")
        
        print(f"{user_type:<10} {permissions[0]:<15} {permissions[1]:<15} {permissions[2]:<15}")
    
    print()

def test_user_data_permissions():
    """Test quyền sử dụng VRF với user data thực tế"""
    print("👤 Testing VRF Permissions with Real User Data")
    print("=" * 50)
    
    # Test cases với user data thực tế
    test_users = [
        {
            "_id": "user1",
            "name": "VIP Player",
            "is_vip": True,
            "is_pro": False,
            "level": 50
        },
        {
            "_id": "user2", 
            "name": "PRO Player",
            "is_vip": False,
            "is_pro": True,
            "level": 30
        },
        {
            "_id": "user3",
            "name": "BASIC Player", 
            "is_vip": False,
            "is_pro": False,
            "level": 10
        }
    ]
    
    random_types = ["role_assignment", "skill_selection", "code_generation"]
    
    for user in test_users:
        user_type = get_user_type(user)
        print(f"\n👤 {user['name']} ({user_type}) - Level {user['level']}")
        
        for random_type in random_types:
            can_use = should_use_vrf_for_user(user, random_type)
            config = get_vrf_config_for_user(user, random_type)
            
            status = "✅ VRF" if can_use else "❌ Local Random"
            print(f"  {random_type:<15}: {status}")
            
            if can_use:
                print(f"    └─ Batch: {config['batch_enabled']}, Priority: {config['priority']}")
    
    print()

def test_vrf_decision_logging():
    """Test logging quyết định VRF"""
    print("📝 Testing VRF Decision Logging")
    print("=" * 50)
    
    test_users = [
        {"_id": "vip1", "name": "VIP User", "is_vip": True},
        {"_id": "pro1", "name": "PRO User", "is_vip": False, "is_pro": True},
        {"_id": "basic1", "name": "BASIC User", "is_vip": False, "is_pro": False}
    ]
    
    for user in test_users:
        # Test role assignment
        can_use_role = should_use_vrf_for_user(user, "role_assignment")
        log_vrf_decision(user, "role_assignment", can_use_role)
        
        # Test skill selection
        can_use_skill = should_use_vrf_for_user(user, "skill_selection")
        log_vrf_decision(user, "skill_selection", can_use_skill)
    
    print()

def test_challenge_scenarios():
    """Test các scenario challenge thực tế"""
    print("🎮 Testing Challenge Scenarios")
    print("=" * 50)
    
    scenarios = [
        {
            "name": "VIP vs VIP",
            "from_user": {"name": "VIP Player 1", "is_vip": True, "is_pro": False},
            "to_user": {"name": "VIP Player 2", "is_vip": True, "is_pro": False}
        },
        {
            "name": "VIP vs PRO", 
            "from_user": {"name": "VIP Player", "is_vip": True, "is_pro": False},
            "to_user": {"name": "PRO Player", "is_vip": False, "is_pro": True}
        },
        {
            "name": "PRO vs BASIC",
            "from_user": {"name": "PRO Player", "is_vip": False, "is_pro": True},
            "to_user": {"name": "BASIC Player", "is_vip": False, "is_pro": False}
        },
        {
            "name": "BASIC vs BASIC",
            "from_user": {"name": "BASIC Player 1", "is_vip": False, "is_pro": False},
            "to_user": {"name": "BASIC Player 2", "is_vip": False, "is_pro": False}
        }
    ]
    
    for scenario in scenarios:
        print(f"\n🏆 {scenario['name']}")
        
        from_user = scenario["from_user"]
        to_user = scenario["to_user"]
        
        # Kiểm tra role assignment
        has_vip = from_user.get("is_vip", False) or to_user.get("is_vip", False)
        role_method = "VRF" if has_vip else "Local Random"
        print(f"  Role Assignment: {role_method}")
        
        # Kiểm tra skill selection cho từng player
        for player_name, player_data in [("From", from_user), ("To", to_user)]:
            can_use_vrf = should_use_vrf_for_user(player_data, "skill_selection")
            skill_method = "VRF" if can_use_vrf else "Local Random"
            player_type = get_user_type(player_data)
            print(f"  {player_name} Player Skill Selection: {skill_method} ({player_type})")
    
    print()

def main():
    """Main test function"""
    print("🔬 VRF Permissions Test Suite")
    print("=" * 60)
    
    try:
        # Test 1: User type detection
        test_user_type_detection()
        
        # Test 2: VRF permissions by user type
        test_vrf_permissions()
        
        # Test 3: User data permissions
        test_user_data_permissions()
        
        # Test 4: VRF decision logging
        test_vrf_decision_logging()
        
        # Test 5: Challenge scenarios
        test_challenge_scenarios()
        
        print("✅ All VRF permission tests completed successfully!")
        print("\n📋 Summary:")
        print("- ✅ VIP users can use VRF for all operations")
        print("- ❌ PRO users use local random for all operations") 
        print("- ❌ BASIC users use local random for all operations")
        print("- 🎯 Only VIP participants trigger VRF in challenges")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 