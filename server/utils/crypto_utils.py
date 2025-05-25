import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()  # Đọc biến môi trường từ file .env

FERNET_KEY = os.getenv("FERNET_KEY")

if not FERNET_KEY:
    raise ValueError("FERNET_KEY not found in environment variables")

cipher = Fernet(FERNET_KEY.encode())

def encrypt_str(text: str) -> str:
    return cipher.encrypt(text.encode()).decode()

def decrypt_str(encrypted_text: str) -> str:
    return cipher.decrypt(encrypted_text.encode()).decode()
