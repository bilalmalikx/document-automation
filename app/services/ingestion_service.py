from app.components.pdf_loader import PDFLoaderComponent
from app.components.text_splitter import TextSplitterComponent
from app.components.vector_store import VectorStoreComponent
from typing import Dict, Any
import os
import shutil
from app.utils.config import config

class IngestionService:
    def __init__(self):
        self.pdf_loader = PDFLoaderComponent()
        self.text_splitter = TextSplitterComponent()
        self.vector_store = VectorStoreComponent()
    
    def process_pdf(self, file_path: str, filename: str) -> Dict[str, Any]:
        """
        Complete PDF processing pipeline:
        1. Load PDF
        2. Split into chunks
        3. Create embeddings
        4. Store in vector DB
        """
        try:
            # Step 1: Load PDF pages
            documents = self.pdf_loader.load_pdf(file_path)
            pages_count = len(documents)
            
            # Step 2: Split into chunks
            chunks = self.text_splitter.split_documents(documents)
            chunks_count = len(chunks)
            
            # Step 3: Add metadata (filename) - clean filename for exact matching
            for chunk in chunks:
                chunk.metadata["pdf_name"] = filename.strip()
            
            # Debug print
            print(f"✅ Storing {chunks_count} chunks for: {filename}")
            
            # Step 4: Store in vector database
            self.vector_store.create_vector_store(chunks)
            
            # Step 5: Return stats
            return {
                "success": True,
                "filename": filename,
                "pages": pages_count,
                "chunks": chunks_count,
                "message": f"PDF processed successfully"
            }
            
        except Exception as e:
            return {
                "success": False,
                "filename": filename,
                "error": str(e),
                "message": "Failed to process PDF"
            }
    
    def add_to_existing(self, file_path: str, filename: str) -> Dict[str, Any]:
        """Existing vector store mein naya PDF add karna (multi-PDF support)"""
        documents = self.pdf_loader.load_pdf(file_path)
        chunks = self.text_splitter.split_documents(documents)
        
        for chunk in chunks:
            chunk.metadata["pdf_name"] = filename.strip()
        
        self.vector_store.add_documents(chunks)
        
        print(f"✅ Added {len(chunks)} chunks to existing store for: {filename}")
        
        return {
            "success": True,
            "filename": filename,
            "chunks_added": len(chunks),
            "message": f"PDF added to existing store"
        }
    
    def reset_and_process(self, file_path: str, filename: str) -> Dict[str, Any]:
        """Delete old store and process new PDF"""
        self.vector_store.delete_vector_store()
        return self.process_pdf(file_path, filename)