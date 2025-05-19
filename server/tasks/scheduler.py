from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from .cleanup import cleanup_inactive_guest_accounts
from utils.logger import api_logger

def setup_scheduler():
    """Cấu hình các scheduled tasks"""
    scheduler = AsyncIOScheduler()
    
    # Chạy cleanup task mỗi ngày lúc 00:00 UTC
    scheduler.add_job(
        cleanup_inactive_guest_accounts,
        trigger=CronTrigger(hour=0, minute=0),
        id='cleanup_guest_accounts',
        name='Clean up guest accounts older than 7 days',
        replace_existing=True
    )
    
    try:
        scheduler.start()
        api_logger.info("Scheduler started successfully")
    except Exception as e:
        api_logger.error(f"Error starting scheduler: {str(e)}") 