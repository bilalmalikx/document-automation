from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class TemplateUploadResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    placeholders: List[str]
    placeholder_count: int
    created_at: str

class TemplatePlaceholdersResponse(BaseModel):
    template_id: str
    placeholders: List[str]
    count: int

class TemplateListResponse(BaseModel):
    templates: List[TemplateUploadResponse]
    total: int
