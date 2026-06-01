from openai import AsyncOpenAI
from typing import List, Dict
from app.config import settings
from app.utils.logging_config import app_logger
from tenacity import retry, stop_after_attempt, wait_exponential
import json

class OpenAIClient:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url
        )
        self.model = settings.openai_model
        self.temperature = settings.openai_temperature
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=5)
    )
    async def map_instruction_to_json(
        self, 
        instruction: str, 
        allowed_placeholders: List[str]
    ) -> Dict[str, str]:
        """Use Groq to map instruction to JSON"""
        
        system_prompt = """You are a data extraction system. Convert user instructions to JSON.

CRITICAL RULES:
1. Return ONLY valid JSON - no explanations, no markdown
2. Use ONLY the allowed placeholder names
3. DO NOT invent new field names
4. If information is missing, use empty string ""
5. You MUST include EVERY placeholder from the allowed list

Example: {"company_name": "Acme Corp", "director_name": "John Smith"}

ONLY JSON output, nothing else!"""
        
        user_prompt = f"""Allowed placeholders (MUST include all): {', '.join(allowed_placeholders)}

User instruction: {instruction}

Return JSON with ALL placeholders above:"""
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=self.temperature
            )
            
            content = response.choices[0].message.content
            content = content.strip()
            if content.startswith('```json'):
                content = content[7:]
            if content.startswith('```'):
                content = content[3:]
            if content.endswith('```'):
                content = content[:-3]
            content = content.strip()
            
            result = json.loads(content)
            
            # Ensure all placeholders are present
            for placeholder in allowed_placeholders:
                if placeholder not in result:
                    result[placeholder] = ""
            
            filled = len([v for v in result.values() if v])
            app_logger.info(f"Groq API success: {filled} of {len(allowed_placeholders)} placeholders filled")
            return result
            
        except Exception as e:
            app_logger.error(f"Groq API error: {str(e)}")
            raise
    
    async def health_check(self) -> bool:
        try:
            await self.client.models.list()
            return True
        except Exception as e:
            app_logger.error(f"Health check failed: {str(e)}")
            return False

openai_client = OpenAIClient()