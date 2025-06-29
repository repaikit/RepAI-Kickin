# 🚀 VRF Batch Manager - Hướng dẫn sử dụng

## 📋 Tổng quan

VRF Batch Manager là giải pháp tối ưu hóa hiệu suất cho Chainlink VRF, giúp giảm thời gian chờ từ 5-30 giây xuống còn 1-2 giây cho các trận đấu. **Chỉ VIP Player mới được sử dụng VRF**.

## 🎯 Lợi ích

- ⚡ **Giảm latency**: Từ 5-30s xuống 1-2s
- 💰 **Tiết kiệm gas**: Batch nhiều requests thành một
- 🎮 **Trải nghiệm tốt hơn**: Người chơi không phải chờ lâu
- 🔒 **Vẫn đảm bảo công bằng**: Sử dụng VRF thực sự
- 👑 **Phân quyền rõ ràng**: Chỉ VIP mới được sử dụng VRF

## 🏗️ Kiến trúc

```
Challenge Request
       ↓
   Check User Type (VIP/PRO/BASIC)
       ↓
   VIP? → VRF Batch Manager
   PRO/BASIC? → Local Random
       ↓
   Cache Check (200 numbers)
       ↓
   Batch VRF Request (50 requests)
       ↓
   Distribute Results
```

## ⚙️ Cấu hình

### File: `server/config/vrf_config.py`

```python
VRF_BATCH_CONFIG = {
    "batch_size": 50,      # Số requests tối thiểu để trigger batch
    "cache_size": 200,     # Số lượng số cache
    "min_interval": 2,     # Thời gian tối thiểu giữa batches (giây)
    "max_batch_requests": 10,  # Số VRF requests tối đa mỗi batch
    "timeout": 30,         # Timeout cho VRF requests
}
```

### Cấu hình theo loại user:

```python
USER_VRF_CONFIG = {
    "VIP": {
        "use_vrf": True,           # ✅ Chỉ VIP mới dùng VRF
        "batch_enabled": True,     # Bật batch cho VIP
        "fallback_to_local": True  # Fallback nếu VRF fail
    },
    "PRO": {
        "use_vrf": False,          # ❌ PRO dùng random thường
        "batch_enabled": False,
        "fallback_to_local": True
    },
    "BASIC": {
        "use_vrf": False,          # ❌ BASIC dùng random thường
        "batch_enabled": False,
        "fallback_to_local": True
    }
}
```

### Cấu hình cho các loại random:

```python
RANDOM_TYPE_CONFIG = {
    "role_assignment": {
        "use_vrf": True,           # Chỉ VIP mới dùng VRF cho role assignment
        "batch_enabled": True,
        "priority": "high",
        "vip_only": True           # 🔒 Chỉ VIP mới được sử dụng
    },
    "skill_selection": {
        "use_vrf": True,           # Chỉ VIP mới dùng VRF cho skill selection
        "batch_enabled": True,
        "priority": "medium",
        "vip_only": True           # 🔒 Chỉ VIP mới được sử dụng
    },
    "code_generation": {
        "use_vrf": True,           # Admin tạo code vẫn dùng VRF
        "batch_enabled": True,
        "priority": "low",
        "vip_only": False          # Admin không phải VIP nhưng vẫn dùng VRF
    }
}
```

## 🎮 Cách hoạt động trong Challenge

### 1. Gán vai trò (Role Assignment)

```python
# Chỉ khi có VIP tham gia mới dùng VRF
has_vip_participant = from_user_is_vip or to_user_is_vip

if has_vip_participant:
    # VIP match - sử dụng VRF
    vrf_random_role = await chainlink_vrf.get_random_int(2)
    kicker_id = from_id if vrf_random_role == 0 else to_id
else:
    # Basic/PRO match - dùng random thường
    roles = ["kicker", "goalkeeper"]
    random.shuffle(roles)
    kicker_id = from_id if roles[0] == "kicker" else to_id
```

### 2. Chọn skill (Skill Selection)

```python
# Chỉ VIP mới dùng VRF để chọn skill
kicker_should_use_vrf = should_use_vrf_for_user(kicker, "skill_selection")

if kicker_should_use_vrf:
    # VIP Kicker sử dụng VRF
    kicker_skill_idx = await chainlink_vrf.get_random_int(len(kicker_skills))
    selected_kicker_skill = kicker_skills[kicker_skill_idx]
else:
    # Basic/PRO Kicker dùng random thường
    selected_kicker_skill = random.choice(kicker_skills)
```

### 3. Tạo mã mời (Code Generation)

```python
# Admin tạo mã VIP/PRO với VRF (không cần VIP)
random_codes = await chainlink_vrf.generate_random_code(prefix, req.count)
```

## 👑 Phân quyền VRF

### ✅ VIP Player

- **Role Assignment**: Sử dụng VRF
- **Skill Selection**: Sử dụng VRF
- **Code Generation**: Không áp dụng (chỉ admin)

