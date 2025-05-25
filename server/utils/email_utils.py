import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import os

load_dotenv()

def send_verification_email(email: str, token: str):
    """
    Gửi email xác thực cho người dùng mới
    """
    # Email settings
    sender_email = os.getenv("SMTP_EMAIL")
    sender_password = os.getenv("SMTP_PASSWORD")
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    # Create message
    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = email
    msg['Subject'] = "Xác thực tài khoản RepAI-Kickin"

    # Email body
    verification_link = f"http://localhost:3000/verify-email?token={token}"
    body = f"""
    Xin chào!

    Cảm ơn bạn đã đăng ký tài khoản RepAI-Kickin.
    Vui lòng click vào link sau để xác thực email của bạn:

    {verification_link}

    Link này sẽ hết hạn sau 24 giờ.

    Trân trọng,
    Team RepAI-Kickin
    """

    msg.attach(MIMEText(body, 'plain'))

    try:
        # Create SMTP session
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)
        
        # Send email
        text = msg.as_string()
        server.sendmail(sender_email, email, text)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False