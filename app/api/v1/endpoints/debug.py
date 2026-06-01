from fastapi import APIRouter
from app.components.vector_store import VectorStoreComponent

router = APIRouter()

@router.get("/debug/chunks")
async def get_all_chunks():
    """See all chunks stored in vector DB"""
    vector_store = VectorStoreComponent()
    vector_store.load_vector_store()
    
    if not vector_store.vector_store:
        return {"error": "No vector store found"}
    
    # Chroma internal access (hack for debugging)
    chunks = []
    for doc in vector_store.vector_store.get():
        chunks.append({
            "content": doc.page_content[:200],
            "metadata": doc.metadata
        })
    
    return {"total_chunks": len(chunks), "chunks": chunks}