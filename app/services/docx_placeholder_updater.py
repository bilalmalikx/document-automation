from docx import Document
from pathlib import Path
import re

def update_placeholder_in_docx(file_path: str, old_name: str, new_name: str) -> bool:
    """
    Update placeholder name in DOCX file.
    Replaces {{old_name}} with {{new_name}} in the document.
    """
    try:
        doc = Document(file_path)
        
        # Pattern to match {{placeholder}}
        old_pattern = re.compile(r'\{\{\s*' + re.escape(old_name) + r'\s*\}\}')
        new_placeholder = f"{{{{{new_name}}}}}"
        
        # Update in paragraphs
        for paragraph in doc.paragraphs:
            if old_pattern.search(paragraph.text):
                paragraph.text = old_pattern.sub(new_placeholder, paragraph.text)
        
        # Update in tables
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for paragraph in cell.paragraphs:
                        if old_pattern.search(paragraph.text):
                            paragraph.text = old_pattern.sub(new_placeholder, paragraph.text)
        
        # Save the document
        doc.save(file_path)
        return True
        
    except Exception as e:
        print(f"Error updating DOCX: {str(e)}")
        return False