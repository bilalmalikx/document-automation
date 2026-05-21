from pydantic import BaseModel, Field, field_validator
from typing import Dict, Any

class AIResponse(BaseModel):
    """Strict schema for AI response validation"""
    data: Dict[str, str] = Field(..., description="Validated placeholder-value pairs")
    
    @field_validator('data')
    @classmethod
    def validate_no_empty_keys(cls, v: Dict[str, str]) -> Dict[str, str]:
        """Ensure no empty keys"""
        if any(not key for key in v.keys()):
            raise ValueError("Empty placeholder keys are not allowed")
        return v
    
    class Config:
        extra = "forbid"  # No extra fields allowed