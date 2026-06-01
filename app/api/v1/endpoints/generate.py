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