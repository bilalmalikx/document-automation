from app.services.retrieval_service import RetrievalService
from app.components.llm import LLMComponent
from app.services.memory_service import ConversationMemory
from typing import Dict, Any, Optional, List

class QAService:
    def __init__(self):
        self.retrieval_service = RetrievalService()
        self.llm_component = LLMComponent()
        self.memory = ConversationMemory(max_history=5)
    
    def answer_question(self, question: str, pdf_name: str = None, pdf_names: List[str] = None, session_id: str = "default") -> Dict[str, Any]:
        """
        Complete QA pipeline with memory and multi-PDF support
        """
        try:
            # Step 1: Get conversation history
            history_context = self.memory.get_context(session_id)
            
            # Step 2: Retrieve chunks from specific PDF(s)
            chunks = self.retrieval_service.retrieve_relevant_chunks(question, pdf_name, pdf_names)
            
            if not chunks:
                return {
                    "success": True,
                    "answer": "No relevant information found in the selected document(s).",
                    "sources": [],
                    "confidence": 0.0
                }
            
            # Step 3: Format context
            context = self.retrieval_service.format_context(chunks)
            
            # Step 4: Build prompt with history
            full_context = ""
            if history_context:
                full_context += f"{history_context}\n\n"
            full_context += f"Document Context:\n{context}"
            
            # Step 5: Generate answer
            answer = self.llm_component.generate_with_context(question, full_context)
            
            # Step 6: Extract sources for citation
            sources = []
            for chunk in chunks[:2]:
                source_info = {
                    "content": chunk["content"][:200] + "...",
                    "pdf_name": chunk["metadata"].get("pdf_name", "unknown"),
                    "page": chunk["metadata"].get("page", 0)
                }
                sources.append(source_info)
            
            # Step 7: Save to memory
            self.memory.add_exchange(question, answer, session_id)
            
            return {
                "success": True,
                "answer": answer,
                "sources": sources,
                "confidence": 0.8 if chunks else 0.0,
                "session_id": session_id
            }
            
        except Exception as e:
            return {
                "success": False,
                "answer": f"Error generating answer: {str(e)}",
                "sources": [],
                "confidence": 0.0
            }
    
    def clear_memory(self, session_id: str = "default"):
        """Clear conversation memory for a session"""
        self.memory.clear_session(session_id)