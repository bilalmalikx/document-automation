from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Integer
from sqlalchemy.sql import func
from app.database import Base
import uuid

class SharedField(Base):
    __tablename__ = "shared_fields"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_set_id = Column(String(36), ForeignKey("template_sets.id", ondelete="CASCADE"), nullable=False)
    field_name = Column(String(255), nullable=False)
    field_label = Column(String(255), nullable=False)
    field_type = Column(String(50), default="text")
    field_order = Column(Integer, default=0)
    is_required = Column(Boolean, default=False)
    default_value = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def to_dict(self):
        return {
            "id": self.id,
            "template_set_id": self.template_set_id,
            "field_name": self.field_name,
            "field_label": self.field_label,
            "field_type": self.field_type,
            "field_order": self.field_order,
            "is_required": self.is_required,
            "default_value": self.default_value,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }