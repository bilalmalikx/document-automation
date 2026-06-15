from app.components.pdf_loader import PDFLoaderComponent
from app.components.text_splitter import TextSplitterComponent
from app.components.vector_store import VectorStoreComponent
from typing import Dict, Any
import os
import json
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
        3. Generate embeddings
        4. Store in vector DB
        """
        try:
            print(f"📄 Processing PDF: {filename}")
            
            # Step 1: Load PDF pages
            documents = self.pdf_loader.load_pdf(file_path)
            pages_count = len(documents)
            print(f"📄 Loaded {pages_count} pages")
            
            # Step 2: Split into chunks
            chunks = self.text_splitter.split_documents(documents)
            chunks_count = len(chunks)
            print(f"✂️ Split into {chunks_count} chunks")
            
            # Step 3: Add metadata (filename)
            for chunk in chunks:
                chunk.metadata["pdf_name"] = filename.strip()
                chunk.metadata["source"] = filename.strip()
            
            # Step 4: Check if vector store exists and add documents
            # Try to load existing store first
            existing_store = self.vector_store.load_vector_store()
            
            if existing_store and self.vector_store.collection and self.vector_store.collection.count() > 0:
                # Add to existing store
                print(f"➕ Adding to existing vector store")
                success = self.vector_store.add_documents(chunks)
            else:
                # Create new store
                print(f"🆕 Creating new vector store")
                success = self.vector_store.create_vector_store(chunks)
            
            if not success:
                raise Exception("Failed to store documents in vector store")
            
            # Step 5: Save document metadata
            self._save_document_metadata(filename, pages_count, chunks_count)
            
            # Step 6: Verify storage
            if self.vector_store.collection:
                total_docs = self.vector_store.collection.count()
                print(f"✅ Vector store now has {total_docs} total chunks")
            
            return {
                "success": True,
                "filename": filename,
                "pages": pages_count,
                "chunks": chunks_count,
                "message": f"PDF processed successfully: {chunks_count} chunks stored"
            }
            
        except Exception as e:
            print(f"❌ Processing error: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "filename": filename,
                "error": str(e),
                "message": "Failed to process PDF"
            }
    
    def _save_document_metadata(self, filename: str, pages: int, chunks: int):
        """Save document metadata for tracking"""
        documents_file = os.path.join(config.VECTOR_STORE_PATH, "documents.json")
        
        try:
            if os.path.exists(documents_file):
                with open(documents_file, 'r') as f:
                    data = json.load(f)
                    documents = data.get("documents", [])
            else:
                documents = []
            
            # Check if already exists
            existing = next((d for d in documents if d["name"] == filename), None)
            if not existing:
                documents.append({
                    "name": filename,
                    "pages": pages,
                    "chunks": chunks,
                    "uploaded_at": str(__import__('datetime').datetime.now())
                })
            
            with open(documents_file, 'w') as f:
                json.dump({"documents": documents}, f, indent=2)
                
        except Exception as e:
            print(f"⚠️ Failed to save metadata: {e}")
    
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