from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import traceback
from typing import Union

async def error_handler_middleware(request: Request, call_next):
    """
    Middleware 2: Global error handler
    Saare exceptions ko catch karta hai aur clean response bhejta hai
    """
    try:
        return await call_next(request)
    except Exception as e:
        # Log the error
        print(f"Unhandled error: {str(e)}")
        print(traceback.format_exc())
        
        # Return clean error response
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal server error",
                "message": str(e) if is_development() else "Something went wrong",
                "type": type(e).__name__
            }
        )

def is_development() -> bool:
    """Check if running in development mode"""
    import os
    return os.getenv("ENVIRONMENT", "development") == "development"

# Specific exception handlers
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors (Pydantic)"""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation error",
            "details": exc.errors(),
            "body": exc.body
        }
    )

async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code
        }
    )

class APIError(Exception):
    """Custom API error class"""
    def __init__(self, message: str, status_code: int = 400, details: dict = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)

async def api_error_handler(request: Request, exc: APIError):
    """Handle custom API errors"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.message,
            "details": exc.details,
            "status_code": exc.status_code
        }
    )