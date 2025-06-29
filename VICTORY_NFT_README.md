# Victory NFT - Chainlink CCIP Integration

## Tổng quan

Victory NFT là tính năng tự động mint NFT cross-chain khi người chơi thắng đủ 10 trận trong game Kickin. NFT sẽ được mint trên mạng Avalanche Fuji testnet thông qua Chainlink CCIP.

## Cách hoạt động

### 1. Điều kiện mint NFT
- Người chơi phải thắng đủ **10 trận** (milestone: 10, 20, 30, 40...)
- Phải có địa chỉ ví (wallet hoặc evm_address) trong profile
- Backend sẽ tự động kiểm tra và mint khi đạt milestone

### 2. Quy trình mint
1. **Backend kiểm tra**: Sau mỗi trận thắng, backend tính tổng số trận thắng
2. **Kiểm tra milestone**: Nếu tổng trận thắng chia hết cho 10 → đủ điều kiện mint
3. **Mint NFT**: Gọi CCIP service để mint NFT trên Avalanche Fuji
4. **Lưu lịch sử**: Lưu thông tin mint vào database
5. **Thông báo**: Gửi thông báo cho người chơi qua WebSocket

### 3. Cấu trúc NFT
```json
{
  "name": "Victory NFT #1",
  "description": "PlayerName achieved 10 victories in Kickin!",
  "image": "https://api.kickin.com/nft/victory/10.png",
  "attributes": [
    {"trait_type": "Total Wins", "value": 10},
    {"trait_type": "Milestone", "value": 1},
    {"trait_type": "Game", "value": "Kickin"},
    {"trait_type": "Chain", "value": "Avalanche Fuji"},
    {"trait_type": "Minted At", "value": "2024-01-01T12:00:00"}
  ]
}
```

## Cấu hình

### Environment Variables
```bash
# CCIP Configuration
CCIP_PRIVATE_KEY=your_private_key_here
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_FUJI_NFT_CONTRACT=0x0000000000000000000000000000000000000000
```

### Chain Configuration
- **Source Chain**: Base Sepolia (Chain ID: 8453)
- **Destination Chain**: Avalanche Fuji (Chain ID: 43113)
- **CCIP Router**: 
  - Base Sepolia: `0x536d7E53D0aDeB1F20E7c81fea45d02eC8dBD2b8`
  - Avalanche Fuji: `0x554472a2720E5E7D5D3C817529aBA05EEd5F82D8`

## API Endpoints

### 1. Lấy lịch sử Victory NFT
```http
GET /api/victory_nft/history/{user_id}
```

Response:
```json
{
  "user_id": "user_id",
  "player_address": "0x...",
  "player_name": "Player Name",
  "total_wins": 25,
  "milestone_count": 2,
  "next_milestone": 30,
  "wins_to_next": 5,
  "victory_nfts": [
    {
      "id": "nft_id",
      "milestone": 1,
      "total_wins": 10,
      "message_id": "0x...",
      "destination_chain": "Avalanche Fuji",
      "contract_address": "0x...",
      "status": "minted",
      "minted_at": "2024-01-01T12:00:00"
    }
  ]
}
```

### 2. Thống kê toàn cục
```http
GET /api/victory_nft/stats
```

### 3. Leaderboard Victory NFT
```http
GET /api/victory_nft/leaderboard
```

## Database Schema

### Collection: `victory_nfts`
```javascript
{
  "_id": ObjectId,
  "player_address": "0x...",
  "total_wins": 10,
  "milestone": 1,
  "message_id": "0x...",
  "destination_chain": "Avalanche Fuji",
  "contract_address": "0x...",
  "minted_at": "2024-01-01T12:00:00",
  "status": "minted"
}
```

## Frontend Components

### 1. VictoryNFT Component
- Hiển thị trong tab Statistics của profile
- Hiển thị progress đến milestone tiếp theo
- Danh sách Victory NFT đã mint
- Link đến Avalanche Fuji explorer

### 2. VictoryNFTModal Component
- Modal hiển thị khi đạt milestone
- Nút mint NFT (nếu cần manual trigger)
- Thông tin về CCIP và cross-chain

## Backend Services

### 1. CCIPService (`server/services/ccip_service.py`)
- Xử lý mint NFT cross-chain
- Tạo metadata cho NFT
- Gọi CCIP Router contract
- Log lịch sử mint

### 2. Challenge Handler Integration
- Tích hợp vào `server/ws_handlers/challenge_handler.py`
- Kiểm tra milestone sau mỗi trận thắng
- Gọi mint NFT asynchronously

## WebSocket Messages

### Victory NFT Minted
```json
{
  "type": "victory_nft_minted",
  "message": "🎉 Congratulations! Your Victory NFT has been minted on Avalanche Fuji!",
  "total_wins": 10,
  "milestone": 1,
  "message_id": "0x..."
}
```

## Monitoring & Logging

### Log Messages
- `Victory NFT minted successfully for PlayerName (0x...) with 10 wins`
- `Failed to mint Victory NFT for PlayerName (0x...): error_message`
- `Player user_id has no wallet address for Victory NFT minting`

### Metrics
- Tổng số NFT đã mint
- Số người chơi unique đã mint
- NFT minted trong 24h gần nhất
- Top milestones

## Troubleshooting

### 1. NFT không được mint
- Kiểm tra `CCIP_PRIVATE_KEY` đã được set
- Kiểm tra user có wallet address không
- Kiểm tra logs để xem lỗi cụ thể

### 2. CCIP Service không hoạt động
- Kiểm tra RPC URLs
- Kiểm tra contract addresses
- Kiểm tra gas fee và LINK balance

### 3. Frontend không hiển thị
- Kiểm tra API endpoints
- Kiểm tra authentication
- Kiểm tra console errors

## Development

### Deploy NFT Contract
1. Deploy Victory NFT contract trên Avalanche Fuji
2. Update `AVALANCHE_FUJI_NFT_CONTRACT` environment variable
3. Test mint function

### Test CCIP Integration
1. Setup test environment với testnet
2. Test cross-chain message
3. Verify NFT mint trên destination chain

## Security Considerations

1. **Private Key Security**: CCIP_PRIVATE_KEY phải được bảo mật
2. **Rate Limiting**: Tránh spam mint requests
3. **Validation**: Validate user data trước khi mint
4. **Error Handling**: Handle gracefully khi CCIP fails

## Future Enhancements

1. **Multiple Chains**: Support nhiều destination chains
2. **Custom Metadata**: Cho phép user customize NFT metadata
3. **NFT Trading**: Tích hợp marketplace để trade Victory NFTs
4. **Rare NFTs**: Special NFTs cho milestones đặc biệt (100, 500, 1000 wins)
5. **NFT Staking**: Stake Victory NFTs để earn rewards 