from langchain_community.document_loaders import PyPDFLoader
from typing import List
from app.utils.config import config
import os

class PDFLoaderComponent:
    def __init__(self):
        self.upload_dir = config.UPLOAD_DIR
    
    def load_pdf(self, file_path: str) -> List:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF not found: {file_path}")
        
        loader = PyPDFLoader(file_path)
        documents = loader.load()
        
        # Metadata mein filename add karo
        for doc in documents:
            doc.metadata["source"] = os.path.basename(file_path)
        
        return documents
    
    def get_pdf_pages_count(self, file_path: str) -> int:
        documents = self.load_pdf(file_path)
        return len(documents)