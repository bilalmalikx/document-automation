from typing import List, Dict, Set
from app.core.exceptions import InvalidPlaceholderError, AIValidationError
from app.utils.logging_config import app_logger
import re

class PlaceholderValidator:
    """Strict validation to prevent hallucinations"""
    
    @staticmethod
    def extract_placeholders_from_text(content: str) -> Set[str]:
        """Extract all {{placeholder}} from text"""
        pattern = r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}'
        placeholders = set(re.findall(pattern, content))
        return placeholders
    
    @staticmethod
    def validate_ai_response(
        ai_json: Dict[str, str], 
        allowed_placeholders: Set[str],
        strict_mode: bool = True
    ) -> Dict[str, str]:
        """
        Strictly validate AI response against allowed placeholders
        Returns validated dict or raises error
        """
        
        ai_keys = set(ai_json.keys())
        
        # Check for unknown placeholders (hallucinations)
        unknown_keys = ai_keys - allowed_placeholders
        if unknown_keys and strict_mode:
            app_logger.error(f"AI hallucinated unknown placeholders: {unknown_keys}")
            raise AIValidationError(
                f"AI returned invalid placeholders: {unknown_keys}. "
                f"Allowed: {allowed_placeholders}"
            )
        
        # Check for missing required placeholders
        missing_keys = allowed_placeholders - ai_keys
        if missing_keys:
            app_logger.warning(f"AI missing placeholders: {missing_keys}, filling with empty string")
            # Add missing keys with empty string
            for key in missing_keys:
                ai_json[key] = ""
        
        # Filter only allowed keys
        validated = {k: v for k, v in ai_json.items() if k in allowed_placeholders}
        
        # Type validation and sanitization
        for key, value in validated.items():
            # Convert to string
            validated[key] = str(value).strip()
            
            # Remove any Jinja2 syntax to prevent injection
            validated[key] = validated[key].replace('{{', '').replace('}}', '')
            
            # Basic length validation
            if len(validated[key]) > 10000:
                raise AIValidationError(f"Value for {key} exceeds maximum length")
        
        app_logger.info(f"Validation passed. Mapped {len([v for v in validated.values() if v])} of {len(allowed_placeholders)} placeholders")
        return validated
    
    @staticmethod
    def sanitize_placeholder_name(placeholder: str) -> str:
        """Ensure placeholder name is safe"""
        sanitized = re.sub(r'[^a-zA-Z0-9_]', '', placeholder)
        if not sanitized:
            raise InvalidPlaceholderError(f"Invalid placeholder name: {placeholder}")
        return sanitized