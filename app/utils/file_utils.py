from pathlib import Path
import uuid
from fastapi import UploadFile
from app.core.exceptions import FileUploadError
from app.utils.logging_config import app_logger
from app.config import settings

class FileManager:
    @staticmethod
    async def save_template_file(file: UploadFile, template_id: str) -> str:
        """Save uploaded template file"""
        try:
            # ✅ FIXED: Use settings directly
            file_ext = Path(file.filename).suffix.lower()
            
            # Check allowed extensions
            if file_ext not in settings.allowed_extensions_list:
                raise FileUploadError(f"Invalid file type. Allowed: {settings.allowed_extensions_list}")
            
            # Create template directory
            template_dir = Path(settings.templates_dir) / template_id
            template_dir.mkdir(parents=True, exist_ok=True)
            
            # Save file
            file_path = template_dir / f"original{file_ext}"
            
            # Read and write file
            content = await file.read()
            if len(content) > settings.max_upload_size:
                raise FileUploadError(f"File too large. Max size: {settings.max_upload_size} bytes")
            
            with open(file_path, "wb") as f:
                f.write(content)
            
            app_logger.info(f"Template saved: {file_path}")
            return str(file_path)
            
        except Exception as e:
            app_logger.error(f"Failed to save template: {str(e)}")
            raise FileUploadError(f"Could not save file: {str(e)}")
    
    @staticmethod
    def get_template_path(template_id: str) -> Path:
        """Get template file path"""
        template_dir = Path(settings.templates_dir) / template_id
        original_file = template_dir / "original.docx"
        
        if not original_file.exists():
            raise FileNotFoundError(f"Template {template_id} not found")
        
        return original_file
    
    @staticmethod
    def save_generated_document(content: bytes, template_id: str) -> str:
        """Save generated document and return path"""
        try:
            generated_dir = Path(settings.generated_dir) / template_id
            generated_dir.mkdir(parents=True, exist_ok=True)
            
            doc_id = str(uuid.uuid4())[:8]
            file_path = generated_dir / f"generated_{doc_id}.docx"
            
            with open(file_path, "wb") as f:
                f.write(content)
            
            app_logger.info(f"Generated document saved: {file_path}")
            return str(file_path)
            
        except Exception as e:
            app_logger.error(f"Failed to save generated document: {str(e)}")
            raise FileUploadError(f"Could not save generated document: {str(e)}")