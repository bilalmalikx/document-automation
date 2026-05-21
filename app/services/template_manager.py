from typing import Dict, Set, Optional, List
from pathlib import Path
import uuid
from datetime import datetime
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from app.services.placeholder_extractor import PlaceholderExtractor
from app.utils.file_utils import FileManager
from app.core.exceptions import TemplateNotFoundError
from app.utils.logging_config import app_logger
from app.config import settings

# Import database models only if using database
if settings.use_database:
    from app.models.template import TemplateModel
    from app.database import SessionLocal

class TemplateManager:
    def __init__(self):
        self.templates_store: Dict[str, Dict] = {}  # Fallback in-memory
    
    async def create_template(
        self, 
        file: UploadFile, 
        filename: str,
        db: Session = None
    ) -> Dict:
        """Upload and process new template - saves to DB if available"""
        template_id = str(uuid.uuid4())
        
        # Save file to disk
        file_path = await FileManager.save_template_file(file, template_id)
        
        # Extract placeholders
        placeholders = PlaceholderExtractor.extract_from_docx(Path(file_path))
        PlaceholderExtractor.validate_placeholders(placeholders)
        
        # Prepare template data
        template_data = {
            "id": template_id,
            "filename": filename,
            "original_filename": filename,
            "file_path": file_path,
            "placeholders": list(placeholders),
            "placeholder_count": len(placeholders),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Save to database if available
        if settings.use_database and db:
            try:
                db_template = TemplateModel(
                    id=template_id,
                    filename=filename,
                    original_filename=filename,
                    file_path=str(file_path),
                    placeholders=list(placeholders),
                    placeholder_count=len(placeholders)
                )
                db.add(db_template)
                db.commit()
                db.refresh(db_template)
                app_logger.info(f"Template saved to database: {template_id}")
            except Exception as e:
                app_logger.error(f"Database save failed: {str(e)}")
                db.rollback()
                # Fallback to in-memory
                self.templates_store[template_id] = template_data
        else:
            # Save to in-memory store
            self.templates_store[template_id] = template_data
            app_logger.info(f"Template saved to memory: {template_id}")
        
        return template_data
    
    def get_template(self, template_id: str, db: Session = None) -> Dict:
        """Get template metadata from DB or memory"""
        # Try database first
        if settings.use_database and db:
            try:
                db_template = db.query(TemplateModel).filter(
                    TemplateModel.id == template_id,
                    TemplateModel.is_deleted == False
                ).first()
                
                if db_template:
                    app_logger.info(f"Template retrieved from database: {template_id}")
                    return db_template.to_dict()
            except Exception as e:
                app_logger.error(f"Database read failed: {str(e)}")
        
        # Fallback to in-memory
        if template_id in self.templates_store:
            return self.templates_store[template_id]
        
        raise TemplateNotFoundError(f"Template {template_id} not found")
    
    def get_template_placeholders(self, template_id: str, db: Session = None) -> Set[str]:
        """Get allowed placeholders for template"""
        template = self.get_template(template_id, db)
        return set(template["placeholders"])
    
    def get_template_path(self, template_id: str, db: Session = None) -> Path:
        """Get template file path"""
        template = self.get_template(template_id, db)
        return Path(template["file_path"])
    
    def list_templates(self, db: Session = None, skip: int = 0, limit: int = 100) -> List[Dict]:
        """List all templates from DB or memory"""
        templates = []
        
        # Try database first
        if settings.use_database and db:
            try:
                db_templates = db.query(TemplateModel).filter(
                    TemplateModel.is_deleted == False
                ).order_by(TemplateModel.created_at.desc()).offset(skip).limit(limit).all()
                
                if db_templates:
                    templates = [t.to_dict() for t in db_templates]
                    app_logger.info(f"Retrieved {len(templates)} templates from database")
                    return templates
            except Exception as e:
                app_logger.error(f"Database list failed: {str(e)}")
        
        # Fallback to in-memory
        templates = list(self.templates_store.values())
        return templates[skip:skip+limit]
    
    def delete_template(self, template_id: str, db: Session = None) -> bool:
        """Soft delete template from DB"""
        # Try database first
        if settings.use_database and db:
            try:
                db_template = db.query(TemplateModel).filter(
                    TemplateModel.id == template_id
                ).first()
                
                if db_template:
                    db_template.is_deleted = True
                    db.commit()
                    app_logger.info(f"Template soft deleted from database: {template_id}")
                    return True
            except Exception as e:
                app_logger.error(f"Database delete failed: {str(e)}")
        
        # Fallback to in-memory
        if template_id in self.templates_store:
            del self.templates_store[template_id]
            return True
        
        return False
    
    def search_by_placeholder(self, placeholder_name: str, db: Session = None) -> List[Dict]:
        """Search templates containing specific placeholder"""
        if settings.use_database and db:
            try:
                # PostgreSQL JSON search
                db_templates = db.query(TemplateModel).filter(
                    TemplateModel.placeholders.contains([placeholder_name]),
                    TemplateModel.is_deleted == False
                ).all()
                
                return [t.to_dict() for t in db_templates]
            except Exception as e:
                app_logger.error(f"Placeholder search failed: {str(e)}")
        
        # Memory search
        results = []
        for template in self.templates_store.values():
            if placeholder_name in template["placeholders"]:
                results.append(template)
        return results

# Singleton
template_manager = TemplateManager()

# Add this method to debug template retrieval
def debug_template(self, template_id: str, db: Session = None):
    """Debug method to check template existence"""
    if settings.use_database and db:
        try:
            from app.models.template import TemplateModel
            db_template = db.query(TemplateModel).filter(
                TemplateModel.id == template_id,
                TemplateModel.is_deleted == False
            ).first()
            
            if db_template:
                app_logger.info(f"✅ Found template in DB: {db_template.id}")
                return True
            else:
                app_logger.warning(f"❌ Template {template_id} NOT in DB")
                # Check if exists but deleted
                deleted = db.query(TemplateModel).filter(
                    TemplateModel.id == template_id,
                    TemplateModel.is_deleted == True
                ).first()
                if deleted:
                    app_logger.warning(f"Template exists but is_deleted=True")
                return False
        except Exception as e:
            app_logger.error(f"Debug error: {str(e)}")
            return False
    return False
