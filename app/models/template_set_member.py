from sqlalchemy import Column, String, Integer, ForeignKey, PrimaryKeyConstraint
from app.database import Base

class TemplateSetMember(Base):
    __tablename__ = "template_set_members"
    
    template_set_id = Column(String(36), ForeignKey("template_sets.id", ondelete="CASCADE"), nullable=False)
    template_id = Column(String(36), ForeignKey("templates.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, default=0)
    
    __table_args__ = (
        PrimaryKeyConstraint("template_set_id", "template_id"),
    )
    
    def to_dict(self):
        return {
            "template_set_id": self.template_set_id,
            "template_id": self.template_id,
            "order_index": self.order_index
        }