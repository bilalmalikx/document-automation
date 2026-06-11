from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends
from typing import List, Optional
from sqlalchemy.orm import Session
from pydantic import BaseModel
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
from app.services.docx_placeholder_updater import update_placeholder_in_docx
from pathlib import Path

router = APIRouter(prefix="/templates", tags=["Templates"])

# ============================================
# Request Schema for Rename Placeholder
# ============================================
class RenamePlaceholderRequest(BaseModel):
    old_name: str
    new_name: str

class BulkRenamePlaceholderRequest(BaseModel):
    old_name: str
    new_name: str
    template_ids: List[str]

# ============================================
# Existing Endpoints
# ============================================

@router.post("/upload", response_model=TemplateUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_template(
    file: UploadFile = File(..., description="DOCX template file with placeholders"),
    db: Session = Depends(get_db)
):
    """Upload template - saves to database if configured"""
    try:
        result = await template_manager.create_template(file, file.filename, db=db)
        app_logger.info(f"✅ Template upload complete: {result['id']}")
        
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

# ============================================
# SINGLE RENAME: Rename Placeholder in Template
# ============================================
@router.post("/{template_id}/placeholders/rename")
async def rename_placeholder_in_template(
    template_id: str,
    request: RenamePlaceholderRequest,
    db: Session = Depends(get_db)
):
    """
    Rename a placeholder in a specific template.
    Updates both database AND the actual DOCX file.
    """
    try:
        app_logger.info(f"🔄 Renaming placeholder in template {template_id}: '{request.old_name}' → '{request.new_name}'")
        
        # Get template from database
        template = db.query(TemplateModel).filter(
            TemplateModel.id == template_id,
            TemplateModel.is_deleted == False
        ).first()
        
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Update placeholder in database
        current_placeholders = template.placeholders or []
        updated_placeholders = []
        found = False
        
        for ph in current_placeholders:
            if ph == request.old_name:
                updated_placeholders.append(request.new_name)
                found = True
            else:
                updated_placeholders.append(ph)
        
        if not found:
            raise HTTPException(status_code=404, detail=f"Placeholder '{request.old_name}' not found in template")
        
        template.placeholders = updated_placeholders
        template.placeholder_count = len(updated_placeholders)
        db.commit()
        
        # ✅ UPDATE THE ACTUAL DOCX FILE
        file_path = template.file_path
        if file_path and Path(file_path).exists():
            success = update_placeholder_in_docx(file_path, request.old_name, request.new_name)
            if success:
                app_logger.info(f"✅ Updated DOCX file: {file_path}")
            else:
                app_logger.warning(f"⚠️ Could not update DOCX file, but database updated")
        
        app_logger.info(f"✅ Successfully renamed placeholder in template {template_id}")
        
        return {
            "success": True,
            "message": f"Placeholder '{request.old_name}' renamed to '{request.new_name}'",
            "template_id": template_id,
            "updated_placeholders": updated_placeholders
        }
        
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"Failed to rename placeholder: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# BULK RENAME: Rename placeholder across multiple templates
# ============================================
@router.post("/placeholders/bulk-rename")
async def bulk_rename_placeholder(
    request: BulkRenamePlaceholderRequest,
    db: Session = Depends(get_db)
):
    """
    Rename a placeholder across multiple templates at once.
    Updates both database AND actual DOCX files for all templates.
    """
    try:
        app_logger.info(f"🔄 Bulk renaming placeholder: '{request.old_name}' → '{request.new_name}' in {len(request.template_ids)} templates")
        
        success_count = 0
        docx_success_count = 0
        failed_templates = []
        
        for template_id in request.template_ids:
            try:
                template = db.query(TemplateModel).filter(
                    TemplateModel.id == template_id,
                    TemplateModel.is_deleted == False
                ).first()
                
                if template:
                    current_placeholders = template.placeholders or []
                    updated_placeholders = []
                    
                    for ph in current_placeholders:
                        if ph == request.old_name:
                            updated_placeholders.append(request.new_name)
                        else:
                            updated_placeholders.append(ph)
                    
                    template.placeholders = updated_placeholders
                    template.placeholder_count = len(updated_placeholders)
                    
                    # ✅ UPDATE THE ACTUAL DOCX FILE
                    file_path = template.file_path
                    if file_path and Path(file_path).exists():
                        success = update_placeholder_in_docx(file_path, request.old_name, request.new_name)
                        if success:
                            docx_success_count += 1
                            app_logger.info(f"✅ Updated DOCX file: {file_path}")
                    
                    success_count += 1
                else:
                    failed_templates.append(template_id)
                    
            except Exception as e:
                app_logger.error(f"Failed to update template {template_id}: {str(e)}")
                failed_templates.append(template_id)
        
        db.commit()
        
        app_logger.info(f"✅ Bulk rename complete: {success_count} templates, {docx_success_count} DOCX files updated, {len(failed_templates)} failed")
        
        return {
            "success": True,
            "message": f"Placeholder renamed in {success_count} templates",
            "success_count": success_count,
            "docx_files_updated": docx_success_count,
            "failed_templates": failed_templates
        }
        
    except Exception as e:
        app_logger.error(f"Failed to bulk rename placeholder: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))