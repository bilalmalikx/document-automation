from sqlalchemy import Column, String, DateTime, Integer, Boolean, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database import Base
import uuid

class TemplateModel(Base):
    __tablename__ = "templates"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False, unique=True)
    placeholders = Column(JSONB, nullable=False, default=list)
    placeholder_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_deleted = Column(Boolean, default=False, index=True)
    
    # GIN index for JSONB search
    __table_args__ = (
        Index('idx_placeholders_gin', placeholders, postgresql_using='gin'),
    )
    
    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "original_filename": self.original_filename,
            "file_path": self.file_path,
            "placeholders": self.placeholders if self.placeholders else [],
            "placeholder_count": self.placeholder_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f"<Template(id={self.id}, filename={self.filename}, placeholders={self.placeholder_count})>"
