from typing import List, Optional
import re
from utils.logger import api_logger

# Danh sách các từ nhạy cảm (có thể mở rộng thêm)
SENSITIVE_WORDS = [
    # Từ ngữ tục tĩu
    "fuck", "fucking", "shit", "bullshit", "bastard", "bitch", "ass", "asshole", "damn", "crap", "cunt", "dick", "pussy", "slut", "whore", "motherfucker", "fucker", "goddamn", "son of a bitch", "twat", "douche", "jerk", "cock", "nuts", "screw you",
    "địt", "đéo", "cặc", "buồi", "lồn", "đụ", "chịch", "con mẹ", "thằng chó", "con chó", "thằng cặc", "vãi lồn", "vkl", "vcl", "vãi đái", "mịa", "dm", "dcm", "mẹ kiếp", "thằng óc chó", "thằng ngu", "mẹ mày", "thằng khốn", "con khốn", "thằng mất dạy",

    # Từ ngữ phân biệt chủng tộc
    "nigger", "nigga", "chink", "gook", "spic", "kike", "raghead", "retard", "moron", "idiot", "stupid", "dumb", "fatty", "cripple", "deaf", "blind", "midget", "tranny", "queer", "fag", "faggot", "homo",
    "thằng ngu", "con ngu", "đồ đần", "bại não", "chậm phát triển", "bị điên", "thằng khùng", "con điên", "thằng mọi", "mọi rợ", "bụi đời", "béo ị", "thằng què", "thằng mù", "con mù", "bọn tàu", "thằng lai", "khùng điên", "ô môi", "bóng lộ", "bê đê",

    # Từ ngữ kỳ thị
    "porn", "porno", "xxx", "sex", "oral", "anal", "blowjob", "handjob", "nude", "naked", "cum", "orgasm", "ejaculate", "dildo", "vibrator", "threesome", "fetish", "bondage", "bdsm", "panties", "lingerie", "strip", "stripper", "masturbate", "milf",
    "dâm", "dâm đãng", "dâm loạn", "dâm dục", "kích dục", "thủ dâm", "sờ soạng", "cởi truồng", "ảnh sex", "phim sex", "phim đen", "clip nóng", "sinh lý", "quan hệ", "giao cấu", "giao hợp", "trần truồng", "đồ lót", "nội y", "xếp hình", "xxx", "vú", "núm", "bú", "hôn môi", "liếm",

    # Từ ngữ bạo lực
    "kill", "murder", "stab", "blood", "death", "die", "torture", "hang", "suicide", "terror", "bomb", "shoot", "gun", "weapon", "explode", "slit", "abuse", "rape", "strangle", "cut throat", "beat up", "poison",
    "giết", "giết người", "máu me", "chém", "bắn", "bom", "đánh", "cắt cổ", "hiếp", "hiếp dâm", "tự tử", "thắt cổ", "chết", "đập đầu", "tra tấn", "móc mắt", "rạch mặt", "bạo hành", "bạo lực", "đâm chết",

    # Từ ngữ chính trị nhạy cảm
    "communist", "fascist", "nazi", "dictator", "overthrow", "regime", "coup", "propaganda", "totalitarian", "freedom of speech", "oppression", "rebel", "dissident",
    "đảng", "cộng sản", "phản động", "chế độ", "đa đảng", "lật đổ", "biểu tình", "nhân quyền", "bạo loạn", "diễn biến hòa bình", "tự trị", "ly khai", "chống phá", "dân chủ", "tự do ngôn luận", "thế lực thù địch"

]

# Các pattern regex để phát hiện nội dung nhạy cảm
SENSITIVE_PATTERNS = [
    r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',  # IP addresses
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # Email addresses
    r'\b\d{10,}\b',  # Long numbers (potential phone numbers)
    r'https?://\S+',  # URLs
]

def contains_sensitive_content(text: str) -> tuple[bool, Optional[str]]:
    """
    Kiểm tra xem text có chứa nội dung nhạy cảm không
    Returns: (is_sensitive: bool, reason: Optional[str])
    """
    if not text:
        return False, None
        
    text = text.lower()
    
    # Kiểm tra từ nhạy cảm
    for word in SENSITIVE_WORDS:
        if word in text:
            return True, f"Contains sensitive word: {word}"
            
    # Kiểm tra pattern nhạy cảm
    for pattern in SENSITIVE_PATTERNS:
        if re.search(pattern, text):
            return True, f"Contains sensitive pattern: {pattern}"
            
    return False, None

def filter_sensitive_content(text: str) -> str:
    """
    Lọc và thay thế nội dung nhạy cảm trong text
    """
    if not text:
        return text
        
    filtered_text = text.lower()
    
    # Thay thế từ nhạy cảm
    for word in SENSITIVE_WORDS:
        filtered_text = filtered_text.replace(word, '*' * len(word))
        
    # Thay thế pattern nhạy cảm
    for pattern in SENSITIVE_PATTERNS:
        filtered_text = re.sub(pattern, '[REDACTED]', filtered_text)
        
    return filtered_text

def validate_username(username: str) -> tuple[bool, Optional[str]]:
    """
    Kiểm tra username có hợp lệ không
    Returns: (is_valid: bool, reason: Optional[str])
    """
    if not username:
        return False, "Username cannot be empty"
        
    if len(username) < 3:
        return False, "Username must be at least 3 characters long"
        
    if len(username) > 20:
        return False, "Username must be at most 20 characters long"
        
    # Kiểm tra ký tự đặc biệt
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return False, "Username can only contain letters, numbers and underscores"
        
    # Kiểm tra nội dung nhạy cảm
    is_sensitive, reason = contains_sensitive_content(username)
    if is_sensitive:
        return False, f"Username contains sensitive content: {reason}"
        
    return True, None 