import google.generativeai as genai
import os
from utils.logger import api_logger

class GeminiService:
    def __init__(self):
        # Lấy API key từ environment variable
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            api_logger.warning("GEMINI_API_KEY not found in environment variables")
            self.model = None
            return
            
        genai.configure(api_key=api_key)
        
        # Khởi tạo model Gemini
        try:
            # Thử gemini-1.5-pro trước, nếu lỗi thì dùng gemini-1.5-flash
            try:
                self.model = genai.GenerativeModel('gemini-2.5-pro')
            except:
                self.model = genai.GenerativeModel('gemini-2.5-flash')
            
            # Tạo chat session với context
            self.chat = self.model.start_chat(history=[])
            api_logger.info("Gemini AI initialized successfully")
        except Exception as e:
            api_logger.error(f"Failed to initialize Gemini AI: {e}")
            self.model = None

    def get_response(self, message: str, user_id: str = None) -> str:
        """Nhận message từ user và trả về phản hồi từ Gemini"""
        if not self.model:
            return "Xin lỗi, AI service chưa sẵn sàng. Vui lòng thử lại sau."
        
        try:
            # Kiểm tra nếu đây là tin nhắn đầu tiên
            if not hasattr(self, 'user_preferences'):
                self.user_preferences = {}
            
            # Nếu là tin nhắn đầu tiên của user này
            if user_id and user_id not in self.user_preferences:
                # Tạo prompt hỏi ngôn ngữ bằng tiếng Anh
                welcome_prompt = f"""
                Hello! I am the AI assistant for the Kickin game.
                Would you like to chat in English or Vietnamese?
                (Please reply: 'English' or 'Tiếng Việt')
                
                User: {message}
                """
                
                response = self.model.generate_content(welcome_prompt)
                response_text = response.text
                
                # Lưu preference dựa trên câu trả lời
                if "tiếng việt" in message.lower() or "vietnamese" in message.lower():
                    self.user_preferences[user_id] = "vi"
                    return "Great! I will chat with you in Vietnamese. You can ask me anything about the Kickin game! 😊"
                elif "english" in message.lower() or "tiếng anh" in message.lower():
                    self.user_preferences[user_id] = "en"
                    return "Great! I'll chat with you in English. Feel free to ask me anything about the Kickin game! 😊"
                else:
                    # Nếu user chưa chọn ngôn ngữ, hỏi lại bằng tiếng Anh
                    return "Hello! Would you like to chat in English or Vietnamese? (Please reply: 'English' or 'Tiếng Việt')"
            
            # Lấy ngôn ngữ preference của user
            user_lang = self.user_preferences.get(user_id, "vi")  # Mặc định tiếng Việt
            
            # Tạo prompt context cho chatbot game
            if user_lang == "vi":
                context = f"""
                Bạn là một AI assistant thân thiện cho game Kickin. 
                Hãy trả lời ngắn gọn, vui vẻ và hữu ích bằng tiếng Việt.
                Người dùng: {message}
                """
            else:
                context = f"""
                You are a friendly AI assistant for the Kickin game.
                Please respond briefly, cheerfully and helpfully in English.
                User: {message}
                """
            
            response = self.model.generate_content(context)
            return response.text
            
        except Exception as e:
            api_logger.error(f"Error getting Gemini response: {e}")
            return "Xin lỗi, có lỗi xảy ra khi xử lý tin nhắn của bạn."

# Khởi tạo service instance
gemini_service = GeminiService() 