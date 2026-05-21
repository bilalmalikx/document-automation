import sys
from loguru import logger
from app.config import settings

def setup_logging():
    """Configure loguru logging"""
    
    # Remove default handler
    logger.remove()
    
    # Console handler
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan> | <level>{message}</level>",
        level=settings.log_level,
        colorize=True
    )
    
    # File handler
    logger.add(
        settings.log_file,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name} | {message}",
        level=settings.log_level,
        rotation="500 MB",
        retention="30 days",
        compression="zip"
    )
    
    return logger

# Global logger instance
app_logger = setup_logging()