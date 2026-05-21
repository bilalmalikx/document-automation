from typing import Optional
from fastapi import Request
from app.services.template_manager import template_manager
from app.services.ai_mapper import AIMapperService
from app.core.openai_client import openai_client

# Dependency injection for services
async def get_template_manager():
    return template_manager

async def get_ai_mapper():
    return AIMapperService()

async def get_openai_client():
    return openai_client

# Rate limiting dependency (optional)
async def check_rate_limit(request: Request):
    # Implement rate limiting if needed
    return True