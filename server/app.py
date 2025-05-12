import os
import json
import time
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from routes import register_routes

app = Flask(__name__, static_folder='static')

# Cấu hình CORS
CORS(app, 
     resources={r"/api/*": {
         "origins": ["http://localhost:3000", "https://*.vercel.app"],
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization"],
         "expose_headers": ["Content-Type", "Authorization"],
         "supports_credentials": True
     }},
     allow_credentials=True)

# Middleware để log các request API
@app.before_request
def start_timer():
    request.start_time = time.time()

@app.after_request
def log_request(response):
    # Thêm CORS headers cho mọi response
    origin = request.headers.get('Origin')
    if origin:
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')

    if request.path.startswith('/api'):
        duration = time.time() - request.start_time
        
        # Format thời gian
        formatted_time = datetime.now().strftime("%I:%M:%S %p")
        
        # Lấy response data
        try:
            response_data = json.loads(response.get_data(as_text=True))
        except:
            response_data = None
        
        # Tạo log line
        log_line = f"{request.method} {request.path} {response.status_code} in {duration*1000:.0f}ms"
        if response_data:
            log_line += f" :: {json.dumps(response_data)}"
        
        # Cắt log line nếu quá dài
        if len(log_line) > 80:
            log_line = log_line[:79] + "…"
        
        print(f"{formatted_time} [express] {log_line}")
    
    return response

# Xử lý lỗi
@app.errorhandler(Exception)
def handle_error(error):
    status = getattr(error, 'code', 500)
    message = str(error) or "Internal Server Error"
    return jsonify({"message": message}), status

# Đăng ký các route API
register_routes(app)

# Phục vụ file tĩnh
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

# Đảm bảo app có thể chạy trên Vercel
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)