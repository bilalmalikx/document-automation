from typing import List, Dict, Set
from app.core.openai_client import openai_client
from app.utils.validation import PlaceholderValidator
from app.utils.logging_config import app_logger

class AIMapperService:
    @staticmethod
    async def map_instruction(
        instruction: str, 
        allowed_placeholders: Set[str]
    ) -> Dict[str, str]:
        """
        Map user instruction to validated JSON
        Returns dictionary with ALL allowed placeholders (empty string if missing)
        """
        if not allowed_placeholders:
            app_logger.warning("No placeholders provided for mapping")
            return {}
        
        # Convert set to list for API
        placeholders_list = sorted(list(allowed_placeholders))
        
        # Get AI response
        ai_result = await openai_client.map_instruction_to_json(
            instruction=instruction,
            allowed_placeholders=placeholders_list
        )
        
        # Strict validation
        validated_result = PlaceholderValidator.validate_ai_response(
            ai_json=ai_result,
            allowed_placeholders=allowed_placeholders,
            strict_mode=True
        )
        
        # Ensure ALL placeholders have a value (fill missing with empty string)
        complete_result = {}
        for placeholder in allowed_placeholders:
            if placeholder in validated_result and validated_result[placeholder]:
                complete_result[placeholder] = validated_result[placeholder]
            else:
                # Keep placeholder as-is by not adding to context
                # Or set to empty string to remove it
                # For keeping placeholder, we skip adding to context
                pass  # Don't add to context - placeholder stays as {{placeholder}}
        
        app_logger.info(f"AI mapping completed. Filled {len(validated_result)} of {len(allowed_placeholders)} placeholders")
        return validated_result