from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.services.template_set_service import TemplateSetService
from app.utils.logging_config import app_logger


router = APIRouter(prefix="/template-sets", tags=["Template Sets"])

# ============================================
# Request/Response Schemas
# ============================================

class CreateTemplateSetRequest(BaseModel):
    name: str
    description: Optional[str] = None

class UpdateTemplateSetRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class AddTemplateToSetRequest(BaseModel):
    template_id: str
    order_index: int = 0

class CreateSharedFieldRequest(BaseModel):
    field_name: str
    field_label: str
    field_type: str = "text"
    field_order: int = 0
    is_required: bool = False
    default_value: Optional[str] = None

class UpdateSharedFieldRequest(BaseModel):
    field_label: Optional[str] = None
    field_type: Optional[str] = None
    field_order: Optional[int] = None
    is_required: Optional[bool] = None
    default_value: Optional[str] = None

# ============================================
# Template Set CRUD
# ============================================

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_template_set(
    request: CreateTemplateSetRequest,
    db: Session = Depends(get_db)
):
    """Create a new template set"""
    try:
        template_set = TemplateSetService.create_template_set(
            db=db,
            name=request.name,
            description=request.description
        )
        return template_set.to_dict()
    except Exception as e:
        app_logger.error(f"Failed to create template set: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def get_all_template_sets(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all template sets"""
    try:
        template_sets = TemplateSetService.get_all_template_sets(db, skip, limit)
        return {
            "template_sets": [ts.to_dict() for ts in template_sets],
            "total": len(template_sets)
        }
    except Exception as e:
        app_logger.error(f"Failed to get template sets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{set_id}")
async def get_template_set(
    set_id: str,
    db: Session = Depends(get_db)
):
    """Get template set by ID with all details"""
    try:
        result = TemplateSetService.get_set_with_details(db, set_id)
        if not result:
            raise HTTPException(status_code=404, detail="Template set not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"Failed to get template set: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{set_id}")
async def update_template_set(
    set_id: str,
    request: UpdateTemplateSetRequest,
    db: Session = Depends(get_db)
):
    """Update template set"""
    try:
        template_set = TemplateSetService.update_template_set(
            db=db,
            set_id=set_id,
            name=request.name,
            description=request.description
        )
        if not template_set:
            raise HTTPException(status_code=404, detail="Template set not found")
        return template_set.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"Failed to update template set: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{set_id}")
async def delete_template_set(
    set_id: str,
    db: Session = Depends(get_db)
):
    """Delete template set (soft delete)"""
    try:
        result = TemplateSetService.delete_template_set(db, set_id)
        if not result:
            raise HTTPException(status_code=404, detail="Template set not found")
        return {"success": True, "message": f"Template set {set_id} deleted"}
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"Failed to delete template set: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# Template Set Members
# ============================================

@router.post("/{set_id}/templates")
async def add_template_to_set(
    set_id: str,
    request: AddTemplateToSetRequest,
    db: Session = Depends(get_db)
):
    """Add a template to the set"""
    try:
        result = TemplateSetService.add_template_to_set(
            db=db,
            set_id=set_id,
            template_id=request.template_id,
            order_index=request.order_index
        )
        return {"success": True, "message": "Template added to set"}
    except Exception as e:
        app_logger.error(f"Failed to add template to set: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{set_id}/templates/{template_id}")
async def remove_template_from_set(
    set_id: str,
    template_id: str,
    db: Session = Depends(get_db)
):
    """Remove a template from the set"""
    try:
        result = TemplateSetService.remove_template_from_set(db, set_id, template_id)
        if not result:
            raise HTTPException(status_code=404, detail="Template not found in set")
        return {"success": True, "message": "Template removed from set"}
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"Failed to remove template from set: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# Shared Fields
# ============================================

@router.post("/{set_id}/fields")
async def add_shared_field(
    set_id: str,
    request: CreateSharedFieldRequest,
    db: Session = Depends(get_db)
):
    """Add a shared field to the template set"""
    try:
        field = TemplateSetService.add_shared_field(
            db=db,
            set_id=set_id,
            field_name=request.field_name,
            field_label=request.field_label,
            field_type=request.field_type,
            field_order=request.field_order,
            is_required=request.is_required,
            default_value=request.default_value
        )
        return field.to_dict()
    except Exception as e:
        app_logger.error(f"Failed to add shared field: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{set_id}/fields")
async def get_shared_fields(
    set_id: str,
    db: Session = Depends(get_db)
):
    """Get all shared fields for a template set"""
    try:
        fields = TemplateSetService.get_shared_fields(db, set_id)
        return {
            "shared_fields": [f.to_dict() for f in fields],
            "count": len(fields)
        }
    except Exception as e:
        app_logger.error(f"Failed to get shared fields: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/fields/{field_id}")
async def update_shared_field(
    field_id: str,
    request: UpdateSharedFieldRequest,
    db: Session = Depends(get_db)
):
    """Update a shared field"""
    try:
        update_data = {k: v for k, v in request.dict().items() if v is not None}
        field = TemplateSetService.update_shared_field(db, field_id, **update_data)
        if not field:
            raise HTTPException(status_code=404, detail="Shared field not found")
        return field.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"Failed to update shared field: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/fields/{field_id}")
async def delete_shared_field(
    field_id: str,
    db: Session = Depends(get_db)
):
    """Delete a shared field"""
    try:
        result = TemplateSetService.delete_shared_field(db, field_id)
        if not result:
            raise HTTPException(status_code=404, detail="Shared field not found")
        return {"success": True, "message": "Shared field deleted"}
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"Failed to delete shared field: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))