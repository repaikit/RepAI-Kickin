import os
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
EMAIL_FROM = os.getenv("EMAIL_FROM")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

def send_verification_email(to_email: str, token: str):
    verify_url = f"{FRONTEND_URL}/verify-email?token={token}"
    subject = "Verify Kick'in account email"
    body = f"Hello,\n\nPlease click on the following link to verify your email:\n{verify_url}\n\nIf you are not a registered user, please ignore this email.."
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = EMAIL_FROM
    msg['To'] = to_email

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(EMAIL_FROM, [to_email], msg.as_string())