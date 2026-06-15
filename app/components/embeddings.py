from typing import List
import numpy as np
import hashlib

class EmbeddingsComponent:
    """
    Simple deterministic embeddings - No external dependencies
    Uses character-based hashing for consistent embeddings
    """
    def __init__(self):
        self.dimension = 384
    
    def embed_query(self, text: str) -> List[float]:
        """Generate embedding for a single query"""
        return self._compute_embedding(text)
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple documents"""
        embeddings = []
        for text in texts:
            embeddings.append(self._compute_embedding(text))
        return embeddings
    
    def _compute_embedding(self, text: str) -> List[float]:
        """Compute deterministic embedding using character codes"""
        embedding = np.zeros(self.dimension)
        
        # Use character codes to create embedding
        chars = text[:2000]  # Limit length for performance
        
        for i, char in enumerate(chars):
            idx = i % self.dimension
            embedding[idx] += ord(char) / 255.0
        
        # Add position information
        for i in range(min(len(chars), self.dimension)):
            embedding[i] += (i / self.dimension) * 0.1
        
        # Normalize
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        
        return embedding.tolist()
    
    def get_embeddings(self):
        """Return self for LangChain compatibility"""
        return self
    
    def __call__(self, texts):
        """Make component callable"""
        if isinstance(texts, str):
            return self.embed_query(texts)
        return self.embed_documents(texts)