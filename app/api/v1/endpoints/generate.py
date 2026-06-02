from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from typing import List
from app.api.v1.schemas.generate import GenerateRequest
from app.services.template_manager import template_manager
from app.services.ai_mapper import AIMapperService
from app.services.docx_renderer import DOCXRenderer
from app.core.exceptions import AIValidationError, RenderError, TemplateNotFoundError
from app.utils.logging_config import app_logger
import zipfile
import io
from app.config import settings

router = APIRouter(prefix="/generate", tags=["Document Generation"])

# Request schema for multi-document generation
class GenerateMultipleRequest(BaseModel):
    template_ids: List[str]
    instruction: str


@router.post("/")
async def generate_document(request: GenerateRequest):
    """Generate document from template using AI-extracted values"""
    try:
        app_logger.info(f"Generating document for template: {request.template_id}")
        
        # 1. Get template
        template_placeholders = template_manager.get_template_placeholders(request.template_id)
        template_path = template_manager.get_template_path(request.template_id)
        
        app_logger.info(f"Template found. Placeholders: {template_placeholders}")
        
        # 2. Map instruction to JSON using AI
        ai_mapped_data = await AIMapperService.map_instruction(
            instruction=request.instruction,
            allowed_placeholders=template_placeholders
        )
        
        app_logger.info(f"AI mapped {len(ai_mapped_data)} values")
        
        # 3. Render DOCX
        rendered_content = DOCXRenderer.render_template(
            template_path=template_path,
            context=ai_mapped_data
        )
        
        # 4. Return file directly (no disk save - prevents corruption)
        return Response(
            content=rendered_content,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f"attachment; filename=generated_{request.template_id[:8]}.docx",
                "Content-Length": str(len(rendered_content))
            }
        )
        
    except TemplateNotFoundError as e:
        app_logger.error(f"Template not found: {request.template_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except AIValidationError as e:
        app_logger.error(f"AI validation error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except RenderError as e:
        app_logger.error(f"Render error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        app_logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")


@router.post("/preview")
async def preview_mapping(request: GenerateRequest):
    """Preview AI mapping without generating document"""
    try:
        app_logger.info(f"Preview mapping for template: {request.template_id}")
        
        template_placeholders = template_manager.get_template_placeholders(request.template_id)
        
        # Only map, don't render
        ai_mapped_data = await AIMapperService.map_instruction(
            instruction=request.instruction,
            allowed_placeholders=template_placeholders
        )
        
        return {
            "success": True,
            "mapped_values": ai_mapped_data,
            "placeholders_found": len(ai_mapped_data),
            "total_placeholders": len(template_placeholders)
        }
        
    except TemplateNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        app_logger.error(f"Preview error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Multi-document generation endpoint
@router.post("/generate-multiple")
async def generate_multiple_documents(request: GenerateMultipleRequest):
    """
    Generate multiple documents at once with the same AI instruction.
    Returns a ZIP file containing all generated documents.
    """
    try:
        app_logger.info(f"Bulk generating {len(request.template_ids)} documents")
        
        if not request.template_ids:
            raise HTTPException(status_code=400, detail="No templates selected")
        
        if not request.instruction.strip():
            raise HTTPException(status_code=400, detail="Instruction cannot be empty")
        
        # Create ZIP file in memory
        zip_buffer = io.BytesIO()
        generated_count = 0
        errors = []
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for template_id in request.template_ids:
                try:
                    app_logger.info(f"Processing template: {template_id}")
                    
                    # Get template
                    template_placeholders = template_manager.get_template_placeholders(template_id)
                    template_path = template_manager.get_template_path(template_id)
                    template = template_manager.get_template(template_id)
                    
                    # Map instruction to JSON using AI
                    ai_mapped_data = await AIMapperService.map_instruction(
                        instruction=request.instruction,
                        allowed_placeholders=template_placeholders
                    )
                    
                    # Render DOCX
                    rendered_content = DOCXRenderer.render_template(
                        template_path=template_path,
                        context=ai_mapped_data
                    )
                    
                    # Generate filename
                    original_name = template.get('filename', template_id)
                    base_name = original_name.replace('.docx', '') if original_name.endswith('.docx') else original_name
                    filename = f"{base_name}_generated.docx"
                    
                    # Add to ZIP
                    zip_file.writestr(filename, rendered_content)
                    generated_count += 1
                    
                except TemplateNotFoundError as e:
                    errors.append(f"Template {template_id}: Not found")
                    app_logger.error(f"Template not found: {template_id}")
                except Exception as e:
                    errors.append(f"Template {template_id}: {str(e)}")
                    app_logger.error(f"Error processing {template_id}: {str(e)}")
        
        zip_buffer.seek(0)
        
        # Prepare response message
        if generated_count == 0:
            raise HTTPException(status_code=500, detail=f"No documents generated. Errors: {', '.join(errors)}")
        
        response_message = f"Successfully generated {generated_count} of {len(request.template_ids)} documents"
        if errors:
            response_message += f". Errors: {', '.join(errors)}"
        
        app_logger.info(response_message)
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": "attachment; filename=documents.zip",
                "X-Generated-Count": str(generated_count),
                "X-Total-Count": str(len(request.template_ids))
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"Bulk generation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Bulk generation failed: {str(e)}")
    
# Add at the end of generate.py

@router.post("/generate-set/{set_id}")
async def generate_template_set(
    set_id: str,
    instruction: str,
    db: Session = Depends(get_db) if settings.use_database else None
):
    """
    Generate all templates in a template set using shared instruction
    Returns ZIP file containing all generated documents
    """
    try:
        from app.services.template_set_service import TemplateSetService
        
        app_logger.info(f"Generating template set: {set_id}")
        
        # Get template set details
        set_details = TemplateSetService.get_set_with_details(db, set_id)
        if not set_details:
            raise HTTPException(status_code=404, detail="Template set not found")
        
        templates = set_details.get("templates", [])
        shared_fields = set_details.get("shared_fields", [])
        
        if not templates:
            raise HTTPException(status_code=400, detail="No templates in this set")
        
        # Build shared field context from AI
        shared_placeholders = [f["field_name"] for f in shared_fields]
        
        # Get AI mapped values for shared fields
        ai_mapped_data = await AIMapperService.map_instruction(
            instruction=instruction,
            allowed_placeholders=shared_placeholders
        )
        
        # Create ZIP file
        zip_buffer = io.BytesIO()
        generated_count = 0
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for template_data in templates:
                template_id = template_data["id"]
                template_filename = template_data["filename"]
                
                # Get template
                template_placeholders = template_manager.get_template_placeholders(template_id)
                template_path = template_manager.get_template_path(template_id)
                
                # Merge shared field values with template placeholders
                render_context = {}
                for ph in template_placeholders:
                    if ph in ai_mapped_data and ai_mapped_data[ph]:
                        render_context[ph] = ai_mapped_data[ph]
                
                # Render document
                rendered_content = DOCXRenderer.render_template(
                    template_path=template_path,
                    context=render_context
                )
                
                # Add to ZIP
                base_name = template_filename.replace('.docx', '')
                filename = f"{base_name}_generated.docx"
                zip_file.writestr(filename, rendered_content)
                generated_count += 1
        
        zip_buffer.seek(0)
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename=template_set_{set_id[:8]}.zip",
                "X-Generated-Count": str(generated_count),
                "X-Total-Count": str(len(templates))
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"Template set generation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Set generation failed: {str(e)}")