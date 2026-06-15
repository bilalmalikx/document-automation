from openai import OpenAI
from app.config import settings
from typing import List, Dict, Any
import json
import logging

logger = logging.getLogger(__name__)

class LLMComponent:
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url
        )
        self.model = settings.openai_model
        self.temperature = settings.openai_temperature
        self.max_tokens = 500
        print(f"✅ LLM Component initialized with model: {self.model}")
    
    def generate_with_context(self, question: str, context: str) -> str:
        """Generate response using context (RAG)"""
        
        # Debug prints
        print(f"\n🔍 LLM Debug:")
        print(f"  - Question: {question}")
        print(f"  - Context length: {len(context)} characters")
        
        # If context is empty or too short
        if not context or len(context) < 100:
            print("⚠️ Context is empty or too short!")
            return "I cannot find enough information in the document to answer this question. Please make sure the document contains relevant information."
        
        # Print first 300 chars of context
        print(f"  - Context preview: {context[:300]}...")
        
        system_prompt = """You are a strict document assistant. Follow these rules:

1. ONLY answer using information from the context below.
2. If the context does NOT contain the answer, say exactly: "I cannot find this information in the document."
3. DO NOT add any information not in the context.
4. Be concise and direct.
5. If you find the answer, state it clearly.

Never invent information."""
        
        user_prompt = f"""CONTEXT (use only this information):
{context}

QUESTION: {question}

Based ONLY on the context above, answer the question:"""
        
        try:
            messages = [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ]
            
            print(f"🚀 Calling Groq API...")
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.1,
                max_tokens=self.max_tokens
            )
            
            answer = response.choices[0].message.content
            print(f"✅ Groq response: {answer[:200]}...")
            return answer
            
        except Exception as e:
            print(f"❌ Groq API Error: {e}")
            return f"Error generating answer: {str(e)}"