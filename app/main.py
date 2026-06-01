from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.api.v1.router import router as v1_router
from app.config import settings
from app.utils.logging_config import app_logger
from app.core.exceptions import DocumentAutomationError

# ============================================
# PDF QA System Imports (Second Project)
# ============================================
from app.api.v1.endpoints import upload, ask
from app.components.vector_store import VectorStoreComponent
from app.utils.config import config as pdf_config
from app.middleware import (
    log_requests_middleware,
    validation_exception_handler,
    http_exception_handler,
    api_error_handler,
    APIError
)
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - Merged startup for both systems"""
    app_logger.info(f"Starting {settings.app_name} in {settings.app_env} mode")
    
    # ============================================
    # Document Automation System Startup
    # ============================================
    app_logger.info("Initializing Document Automation services...")
    
    # Create required directories
    os.makedirs(settings.templates_dir, exist_ok=True)
    os.makedirs(settings.generated_dir, exist_ok=True)
    os.makedirs("logs", exist_ok=True)
    
    app_logger.info("Document Automation directories created")
    
    # Initialize database if enabled
    if settings.use_database:
        try:
            from app.database import init_db
            init_db()
            app_logger.info("Database initialized successfully")
        except Exception as e:
            app_logger.error(f"Database initialization failed: {str(e)}")
            app_logger.warning("Continuing with file-only storage mode")
    
    # ============================================
    # PDF QA System Startup
    # ============================================
    app_logger.info("=" * 50)
    app_logger.info("Starting PDF QA System with LangGraph")
    app_logger.info("=" * 50)
    
    # Ensure directories exist for PDF system
    os.makedirs(pdf_config.UPLOAD_DIR, exist_ok=True)
    os.makedirs(pdf_config.VECTOR_STORE_PATH, exist_ok=True)
    os.makedirs("logs", exist_ok=True)
    
    # Load existing vector store
    vector_store = VectorStoreComponent()
    vector_store.load_vector_store()
    
    if vector_store.vector_store:
        app_logger.info("Loaded existing vector store")
    else:
        app_logger.info("No existing vector store found. Upload a PDF to get started.")
    
    app_logger.info(f"📖 API docs: http://localhost:8000/docs")
    app_logger.info(f"📁 Document Automation API: {settings.api_v1_prefix}")
    app_logger.info("=" * 50)
    
    yield
    
    # ============================================
    # Shutdown tasks
    # ============================================
    app_logger.info("Shutting down application...")


# Create FastAPI app
app = FastAPI(
    title="Document Automation & PDF QA System",
    version="2.0.0",
    description="Production Document Automation Backend with AI + PDF Question Answering System",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None
)

# ============================================
# CORS MIDDLEWARE (Merged)
# ============================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://localhost:8080",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# ============================================
# PDF QA SYSTEM MIDDLEWARE & HANDLERS
# ============================================
app.middleware("http")(log_requests_middleware)

app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(APIError, api_error_handler)


# ============================================
# DOCUMENT AUTOMATION EXCEPTION HANDLERS
# ============================================
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


# ============================================
# INCLUDE ROUTERS
# ============================================

# Document Automation Routes
app.include_router(v1_router, prefix=settings.api_v1_prefix)

# PDF QA System Routes
app.include_router(upload.router, prefix="/api", tags=["PDF Upload"])
app.include_router(ask.router, prefix="/api", tags=["PDF Ask"])


# ============================================
# ROOT AND HEALTH ENDPOINTS
# ============================================
@app.get("/")
async def root():
    return {
        "service": settings.app_name,
        "version": "2.0.0",
        "status": "running",
        "database_enabled": settings.use_database,
        "docs": "/docs",
        "endpoints": {
            "document_automation": f"{settings.api_v1_prefix}/templates",
            "pdf_upload": "/api/upload",
            "pdf_ask": "/api/ask",
            "health": "/health"
        }
    }

@app.get("/health")
async def health():
    """Combined health check for both systems"""
    from app.middleware.logging import request_logger
    
    health_status = {
        "status": "healthy",
        "service": "merged-backend",
        "document_automation": {
            "database_enabled": settings.use_database,
            "templates_dir": settings.templates_dir
        },
        "pdf_qa_system": {
            "vector_store_exists": os.path.exists(pdf_config.VECTOR_STORE_PATH),
            "upload_dir": pdf_config.UPLOAD_DIR
        },
        "stats": request_logger.get_stats() if hasattr(request_logger, 'get_stats') else {}
    }
    
    return health_status

@app.get("/health/database")
async def check_database():
    """Check database connectivity for document automation"""
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
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )