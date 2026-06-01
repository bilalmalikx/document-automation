from langchain_community.vectorstores import Chroma
from typing import List
from app.utils.config import config
from app.components.embeddings import EmbeddingsComponent
import os
import shutil
import json

class VectorStoreComponent:
    def __init__(self):
        self.embeddings_component = EmbeddingsComponent()
        self.persist_directory = config.VECTOR_STORE_PATH
        self.vector_store = None

        self.meta_file = os.path.join(self.persist_directory, "meta.json")

        # Ensure directory exists
        os.makedirs(self.persist_directory, exist_ok=True)

        # Auto-check embedding dimension
        self._check_and_reset_if_needed()

    def _get_embedding_function(self):
        """Return embedding function for LangChain Chroma"""
        # Create a wrapper for LangChain compatibility
        class EmbeddingFunction:
            def __init__(self, component):
                self.component = component
            
            def embed_documents(self, texts):
                return self.component.embed_documents(texts)
            
            def embed_query(self, text):
                return self.component.embed_query(text)
        
        return EmbeddingFunction(self.embeddings_component)

    def _check_and_reset_if_needed(self):
        current_dim = self.embeddings_component.dimension

        if os.path.exists(self.meta_file):
            try:
                with open(self.meta_file, "r") as f:
                    data = json.load(f)
                    saved_dim = data.get("dimension")

                if saved_dim != current_dim:
                    print("⚠️ Embedding dimension changed → resetting vector DB")
                    self.delete_vector_store()
            except Exception:
                self.delete_vector_store()

        # Save current dimension
        with open(self.meta_file, "w") as f:
            json.dump({"dimension": current_dim}, f)

    def create_vector_store(self, documents: List):
        """Create vector store from documents"""
        embedding_func = self._get_embedding_function()
        
        self.vector_store = Chroma.from_documents(
            documents=documents,
            embedding=embedding_func,
            persist_directory=self.persist_directory
        )
        self.vector_store.persist()
        return self.vector_store

    def load_vector_store(self):
        """Load existing vector store"""
        if os.path.exists(self.persist_directory) and os.listdir(self.persist_directory):
            embedding_func = self._get_embedding_function()
            
            self.vector_store = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=embedding_func
            )
        return self.vector_store

    def add_documents(self, documents: List):
        """Add new documents to existing store"""
        if self.vector_store is None:
            self.create_vector_store(documents)
        else:
            self.vector_store.add_documents(documents)
            self.vector_store.persist()

    def similarity_search(self, query: str, pdf_name: str = None, k: int = 3) -> List:
        if self.vector_store is None:
            self.load_vector_store()
    
        if self.vector_store is None:
            return []
    
        try:
            if pdf_name:
                results = self.vector_store.similarity_search(
                    query, 
                    k=k,
                    filter={"pdf_name": pdf_name}
                )
            else:
                results = self.vector_store.similarity_search(query, k=k)
            return results
        except Exception as e:
        # If error, try reloading in read-only mode
            print(f"Search error: {e}")
            return []

    def delete_vector_store(self):
        """Delete entire vector store"""
        if os.path.exists(self.persist_directory):
            shutil.rmtree(self.persist_directory)

        os.makedirs(self.persist_directory, exist_ok=True)
        self.vector_store = None