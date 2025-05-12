import os
import json
import time
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from routes import register_routes

app = Flask(__name__, static_folder='static')
CORS(app)

# Middleware để log các request API
@app.before_request
def start_timer():
    request.start_time = time.time()

@app.after_request
def log_request(response):
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

if __name__ == "__main__":
    # Luôn phục vụ trên port 5000
    port = 5000
    print(f"{datetime.now().strftime('%I:%M:%S %p')} [express] serving on port {port}")
    app.run(host="0.0.0.0", port=port, debug=True)