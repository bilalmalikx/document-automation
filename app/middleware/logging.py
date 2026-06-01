from fastapi import Request
from fastapi.responses import JSONResponse
import time
import logging
from typing import Callable
import traceback

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("logs/app.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

async def log_requests_middleware(request: Request, call_next: Callable):
    """
    Middleware 1: Har request ko log karta hai
    - Request method, path, IP
    - Response time
    - Status code
    """
    start_time = time.time()
    
    # Log request
    logger.info(f"Request: {request.method} {request.url.path} from {request.client.host}")
    
    # Process request
    try:
        response = await call_next(request)
        
        # Calculate response time
        process_time = time.time() - start_time
        
        # Log response
        logger.info(
            f"Response: {request.method} {request.url.path} - "
            f"Status: {response.status_code} - "
            f"Time: {process_time:.3f}s"
        )
        
        # Add custom header
        response.headers["X-Process-Time"] = str(process_time)
        
        return response
        
    except Exception as e:
        # Log error
        logger.error(f"Error in {request.method} {request.url.path}: {str(e)}")
        logger.error(traceback.format_exc())
        
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error", "detail": str(e)}
        )

class RequestLogger:
    """Request logging ke liye helper class"""
    
    def __init__(self):
        self.request_counts = {}
        self.error_counts = {}
    
    def log_request(self, method: str, path: str):
        """Track request counts"""
        key = f"{method}:{path}"
        self.request_counts[key] = self.request_counts.get(key, 0) + 1
    
    def log_error(self, method: str, path: str, error: str):
        """Track error counts"""
        key = f"{method}:{path}"
        self.error_counts[key] = self.error_counts.get(key, 0) + 1
        logger.error(f"Error on {key}: {error}")
    
    def get_stats(self) -> dict:
        """Return statistics"""
        return {
            "total_requests": sum(self.request_counts.values()),
            "total_errors": sum(self.error_counts.values()),
            "requests_by_endpoint": self.request_counts,
            "errors_by_endpoint": self.error_counts
        }

# Global instance
request_logger = RequestLogger()