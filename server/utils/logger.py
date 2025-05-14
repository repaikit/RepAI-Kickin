import logging
import sys
from logging.handlers import RotatingFileHandler
import os
from server.config.settings import settings

# Create logs directory if it doesn't exist
os.makedirs("logs", exist_ok=True)

# Configure logging
def setup_logger(name="api"):
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(settings.LOG_LEVEL)

    # Create handlers
    console_handler = logging.StreamHandler(sys.stdout)
    file_handler = RotatingFileHandler(
        f"logs/{name}.log",
        maxBytes=10485760,  # 10MB
        backupCount=5
    )

    # Create formatters
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    # Set formatters
    console_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)

    # Add handlers
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger

# Create loggers for different components
api_logger = setup_logger("api")
auth_logger = setup_logger("auth")
db_logger = setup_logger("database")
ws_logger = setup_logger("websocket")

# Configure logging
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Create loggers
api_logger = logging.getLogger('api')
ws_logger = logging.getLogger('websocket') 