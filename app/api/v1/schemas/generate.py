from pydantic import BaseModel, Field
from typing import Dict, Optional

class GenerateRequest(BaseModel):
    template_id: str = Field(..., description="Template ID to use")
    instruction: str = Field(..., description="Natural language instruction", min_length=1, max_length=5000)

class GenerateResponse(BaseModel):
    success: bool
    message: str
    document_id: str
    download_url: str
    placeholders_filled: Dict[str, str]
    
    
class GenerateMultipleRequest(BaseModel):
    template_ids: List[str]
    instruction: str