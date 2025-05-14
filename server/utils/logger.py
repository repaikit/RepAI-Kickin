import logging
import sys
import os
from config.settings import settings

# Configure logging
def setup_logger(name="api"):
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(settings.LOG_LEVEL)

    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    
    # Create formatter
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    # Set formatter
    console_handler.setFormatter(formatter)

    # Add handler
    logger.addHandler(console_handler)

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