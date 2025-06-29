# JWT Refresh Token System

## Tổng quan

Hệ thống này đã được cập nhật để sử dụng cả Access Token và Refresh Token để giải quyết vấn đề "401: Invalid token" thường xuyên xảy ra.

## Nguyên nhân gốc rễ của lỗi 401

1. **Token hết hạn**: Access token chỉ có hiệu lực trong 3 giờ (180 phút)
2. **Không có cơ chế tự động refresh**: Client không tự động gia hạn token khi hết hạn
3. **Thiếu logging**: Khó debug khi token bị từ chối

## Giải pháp đã triển khai

### 1. Hệ thống Token Pair
- **Access Token**: Có hiệu lực 3 giờ, dùng cho API calls
- **Refresh Token**: Có hiệu lực 30 ngày, dùng để gia hạn access token

### 2. Tự động Refresh
- Client tự động phát hiện lỗi 401
- Tự động gọi API refresh với refresh token
- Retry request ban đầu với access token mới
- Nếu refresh thất bại → redirect to login

### 3. Cải thiện Logging
- Thêm logging chi tiết trong middleware JWT
- Log rõ ràng nguyên nhân token bị từ chối
- Debug dễ dàng hơn

## Cách hoạt động

### Khi đăng nhập:
```javascript
// Server trả về
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}

// Client lưu cả hai
localStorage.setItem('access_token', access_token);
localStorage.setItem('refresh_token', refresh_token);
```

### Khi gọi API:
```javascript
// 1. Gọi API với access token
const response = await fetch('/api/me', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});

// 2. Nếu nhận được 401
if (response.status === 401) {
  // 3. Tự động refresh token
  const refreshSuccess = await refreshToken();
  
  if (refreshSuccess) {
    // 4. Retry với token mới
    const newToken = localStorage.getItem('access_token');
    const retryResponse = await fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${newToken}` }
    });
  } else {
    // 5. Redirect to login nếu refresh thất bại
    window.location.href = '/login';
  }
}
```

## API Endpoints

### Refresh Token
```
POST /api/auth/refresh
Headers: Authorization: Bearer <refresh_token>
Response: {
  "access_token": "new_access_token",
  "refresh_token": "new_refresh_token"
}
```

## Cấu hình

### Environment Variables
```env
JWT_KEY=your-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=180  # 3 giờ
REFRESH_TOKEN_EXPIRE_DAYS=30     # 30 ngày
```

## Lợi ích

1. **Giảm lỗi 401**: Token tự động được gia hạn
2. **Bảo mật tốt hơn**: Access token ngắn hạn, refresh token dài hạn
3. **UX tốt hơn**: User không bị logout đột ngột
4. **Debug dễ dàng**: Logging chi tiết giúp troubleshoot

## Troubleshooting

### Nếu vẫn gặp lỗi 401:

1. **Kiểm tra logs server**:
   ```bash
   # Tìm log JWT middleware
   grep "JWT" server.log
   ```

2. **Kiểm tra localStorage**:
   ```javascript
   console.log('Access Token:', localStorage.getItem('access_token'));
   console.log('Refresh Token:', localStorage.getItem('refresh_token'));
   ```

3. **Kiểm tra token expiration**:
   ```javascript
   // Decode JWT token để xem expiration
   const token = localStorage.getItem('access_token');
   const payload = JSON.parse(atob(token.split('.')[1]));
   console.log('Expires:', new Date(payload.exp * 1000));
   ```

### Common Issues:

1. **Refresh token không tồn tại**: User cần login lại
2. **Server time sync**: Đảm bảo server và client có cùng timezone
3. **Token format**: Kiểm tra token có đúng format JWT không

## Migration Notes

- Hệ thống cũ vẫn hoạt động với access token đơn lẻ
- Refresh token được thêm vào tự động khi login/register
- Không cần thay đổi code hiện tại, chỉ cần restart server 