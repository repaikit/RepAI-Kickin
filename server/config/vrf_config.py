"""
Cấu hình VRF cho hệ thống
"""

# Cấu hình Batch VRF Manager
VRF_BATCH_CONFIG = {
    "batch_size": 50,  # Số lượng requests tối thiểu để trigger batch
    "cache_size": 200,  # Số lượng số ngẫu nhiên cache
    "min_interval": 2,  # Thời gian tối thiểu giữa các batch requests (giây)
    "max_batch_requests": 10,  # Số lượng VRF requests tối đa mỗi batch
    "timeout": 30,  # Timeout cho VRF requests (giây)
}

# Cấu hình cho các loại user khác nhau
USER_VRF_CONFIG = {
    "VIP": {
        "use_vrf": True,           # Chỉ VIP mới dùng VRF
        "batch_enabled": True,     # Bật batch cho VIP
        "fallback_to_local": True  # Fallback nếu VRF fail
    },
    "PRO": {
        "use_vrf": False,          # PRO dùng random thường
        "batch_enabled": False,
        "fallback_to_local": True
    },
    "BASIC": {
        "use_vrf": False,          # BASIC dùng random thường
        "batch_enabled": False,
        "fallback_to_local": True
    }
}

# Cấu hình cho các loại random khác nhau
RANDOM_TYPE_CONFIG = {
    "role_assignment": {
        "use_vrf": True,           # Chỉ VIP mới dùng VRF cho role assignment
        "batch_enabled": True,
        "priority": "high",
        "vip_only": True           # Chỉ VIP mới được sử dụng
    },
    "skill_selection": {
        "use_vrf": True,           # Chỉ VIP mới dùng VRF cho skill selection
        "batch_enabled": True,
        "priority": "medium",
        "vip_only": True           # Chỉ VIP mới được sử dụng
    },
    "code_generation": {
        "use_vrf": True,           # Admin tạo code vẫn dùng VRF
        "batch_enabled": True,
        "priority": "low",
        "vip_only": False          # Admin không phải VIP nhưng vẫn dùng VRF
    }
} 