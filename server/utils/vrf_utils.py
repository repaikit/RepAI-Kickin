"""
Utility functions cho VRF management
"""

from config.vrf_config import USER_VRF_CONFIG, RANDOM_TYPE_CONFIG

def can_use_vrf(user_type: str, random_type: str = "skill_selection") -> bool:
    """
    Kiểm tra xem user có được phép sử dụng VRF hay không
    
    Args:
        user_type: Loại user ("VIP", "PRO", "BASIC")
        random_type: Loại random ("role_assignment", "skill_selection", "code_generation")
    
    Returns:
        bool: True nếu được phép sử dụng VRF
    """
    # Lấy cấu hình cho user type
    user_config = USER_VRF_CONFIG.get(user_type, USER_VRF_CONFIG["BASIC"])
    
    # Lấy cấu hình cho random type
    random_config = RANDOM_TYPE_CONFIG.get(random_type, RANDOM_TYPE_CONFIG["skill_selection"])
    
    # Kiểm tra điều kiện sử dụng VRF
    can_use = (
        user_config["use_vrf"] and 
        random_config["use_vrf"] and 
        (not random_config.get("vip_only", False) or user_type == "VIP")
    )
    
    return can_use

def get_user_type(user_data: dict) -> str:
    """
    Xác định loại user từ user data
    
    Args:
        user_data: Dictionary chứa thông tin user
    
    Returns:
        str: Loại user ("VIP", "PRO", "BASIC")
    """
    if user_data.get("is_vip", False):
        return "VIP"
    elif user_data.get("is_pro", False):
        return "PRO"
    else:
        return "BASIC"

def should_use_vrf_for_user(user_data: dict, random_type: str = "skill_selection") -> bool:
    """
    Kiểm tra xem user có nên sử dụng VRF hay không
    
    Args:
        user_data: Dictionary chứa thông tin user
        random_type: Loại random operation
    
    Returns:
        bool: True nếu nên sử dụng VRF
    """
    user_type = get_user_type(user_data)
    return can_use_vrf(user_type, random_type)

def get_vrf_config_for_user(user_data: dict, random_type: str = "skill_selection") -> dict:
    """
    Lấy cấu hình VRF cho user
    
    Args:
        user_data: Dictionary chứa thông tin user
        random_type: Loại random operation
    
    Returns:
        dict: Cấu hình VRF cho user
    """
    user_type = get_user_type(user_data)
    user_config = USER_VRF_CONFIG.get(user_type, USER_VRF_CONFIG["BASIC"])
    random_config = RANDOM_TYPE_CONFIG.get(random_type, RANDOM_TYPE_CONFIG["skill_selection"])
    
    return {
        "use_vrf": should_use_vrf_for_user(user_data, random_type),
        "batch_enabled": user_config["batch_enabled"] and random_config["batch_enabled"],
        "fallback_to_local": user_config["fallback_to_local"],
        "priority": random_config.get("priority", "medium"),
        "user_type": user_type
    }

def log_vrf_decision(user_data: dict, random_type: str, decision: bool, reason: str = ""):
    """
    Log quyết định sử dụng VRF
    
    Args:
        user_data: Dictionary chứa thông tin user
        random_type: Loại random operation
        decision: Quyết định có sử dụng VRF hay không
        reason: Lý do (optional)
    """
    user_type = get_user_type(user_data)
    user_name = user_data.get("name", "Anonymous")
    user_id = str(user_data.get("_id", "unknown"))
    
    vrf_status = "✅ VRF" if decision else "❌ Local Random"
    reason_text = f" - {reason}" if reason else ""
    
    print(f"[VRF Decision] {user_name} ({user_id}) - {user_type} - {random_type}: {vrf_status}{reason_text}") 