from fastapi import APIRouter
from app.api.v1.endpoints import templates, generate

router = APIRouter()

# Include all endpoint routers
router.include_router(templates.router)
router.include_router(generate.router)

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "service": "Document Automation Backend"
    }