from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends
from typing import List, Optional
from sqlalchemy.orm import Session
from app.services.template_manager import template_manager
from app.api.v1.schemas.template import (
    TemplateUploadResponse, 
    TemplatePlaceholdersResponse,
    TemplateListResponse
)
from app.core.exceptions import PlaceholderExtractionError, FileUploadError, TemplateNotFoundError
from app.utils.logging_config import app_logger
from app.database import get_db
from app.config import settings
from app.models.template import TemplateModel

router = APIRouter(prefix="/templates", tags=["Templates"])

@router.post("/upload", response_model=TemplateUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_template(
    file: UploadFile = File(..., description="DOCX template file with placeholders"),
    db: Session = Depends(get_db)  # ✅ MUST HAVE THIS
):
    """Upload template - saves to database if configured"""
    try:
        # ✅ PASS THE DATABASE SESSION
        result = await template_manager.create_template(file, file.filename, db=db)
        app_logger.info(f"✅ Template upload complete: {result['id']}")
        
        # ✅ Verify it was saved to database
        if settings.use_database:
            db_template = db.query(TemplateModel).filter(TemplateModel.id == result['id']).first()
            if db_template:
                app_logger.info(f"✅✅ VERIFIED: Template in DATABASE: {result['id']}")
            else:
                app_logger.error(f"❌❌ WARNING: Template NOT in database!")
        
        return result
    except FileUploadError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PlaceholderExtractionError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        app_logger.error(f"Unexpected error in template upload: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@router.get("/{template_id}/placeholders", response_model=TemplatePlaceholdersResponse)
async def get_template_placeholders(
    template_id: str,
    db: Session = Depends(get_db)
):
    """Get all placeholders for a specific template"""
    try:
        placeholders = template_manager.get_template_placeholders(template_id, db=db)
        return TemplatePlaceholdersResponse(
            template_id=template_id,
            placeholders=sorted(list(placeholders)),
            count=len(placeholders)
        )
    except TemplateNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/", response_model=TemplateListResponse)
async def list_templates(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all templates with pagination"""
    templates = template_manager.list_templates(db=db, skip=skip, limit=limit)
    return TemplateListResponse(templates=templates, total=len(templates))

@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    db: Session = Depends(get_db)
):
    """Soft delete a template"""
    if template_manager.delete_template(template_id, db=db):
        return {"success": True, "message": f"Template {template_id} deleted"}
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")