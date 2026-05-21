from pathlib import Path
from docxtpl import DocxTemplate
from typing import Dict
import io
import re
from app.core.exceptions import RenderError
from app.utils.logging_config import app_logger

class DOCXRenderer:
    @staticmethod
    def render_template(
        template_path: Path,
        context: Dict[str, str]
    ) -> bytes:
        """Render DOCX template with context data"""
        try:
            doc = DocxTemplate(template_path)
            
            # IMPORTANT: Send ALL placeholders to docxtpl
            # For empty values, send the placeholder name itself wrapped in {{}}
            # This way docxtpl will keep it as {{placeholder}}
            processed_context = {}
            for key, value in context.items():
                if value and str(value).strip():
                    # Non-empty value - use as is
                    processed_context[key] = str(value).strip()
                else:
                    # Empty value - send the placeholder itself
                    # This will be rendered as {{key}} in the document
                    processed_context[key] = f"{{{{{key}}}}}"
            
            # Also need to ensure ALL placeholders from template are in context
            # Extract all placeholders from template to find missing ones
            from docx import Document
            template_doc = Document(template_path)
            pattern = r'\{\{([^}]+)\}\}'
            all_placeholders = set()
            
            for paragraph in template_doc.paragraphs:
                matches = re.findall(pattern, paragraph.text)
                all_placeholders.update(matches)
            
            for table in template_doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        matches = re.findall(pattern, cell.text)
                        all_placeholders.update(matches)
            
            # Add any missing placeholders with their {{}} form
            for placeholder in all_placeholders:
                if placeholder not in processed_context:
                    processed_context[placeholder] = f"{{{{{placeholder}}}}}"
            
            doc.render(processed_context)
            
            output_stream = io.BytesIO()
            doc.save(output_stream)
            output_stream.seek(0)
            
            app_logger.info(f"Rendered: {len([v for v in processed_context.values() if not v.startswith('{{')])} filled, {len([v for v in processed_context.values() if v.startswith('{{')])} kept as {{}}")
            return output_stream.getvalue()
            
        except Exception as e:
            app_logger.error(f"Rendering failed: {str(e)}")
            raise RenderError(f"Cannot render document: {str(e)}")
    
    @staticmethod
    def render_with_defaults(
        template_path: Path,
        context: Dict[str, str],
        default_value: str = ""
    ) -> bytes:
        """
        Alternative: Fill empty placeholders with default value
        """
        try:
            # Fill all empty values with default
            filled_context = {}
            for key, value in context.items():
                if value and value.strip():
                    filled_context[key] = value
                else:
                    filled_context[key] = default_value
            
            doc = DocxTemplate(template_path)
            doc.render(filled_context)
            
            output_stream = io.BytesIO()
            doc.save(output_stream)
            output_stream.seek(0)
            
            app_logger.info(f"Rendered with defaults: {len(filled_context)} placeholders filled")
            return output_stream.getvalue()
            
        except Exception as e:
            app_logger.error(f"Rendering failed: {str(e)}")
            raise RenderError(f"Cannot render document: {str(e)}")