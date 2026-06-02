from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from app.models.template_set import TemplateSet
from app.models.template_set_member import TemplateSetMember
from app.models.shared_field import SharedField
from app.models.template import TemplateModel
from app.core.exceptions import TemplateNotFoundError
from app.utils.logging_config import app_logger

class TemplateSetService:
    
    @staticmethod
    def create_template_set(db: Session, name: str, description: str = None) -> TemplateSet:
        """Create a new template set"""
        template_set = TemplateSet(
            name=name,
            description=description
        )
        db.add(template_set)
        db.commit()
        db.refresh(template_set)
        app_logger.info(f"Template set created: {template_set.id}")
        return template_set
    
    @staticmethod
    def get_template_set(db: Session, set_id: str) -> Optional[TemplateSet]:
        """Get template set by ID"""
        return db.query(TemplateSet).filter(
            TemplateSet.id == set_id,
            TemplateSet.is_deleted == False
        ).first()
    
    @staticmethod
    def get_all_template_sets(db: Session, skip: int = 0, limit: int = 100) -> List[TemplateSet]:
        """Get all template sets"""
        return db.query(TemplateSet).filter(
            TemplateSet.is_deleted == False
        ).order_by(TemplateSet.created_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def update_template_set(db: Session, set_id: str, name: str = None, description: str = None) -> Optional[TemplateSet]:
        """Update template set"""
        template_set = TemplateSetService.get_template_set(db, set_id)
        if not template_set:
            return None
        
        if name is not None:
            template_set.name = name
        if description is not None:
            template_set.description = description
        
        db.commit()
        db.refresh(template_set)
        return template_set
    
    @staticmethod
    def delete_template_set(db: Session, set_id: str) -> bool:
        """Soft delete template set"""
        template_set = TemplateSetService.get_template_set(db, set_id)
        if not template_set:
            return False
        
        template_set.is_deleted = True
        db.commit()
        app_logger.info(f"Template set deleted: {set_id}")
        return True
    
    @staticmethod
    def add_template_to_set(db: Session, set_id: str, template_id: str, order_index: int = 0) -> bool:
        """Add a template to the set"""
        # Check if template exists
        template = db.query(TemplateModel).filter(TemplateModel.id == template_id).first()
        if not template:
            raise TemplateNotFoundError(f"Template {template_id} not found")
        
        # Check if already exists
        existing = db.query(TemplateSetMember).filter(
            TemplateSetMember.template_set_id == set_id,
            TemplateSetMember.template_id == template_id
        ).first()
        
        if existing:
            return True
        
        member = TemplateSetMember(
            template_set_id=set_id,
            template_id=template_id,
            order_index=order_index
        )
        db.add(member)
        db.commit()
        app_logger.info(f"Template {template_id} added to set {set_id}")
        return True
    
    @staticmethod
    def remove_template_from_set(db: Session, set_id: str, template_id: str) -> bool:
        """Remove a template from the set"""
        member = db.query(TemplateSetMember).filter(
            TemplateSetMember.template_set_id == set_id,
            TemplateSetMember.template_id == template_id
        ).first()
        
        if not member:
            return False
        
        db.delete(member)
        db.commit()
        return True
    
    @staticmethod
    def get_templates_in_set(db: Session, set_id: str) -> List[TemplateModel]:
        """Get all templates in a set"""
        members = db.query(TemplateSetMember).filter(
            TemplateSetMember.template_set_id == set_id
        ).order_by(TemplateSetMember.order_index).all()
        
        template_ids = [m.template_id for m in members]
        
        templates = db.query(TemplateModel).filter(
            TemplateModel.id.in_(template_ids),
            TemplateModel.is_deleted == False
        ).all()
        
        # Sort by order_index
        template_dict = {t.id: t for t in templates}
        return [template_dict[tid] for tid in template_ids if tid in template_dict]
    
    @staticmethod
    def add_shared_field(db: Session, set_id: str, field_name: str, field_label: str, 
                         field_type: str = "text", field_order: int = 0, 
                         is_required: bool = False, default_value: str = None) -> SharedField:
        """Add a shared field to the template set"""
        field = SharedField(
            template_set_id=set_id,
            field_name=field_name,
            field_label=field_label,
            field_type=field_type,
            field_order=field_order,
            is_required=is_required,
            default_value=default_value
        )
        db.add(field)
        db.commit()
        db.refresh(field)
        return field
    
    @staticmethod
    def get_shared_fields(db: Session, set_id: str) -> List[SharedField]:
        """Get all shared fields for a template set"""
        return db.query(SharedField).filter(
            SharedField.template_set_id == set_id
        ).order_by(SharedField.field_order).all()
    
    @staticmethod
    def update_shared_field(db: Session, field_id: str, **kwargs) -> Optional[SharedField]:
        """Update a shared field"""
        field = db.query(SharedField).filter(SharedField.id == field_id).first()
        if not field:
            return None
        
        for key, value in kwargs.items():
            if hasattr(field, key) and value is not None:
                setattr(field, key, value)
        
        db.commit()
        db.refresh(field)
        return field
    
    @staticmethod
    def delete_shared_field(db: Session, field_id: str) -> bool:
        """Delete a shared field"""
        field = db.query(SharedField).filter(SharedField.id == field_id).first()
        if not field:
            return False
        
        db.delete(field)
        db.commit()
        return True
    
    @staticmethod
    def get_set_with_details(db: Session, set_id: str) -> Dict:
        """Get complete template set with all details"""
        template_set = TemplateSetService.get_template_set(db, set_id)
        if not template_set:
            return None
        
        templates = TemplateSetService.get_templates_in_set(db, set_id)
        shared_fields = TemplateSetService.get_shared_fields(db, set_id)
        
        # Get all placeholders from all templates in set
        all_placeholders = set()
        for template in templates:
            all_placeholders.update(template.placeholders)
        
        return {
            "template_set": template_set.to_dict(),
            "templates": [t.to_dict() for t in templates],
            "shared_fields": [f.to_dict() for f in shared_fields],
            "total_templates": len(templates),
            "total_shared_fields": len(shared_fields),
            "unique_placeholders": list(all_placeholders)
        }