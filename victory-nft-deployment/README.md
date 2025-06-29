# Victory NFT Deployment Guide

Hướng dẫn deploy Victory NFT contract lên Avalanche Fuji testnet sử dụng Hardhat.

## 📋 Mục lục

- [Cài đặt](#cài-đặt)
- [Cấu hình](#cấu-hình)
- [Deploy Contract](#deploy-contract)
- [Test Contract](#test-contract)
- [Tích hợp Backend](#tích-hợp-backend)
- [Troubleshooting](#troubleshooting)

## 🚀 Cài đặt

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Tạo file .env

```bash
cp env.example .env
```

### 3. Cấu hình .env file

Chỉnh sửa file `.env` với thông tin của bạn:

```env
# Private Key từ MetaMask
PRIVATE_KEY=your_private_key_here_without_0x_prefix

# RPC URLs
AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc

# API Key cho verification (optional)
SNOWTRACE_API_KEY=your_snowtrace_api_key_here
```

## 🔧 Cấu hình

### Lấy Private Key từ MetaMask

1. Mở MetaMask
2. Click vào 3 chấm → Account Details
3. Click "Export Private Key"
4. Nhập password
5. Copy private key (bỏ 0x ở đầu)
6. Paste vào file `.env`

### Lấy Snowtrace API Key (Optional)

1. Đăng ký tại [Snowtrace](https://snowtrace.io/)
2. Vào API Keys section
3. Tạo API key mới
4. Copy vào file `.env`

### Lấy Testnet AVAX

1. Vào [Avalanche Faucet](https://faucet.avax.network/)
2. Nhập địa chỉ ví của bạn
3. Request testnet AVAX

## 📦 Deploy Contract

### 1. Compile contract

```bash
npm run compile
```

### 2. Deploy lên Avalanche Fuji

```bash
npm run deploy:fuji
```

### 3. Kết quả deploy

Sau khi deploy thành công, bạn sẽ thấy:

```
🎉 Deployment Summary:
================================
Network: fuji
Deployer: 0x...
VictoryNFT Contract: 0x...
Explorer URL: https://testnet.snowtrace.io/address/0x...
================================
```

### 4. Verify contract (Optional)

Nếu có API key:

```bash
npx hardhat verify --network fuji 0xYOUR_CONTRACT_ADDRESS
```

## 🧪 Test Contract

### 1. Test mint function

```bash
npm run test:mint
```

### 2. Test thủ công

```bash
npx hardhat console --network fuji
```

```javascript
// Kết nối contract
const VictoryNFT = await ethers.getContractFactory("VictoryNFT");
const contract = VictoryNFT.attach("0xYOUR_CONTRACT_ADDRESS");

// Mint NFT
const metadata = JSON.stringify({
  name: "Victory NFT #1",
  description: "Player achieved 10 victories!",
  image: "https://api.kickin.com/nft/victory/10.png",
  attributes: [
    { trait_type: "Total Wins", value: 10 },
    { trait_type: "Milestone", value: 1 }
  ]
});

await contract.mintVictoryNFT("0xPLAYER_ADDRESS", 10, metadata);
```

## 🔗 Tích hợp Backend

### 1. Cập nhật server config

Thêm vào `server/config/settings.py`:

```python
# Victory NFT Configuration
AVALANCHE_FUJI_NFT_CONTRACT = "0xYOUR_CONTRACT_ADDRESS"
AVALANCHE_FUJI_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc"
PRIVATE_KEY = "your_private_key_here"
```

### 2. Cập nhật client config

Thêm vào `client/constants/contract.ts`:

```typescript
export const AVALANCHE_FUJI_NFT_CONTRACT = "0xYOUR_CONTRACT_ADDRESS";
```

### 3. Test backend integration

```bash
# Test mint từ backend
curl -X POST http://localhost:8000/api/victory-nft/mint \
  -H "Content-Type: application/json" \
  -d '{
    "player_address": "0x...",
    "wins": 10,
    "metadata": "{\"name\":\"Test NFT\"}"
  }'
```

## 📊 Contract Functions

### Mint NFT
```solidity
function mintVictoryNFT(
    address player,
    uint256 wins,
    string memory metadata
) external onlyOwner returns (uint256)
```

### View Functions
```solidity
function getPlayerTokens(address player) external view returns (uint256[])
function getMintInfo(uint256 tokenId) external view returns (MintInfo memory)
function hasMilestoneNFT(address player, uint256 milestone) external view returns (bool)
function getPlayerMilestoneCount(address player) external view returns (uint256)
function totalSupply() external view returns (uint256)
```

## 🔍 Explorer Links

- **Avalanche Fuji**: https://testnet.snowtrace.io/
- **Base Sepolia**: https://sepolia.basescan.org/

## ⚠️ Troubleshooting

### Lỗi thường gặp

1. **Insufficient funds**
   - Lấy thêm testnet AVAX từ faucet

2. **Nonce too high**
   - Reset MetaMask account hoặc đợi transaction cũ

3. **Gas estimation failed**
   - Tăng gas limit hoặc kiểm tra contract code

4. **Verification failed**
   - Kiểm tra API key và network config

### Debug Commands

```bash
# Check balance
npx hardhat console --network fuji
> const [signer] = await ethers.getSigners()
> await signer.getBalance()

# Check contract
> const contract = await ethers.getContractAt("VictoryNFT", "0x...")
> await contract.totalSupply()
```

## 📝 Notes

- Contract chỉ cho phép owner mint NFT
- Wins phải là bội số của 10
- Mỗi milestone chỉ mint được 1 lần
- Metadata phải là JSON string hợp lệ

## 🔐 Security

- Không commit private key lên git
- Sử dụng environment variables
- Backup private key an toàn
- Test kỹ trước khi deploy mainnet

## 📞 Support

Nếu gặp vấn đề, kiểm tra:
1. Network configuration
2. Private key format
3. Gas settings
4. Contract compilation 