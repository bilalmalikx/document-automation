import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Local LLM Configuration (Ollama)
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    LLM_MODEL = os.getenv("LLM_MODEL", "llama3.2:3b")  # Ollama model
    LLM_TEMPERATURE = 0.0  # ✅ Very low for factual answers
    
    # Local Embeddings Configuration
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")  # Sentence transformer
    EMBEDDING_DIMENSION = 384  # For all-MiniLM-L6-v2 (change if using different model)
    
    # PDF Processing
    CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 1000))
    CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 200))
    
    # Paths
    VECTOR_STORE_PATH = os.getenv("VECTOR_STORE_PATH", "data/vector_store")
    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "data/uploads")
    
    # Retrieval
    TOP_K_RESULTS = 8
    
    # LLM Parameters
    LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", 0.0))
    LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", 2048))

config = Config()