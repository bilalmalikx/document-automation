from app.components.vector_store import VectorStoreComponent
from typing import List, Dict, Any
from app.utils.config import config

class RetrievalService:
    def __init__(self):
        self.vector_store = VectorStoreComponent()
        self.top_k = config.TOP_K_RESULTS
    
    def retrieve_relevant_chunks(self, question: str, pdf_name: str = None, pdf_names: List[str] = None) -> List[Dict[str, Any]]:
        # Load vector store agar load nahi hai
        if self.vector_store.vector_store is None:
            self.vector_store.load_vector_store()
        
        # Get more chunks initially for better filtering
        if (pdf_names and len(pdf_names) > 0) or pdf_name:
            search_k = self.top_k * 3  # For filtered search, get more
        else:
            search_k = self.top_k  # For all documents search
        
        # Get chunks
        all_docs = self.vector_store.similarity_search(question, k=search_k)
        
        # Format results with metadata
        all_formatted = []
        for doc in all_docs:
            all_formatted.append({
                "content": doc.page_content,
                "metadata": doc.metadata,
                "score": None
            })
        
        # Debug print
        print(f"🔍 Total chunks retrieved: {len(all_formatted)}")
        
        # ✅ FILTER: Sirf selected PDFs ke chunks rakho (if selected)
        if pdf_names and len(pdf_names) > 0:
            filtered = []
            selected_clean = [name.strip() for name in pdf_names]
            
            for chunk in all_formatted:
                doc_pdf_name = chunk["metadata"].get("pdf_name", "").strip()
                if doc_pdf_name in selected_clean:
                    filtered.append(chunk)
            
            formatted_results = filtered[:self.top_k]
            print(f"📄 After filter ({selected_clean}): {len(filtered)} chunks found")
        
        elif pdf_name:
            filtered = []
            target_name = pdf_name.strip()
            for chunk in all_formatted:
                doc_pdf_name = chunk["metadata"].get("pdf_name", "").strip()
                if doc_pdf_name == target_name:
                    filtered.append(chunk)
            formatted_results = filtered[:self.top_k]
            print(f"📄 After filter ({target_name}): {len(filtered)} chunks found")
        
        else:
            # ✅ NO FILTER - return all chunks (search ALL documents)
            formatted_results = all_formatted[:self.top_k]
            print(f"📄 No filter - searching ALL documents: {len(formatted_results)} chunks found")
        
        return formatted_results
    
    def format_context(self, chunks: List[Dict[str, Any]]) -> str:
        """Multiple chunks ko ek single context string mein convert karta hai"""
        if not chunks:
            return ""
        
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            source = chunk["metadata"].get("pdf_name", "unknown")
            context_parts.append(f"[Source: {source}]\n{chunk['content']}\n")
        
        return "\n---\n".join(context_parts)
    
    def get_chunks_with_page_numbers(self, question: str) -> List[Dict[str, Any]]:
        """Page numbers ke saath chunks return karta hai (citation ke liye)"""
        results = self.retrieve_relevant_chunks(question)
        
        for result in results:
            page = result["metadata"].get("page", 0)
            result["page_number"] = page + 1 if isinstance(page, int) else 0
        
        return results