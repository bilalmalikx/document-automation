from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.api.v1.router import router as v1_router
from app.config import settings
from app.utils.logging_config import app_logger
from app.core.exceptions import DocumentAutomationError

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    app_logger.info(f"Starting {settings.app_name} in {settings.app_env} mode")
    
    # Startup tasks
    app_logger.info("Initializing services...")
    
    # Create required directories
    import os
    os.makedirs(settings.templates_dir, exist_ok=True)
    os.makedirs(settings.generated_dir, exist_ok=True)
    os.makedirs("logs", exist_ok=True)
    
    app_logger.info("All directories created successfully")
    
    # Initialize database if enabled
    if settings.use_database:
        try:
            from app.database import init_db
            init_db()
            app_logger.info("Database initialized successfully")
        except Exception as e:
            app_logger.error(f"Database initialization failed: {str(e)}")
            app_logger.warning("Continuing with file-only storage mode")
    
    yield
    
    # Shutdown tasks
    app_logger.info("Shutting down application...")

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Production Document Automation Backend with AI",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None
)

# CORS middleware - FIXED FOR ANGULAR
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "*"  # Allow all for development
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"]
)

# Global exception handler
@app.exception_handler(DocumentAutomationError)
async def document_automation_exception_handler(request, exc):
    app_logger.error(f"Document automation error: {str(exc)}")
    return JSONResponse(
        status_code=400,
        content={"error": str(exc), "type": exc.__class__.__name__}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    app_logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "type": "InternalServerError"}
    )

# Include routers
app.include_router(v1_router, prefix=settings.api_v1_prefix)

@app.get("/")
async def root():
    return {
        "service": settings.app_name,
        "version": "1.0.0",
        "status": "running",
        "database_enabled": settings.use_database,
        "docs": "/docs" if settings.debug else "disabled"
    }

@app.get("/health/database")
async def check_database():
    """Check database connectivity"""
    if not settings.use_database:
        return {"status": "disabled", "message": "Database not configured"}
    
    try:
        from app.database import SessionLocal
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        return {"status": "healthy", "message": "Database connected"}
    except Exception as e:
        app_logger.error(f"Database health check failed: {str(e)}")
        return {"status": "unhealthy", "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",  # Important: Use 0.0.0.0 to allow external connections
        port=8000,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