### ❌ PRO Player

- **Role Assignment**: Local random
- **Skill Selection**: Local random
- **Code Generation**: Không áp dụng (chỉ admin)

### ❌ BASIC Player

- **Role Assignment**: Local random
- **Skill Selection**: Local random
- **Code Generation**: Không áp dụng (chỉ admin)

## 🧪 Test hiệu suất

Chạy script test để so sánh hiệu suất:

```bash
cd server/scripts
python test_vrf_performance.py
```

### Test phân quyền VRF:

```bash
cd server/scripts
python test_vrf_permissions.py
```

Kết quả mong đợi:

```
🔬 VRF Permissions Test Suite
============================================================
🔍 Testing User Type Detection
✅ VIP User: VIP
✅ PRO User: PRO
✅ BASIC User: BASIC

🎯 Testing VRF Permissions by User Type
User Type  Role Assignment  Skill Selection  Code Generation
------------------------------------------------------------
VIP        ✅ VRF          ✅ VRF          ✅ VRF
PRO        ❌ Local        ❌ Local        ❌ Local
BASIC      ❌ Local        ❌ Local        ❌ Local

🎮 Testing Challenge Scenarios
🏆 VIP vs VIP
  Role Assignment: VRF
  From Player Skill Selection: VRF (VIP)
  To Player Skill Selection: VRF (VIP)

🏆 VIP vs PRO
  Role Assignment: VRF
  From Player Skill Selection: VRF (VIP)
  To Player Skill Selection: Local Random (PRO)

🏆 PRO vs BASIC
  Role Assignment: Local Random
  From Player Skill Selection: Local Random (PRO)
  To Player Skill Selection: Local Random (BASIC)
```

## 🔧 Troubleshooting

### Vấn đề thường gặp:

1. **VRF timeout**

   - Kiểm tra kết nối blockchain
   - Tăng timeout trong config
   - Fallback về local random

2. **Cache empty**

   - Đợi batch đầu tiên hoàn thành
   - Kiểm tra batch_size có quá lớn không

3. **Gas fee cao**

   - Giảm batch_size
   - Tăng min_interval
   - Sử dụng cache nhiều hơn

4. **Basic Player sử dụng VRF**
   - Kiểm tra cấu hình `vip_only: true`
   - Kiểm tra logic `should_use_vrf_for_user()`

### Log monitoring:

```python
# Thêm vào code để debug
print(f"[VRF Batch] Processing {len(requests)} requests...")
print(f"[VRF Batch] Cache size: {len(self.cached_numbers)}")
print(f"[VRF Decision] {user_name} ({user_type}) - {random_type}: ✅ VRF")
```

## 📈 Monitoring

### Metrics cần theo dõi:

1. **Latency**: Thời gian trung bình mỗi request
2. **Cache hit rate**: Tỷ lệ sử dụng cache
3. **Batch efficiency**: Số requests mỗi batch
4. **Fallback rate**: Tỷ lệ fallback về local random
5. **VRF usage by user type**: Tỷ lệ VIP vs Basic sử dụng VRF

### Dashboard metrics:

```python
# Thêm vào VRFBatchManager
self.metrics = {
    "total_requests": 0,
    "vip_requests": 0,
    "basic_requests": 0,
    "cache_hits": 0,
    "batch_requests": 0,
    "fallback_requests": 0,
    "avg_latency": 0.0
}
```

## 🚀 Deployment

### Environment variables:

```bash
# .env
AVALANCHE_FUJI_RPC_URL=https://avalanche-fuji-c-chain-rpc.publicnode.com
VRF_CONSUMER_CONTRACT_ADDRESS=0x...
PRIVATE_KEY=your_private_key
```

### Production settings:

```python
# Tăng cache size cho production
VRF_BATCH_CONFIG = {
    "batch_size": 10,     # Tăng batch size
    "cache_size": 50,     # Tăng cache size
    "min_interval": 1,     # Giảm interval
}
```

## 📝 Changelog

### v1.1.0 (Current)

- ✅ VIP-only VRF access
- ✅ User type detection
- ✅ Permission management
- ✅ Detailed logging
- ✅ Permission testing

### v1.0.0 (Previous)

- ✅ Batch VRF Manager
- ✅ Cache system
- ✅ Config management
- ✅ Performance testing
- ✅ Fallback mechanism

### v1.2.0 (Planned)

- 🔄 Smart contract batch support
- 📊 Metrics dashboard
- 🔔 Alert system
- 🎯 Priority queuing

## 🤝 Contributing

Để đóng góp cải thiện VRF Batch Manager:

1. Fork repository
2. Tạo feature branch
3. Implement changes
4. Test performance và permissions
5. Submit pull request

## 📞 Support

Nếu gặp vấn đề, liên hệ:

- 📧 Email: support@kickin.com
- 💬 Discord: #vrf-support
- 📖 Docs: https://docs.kickin.com/vrf
