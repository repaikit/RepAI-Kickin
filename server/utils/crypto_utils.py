import os
from cryptography.fernet import Fernet

FERNET_KEY = os.environ.get("FERNET_KEY")
if not FERNET_KEY:
    # Tạo key mới nếu chưa có (chỉ dùng cho dev, production phải tự set)
    FERNET_KEY = Fernet.generate_key().decode()
    print("Generated FERNET_KEY:", FERNET_KEY)

fernet = Fernet(FERNET_KEY.encode())

def encrypt_str(plain: str) -> str:
    return fernet.encrypt(plain.encode()).decode()

def decrypt_str(cipher: str) -> str:
    return fernet.decrypt(cipher.encode()).decode() 