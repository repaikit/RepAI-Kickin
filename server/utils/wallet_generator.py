from eth_account import Account
import secrets
from mnemonic import Mnemonic
from .crypto_utils import encrypt_str

def generate_evm_wallet():
    """
    🇻🇳 Hàm này tạo ví Ethereum (EVM) cho người dùng mới.
    🇺🇸 This function generates an EVM-compatible wallet for a new user.
    
    Returns:
        dict: {
            "mnemonic": str,  # 12 từ để backup ví
            "private_key": str,  # Private key đã được mã hóa
            "public_address": str  # Địa chỉ ví Ethereum
        }
    """
    # Tạo mnemonic 12 từ
    mnemo = Mnemonic("english")
    words = mnemo.generate(strength=128)
    
    # Tạo seed từ mnemonic
    seed = mnemo.to_seed(words)
    
    # Tạo private key từ seed
    private_key = "0x" + seed.hex()[:64]
    
    # Tạo account từ private key
    account = Account.from_key(private_key)
    
    # Mã hóa private key trước khi lưu
    encrypted_private_key = encrypt_str(private_key)
    
    return {
        "mnemonic": words,
        "private_key": encrypted_private_key,
        "public_address": account.address
    }

# Test code
if __name__ == "__main__":
    wallet = generate_evm_wallet()
    print("\n=== EVM Wallet Generated ===")
    print(f"Mnemonic: {wallet['mnemonic']}")
    print(f"Public Address: {wallet['public_address']}")
    print(f"Private Key (encrypted): {wallet['private_key']}")
    print("===========================\n")
