import ollama
from typing import List, Dict, Any
from app.utils.config import config

class LLMComponent:
    def __init__(self):
        self.model = config.LLM_MODEL
        self.base_url = config.OLLAMA_BASE_URL
        self.temperature = 0.0
        self.max_tokens = config.LLM_MAX_TOKENS
        
        self._check_model_availability()
    
    def _check_model_availability(self):
        """Check if Ollama is running and model is installed"""
        try:
            models = ollama.list()
            model_names = [m['model'] for m in models.get('models', [])]
            
            if self.model not in model_names:
                print(f"⚠️ Warning: Model '{self.model}' not found in Ollama")
                print(f"Available models: {model_names}")
                print(f"Run: ollama pull {self.model}")
        except Exception as e:
            print(f"⚠️ Could not connect to Ollama: {e}")
            print("Make sure Ollama is running: ollama serve")
    
    def generate_response(self, prompt: str) -> str:
        """Generate simple response from prompt"""
        try:
            response = ollama.chat(
                model=self.model,
                messages=[{'role': 'user', 'content': prompt}],
                options={
                    'temperature': 0.1,
                    'num_predict': self.max_tokens
                }
            )
            return response['message']['content']
        except Exception as e:
            return f"Error generating response: {str(e)}"
    
    def generate_with_context(self, question: str, context: str) -> str:
        """Generate response using context (RAG) - NO HALLUCINATION"""
        
        system_prompt = """You are a strict document assistant. Follow these rules:

1. ONLY answer using information from the context below.
2. If the context does NOT contain the answer, say exactly: "I cannot find this information in the document."
3. DO NOT add any information, numbers, or facts that are not in the context.
4. DO NOT say "based on the context" or "according to the document" - just state the answer.
5. DO NOT make up calculations - if numbers are not in context, don't calculate.
6. Be concise and direct.

This is very important: NEVER INVENT INFORMATION."""
        
        user_prompt = f"""CONTEXT (use only this):
{context}

QUESTION: {question}

ANSWER (if not in context, say "I cannot find this information in the document"):"""
        
        try:
            messages = [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ]
            
            response = ollama.chat(
                model=self.model,
                messages=messages,
                options={
                    'temperature': 0.1,  # ✅ Very low - no creativity
                    'num_predict': self.max_tokens,
                    'repeat_penalty': 1.1
                }
            )
            return response['message']['content']
        except Exception as e:
            return f"Error: {str(e)}. Make sure Ollama is running with 'ollama serve'"
    
    def get_llm_instance(self):
        """Return self for compatibility"""
        return self