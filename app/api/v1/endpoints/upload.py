from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from app.services.ingestion_service import IngestionService
from app.models.schemas import PDFUploadResponse, ErrorResponse
import os
import shutil
from app.utils.config import config
import uuid

router = APIRouter()
ingestion_service = IngestionService()

@router.post("/upload", response_model=PDFUploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    """
    Angular se PDF file receive karta hai
    Process karta hai aur vector store mein save karta hai
    """
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed"
        )
    
    # Create unique filename to avoid conflicts
    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(config.UPLOAD_DIR, unique_filename)
    
    # Ensure upload directory exists
    os.makedirs(config.UPLOAD_DIR, exist_ok=True)
    
    try:
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"📁 File saved: {file_path}")
        
        # Process PDF (ingestion)
        result = ingestion_service.process_pdf(file_path, file.filename)
        
        print(f"✅ Processing result: {result}")
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result.get("error", "Processing failed"))
        
        # Clean up temp file after processing
        if os.path.exists(file_path):
            os.remove(file_path)
        
        return PDFUploadResponse(
            message=result["message"],
            filename=file.filename,
            pages=result.get("pages", 0),
            chunks=result.get("chunks", 0)
        )
        
    except Exception as e:
        print(f"❌ Upload error: {str(e)}")
        # Clean up on error
        if os.path.exists(file_path):
            os.remove(file_path)
        
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error="Processing failed",
                details=str(e)
            ).dict()
        )

@router.get("/health")
async def upload_health():
    """Check if upload service is working"""
    return {"status": "upload_service_ok"}

@router.get("/documents")
async def get_documents():
    """Get list of all uploaded PDF names from vector store metadata"""
    try:
        from app.components.vector_store import VectorStoreComponent
        vector_store = VectorStoreComponent()
        
        if not vector_store.load_vector_store():
            return {"documents": []}
        
        if vector_store.collection is None:
            return {"documents": []}
        
        # Get all unique PDF names from collection
        # ChromaDB doesn't have a direct way to get all distinct metadata values
        # So we'll store a separate list in a JSON file
        documents_file = os.path.join(config.VECTOR_STORE_PATH, "documents.json")
        
        if os.path.exists(documents_file):
            import json
            with open(documents_file, 'r') as f:
                return json.load(f)
        
        return {"documents": []}
        
    except Exception as e:
        print(f"Error getting documents: {e}")
        return {"documents": [], "error": str(e)}