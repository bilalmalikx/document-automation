from app.components.vector_store import VectorStoreComponent
from app.components.llm import LLMComponent
from app.services.memory_service import ConversationMemory
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)

class QAService:
    def __init__(self):
        self.vector_store = VectorStoreComponent()
        self.llm = LLMComponent()
        self.memory = ConversationMemory(max_history=5)
        self.vector_store.load_vector_store()
    
    def answer_question(self, question: str, pdf_name: str = None, pdf_names: List[str] = None, session_id: str = "default") -> Dict[str, Any]:
        """Complete QA pipeline with memory and multi-PDF support"""
        try:
            print(f"\n{'='*60}")
            print(f"📝 QUESTION: {question}")
            print(f"📁 SELECTED PDFS: {pdf_names or pdf_name}")
            print(f"{'='*60}")
            
            # Step 1: Get chunks from vector store
            from app.services.retrieval_service import RetrievalService
            retrieval_service = RetrievalService()
            chunks = retrieval_service.retrieve_relevant_chunks(question, pdf_name, pdf_names)
            
            print(f"\n📚 RETRIEVED {len(chunks)} CHUNKS")
            
            if not chunks:
                return {
                    "success": True,
                    "answer": "No relevant information found in the selected document(s). Please try a different question.",
                    "sources": [],
                    "confidence": 0.0
                }
            
            # Print first chunk for debugging
            if chunks:
                print(f"\n📄 FIRST CHUNK (first 200 chars):")
                print(f"   {chunks[0]['content'][:200]}...")
                print(f"   Metadata: {chunks[0]['metadata']}")
            
            # Step 2: Format context - combine all chunks
            context_parts = []
            for i, chunk in enumerate(chunks[:6], 1):  # Use up to 6 chunks
                content = chunk["content"]
                source = chunk["metadata"].get("pdf_name", "unknown")
                if not source:
                    source = chunk["metadata"].get("source", "unknown")
                context_parts.append(f"[Document: {source}]\n{content}")
            
            context = "\n\n---\n\n".join(context_parts)
            
            print(f"\n📄 TOTAL CONTEXT LENGTH: {len(context)} characters")
            print(f"📄 NUMBER OF CHUNKS: {len(context_parts)}")
            
            # Step 3: Generate answer
            answer = self.llm.generate_with_context(question, context)
            
            # Step 4: Extract sources
            sources = []
            for chunk in chunks[:3]:
                sources.append({
                    "content": chunk["content"][:300] + "..." if len(chunk["content"]) > 300 else chunk["content"],
                    "pdf_name": chunk["metadata"].get("pdf_name", "unknown"),
                    "page": chunk["metadata"].get("page", 0)
                })
            
            # Step 5: Calculate confidence
            confidence = 0.8 if chunks and answer and "cannot find" not in answer.lower() else 0.5
            
            print(f"\n🎯 CONFIDENCE: {confidence}")
            print(f"💡 ANSWER: {answer[:200]}...")
            print(f"{'='*60}\n")
            
            return {
                "success": True,
                "answer": answer,
                "sources": sources,
                "confidence": confidence,
                "session_id": session_id
            }
            
        except Exception as e:
            print(f"❌ QA Service Error: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "answer": f"Error generating answer: {str(e)}",
                "sources": [],
                "confidence": 0.0
            }