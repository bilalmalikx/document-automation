import os
import shutil
import uuid
from pathlib import Path
from typing import BinaryIO
from fastapi import UploadFile
from app.config import settings
from app.core.exceptions import FileUploadError
from app.utils.logging_config import app_logger

class FileManager:
    @staticmethod
    async def save_template_file(file: UploadFile, template_id: str) -> str:
        """Save uploaded template file"""
        try:
            # Validate extension
            file_ext = Path(file.filename).suffix.lower()
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
            # Create generated directory if not exists
            generated_dir = Path(settings.generated_dir) / template_id
            generated_dir.mkdir(parents=True, exist_ok=True)
            
            # Generate unique filename
            doc_id = str(uuid.uuid4())[:8]
            file_path = generated_dir / f"generated_{doc_id}.docx"
            
            # Save file
            with open(file_path, "wb") as f:
                f.write(content)
            
            app_logger.info(f"Generated document saved: {file_path}")
            return str(file_path)
            
        except Exception as e:
            app_logger.error(f"Failed to save generated document: {str(e)}")
            raise FileUploadError(f"Could not save generated document: {str(e)}")
    
    @staticmethod
    def cleanup_temp_files(template_id: str):
        """Clean up temporary files (optional)"""
        try:
            generated_dir = Path(settings.generated_dir) / template_id
            if generated_dir.exists():
                # Delete files older than 24 hours
                import time
                current_time = time.time()
                for file in generated_dir.glob("*.docx"):
                    if current_time - file.stat().st_mtime > 86400:  # 24 hours
                        file.unlink()
                        app_logger.info(f"Cleaned up old file: {file}")
        except Exception as e:
            app_logger.warning(f"Cleanup failed: {str(e)}")