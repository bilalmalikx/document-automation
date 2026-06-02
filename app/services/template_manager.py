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
        
        app_logger.info(f"📝 Extracted {len(placeholders)} placeholders: {placeholders}")
        
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
        
        # ✅ CRITICAL: Save to PostgreSQL database
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
                app_logger.info(f"✅✅✅ Template saved to DATABASE: {template_id}")
                
                # Also save to memory for fallback
                self.templates_store[template_id] = template_data
                
            except Exception as e:
                app_logger.error(f"❌ Database save failed: {str(e)}")
                db.rollback()
                self.templates_store[template_id] = template_data
                app_logger.info(f"⚠️ Template saved to MEMORY only: {template_id}")
        else:
            # Fallback to memory
            self.templates_store[template_id] = template_data
            if settings.use_database:
                app_logger.error(f"❌ No database session provided! Template saved to MEMORY only: {template_id}")
            else:
                app_logger.info(f"📝 Template saved to MEMORY: {template_id}")
        
        return template_data
    
    def get_template(self, template_id: str, db: Session = None) -> Dict:
        """Get template metadata from DB or memory"""
        # Try database first
        if settings.use_database:
            db_session = db
            own_session = False
            
            if not db_session:
                try:
                    db_session = SessionLocal()
                    own_session = True
                except Exception as e:
                    app_logger.error(f"Could not create session: {str(e)}")
            
            if db_session:
                try:
                    db_template = db_session.query(TemplateModel).filter(
                        TemplateModel.id == template_id,
                        TemplateModel.is_deleted == False
                    ).first()
                    
                    if db_template:
                        app_logger.info(f"✅ Template found in DATABASE: {template_id}")
                        return db_template.to_dict()
                except Exception as e:
                    app_logger.error(f"Database read failed: {str(e)}")
                finally:
                    if own_session and db_session:
                        db_session.close()
        
        # Fallback to in-memory
        if template_id in self.templates_store:
            app_logger.info(f"📝 Template found in MEMORY: {template_id}")
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
        if settings.use_database:
            db_session = db
            own_session = False
            
            if not db_session:
                try:
                    db_session = SessionLocal()
                    own_session = True
                except:
                    pass
            
            if db_session:
                try:
                    db_templates = db_session.query(TemplateModel).filter(
                        TemplateModel.is_deleted == False
                    ).order_by(TemplateModel.created_at.desc()).offset(skip).limit(limit).all()
                    
                    if db_templates:
                        templates = [t.to_dict() for t in db_templates]
                        app_logger.info(f"📊 Retrieved {len(templates)} templates from DATABASE")
                        return templates
                except Exception as e:
                    app_logger.error(f"Database list failed: {str(e)}")
                finally:
                    if own_session and db_session:
                        db_session.close()
        
        # Fallback to in-memory
        templates = list(self.templates_store.values())
        app_logger.info(f"📊 Retrieved {len(templates)} templates from MEMORY")
        return templates[skip:skip+limit]
    
    def delete_template(self, template_id: str, db: Session = None) -> bool:
        """Soft delete template from DB"""
        if settings.use_database:
            db_session = db
            own_session = False
            
            if not db_session:
                try:
                    db_session = SessionLocal()
                    own_session = True
                except:
                    pass
            
            if db_session:
                try:
                    db_template = db_session.query(TemplateModel).filter(
                        TemplateModel.id == template_id
                    ).first()
                    
                    if db_template:
                        db_template.is_deleted = True
                        db_session.commit()
                        app_logger.info(f"🗑️ Template deleted from DATABASE: {template_id}")
                        return True
                except Exception as e:
                    app_logger.error(f"Database delete failed: {str(e)}")
                finally:
                    if own_session and db_session:
                        db_session.close()
        
        # Fallback to in-memory
        if template_id in self.templates_store:
            del self.templates_store[template_id]
            app_logger.info(f"🗑️ Template deleted from MEMORY: {template_id}")
            return True
        
        return False
    
    def search_by_placeholder(self, placeholder_name: str, db: Session = None) -> List[Dict]:
        """Search templates containing specific placeholder"""
        if settings.use_database:
            db_session = db
            own_session = False
            
            if not db_session:
                try:
                    db_session = SessionLocal()
                    own_session = True
                except:
                    pass
            
            if db_session:
                try:
                    db_templates = db_session.query(TemplateModel).filter(
                        TemplateModel.placeholders.contains([placeholder_name]),
                        TemplateModel.is_deleted == False
                    ).all()
                    
                    return [t.to_dict() for t in db_templates]
                except Exception as e:
                    app_logger.error(f"Placeholder search failed: {str(e)}")
                finally:
                    if own_session and db_session:
                        db_session.close()
        
        # Memory search
        results = []
        for template in self.templates_store.values():
            if placeholder_name in template["placeholders"]:
                results.append(template)
        return results

# Singleton
template_manager = TemplateManager()