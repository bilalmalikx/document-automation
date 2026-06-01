from typing import List
from sentence_transformers import SentenceTransformer

class EmbeddingsComponent:
    def __init__(self):
        # Load sentence transformer model
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.dimension = 384
    
    def embed_query(self, text: str) -> List[float]:
        """Generate embedding for a single query"""
        embedding = self.model.encode(text, normalize_embeddings=True)
        return embedding.tolist()
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple documents"""
        embeddings = self.model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()
    
    def get_embeddings(self):
        """Return self for LangChain compatibility"""
        return self
    
    def __call__(self, texts):
        """Make component callable"""
        if isinstance(texts, str):
            return self.embed_query(texts)
        return self.embed_documents(texts)