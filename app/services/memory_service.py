from typing import Dict, List
from collections import deque

class ConversationMemory:
    def __init__(self, max_history: int = 5):
        self.max_history = max_history
        self.sessions: Dict[str, deque] = {}
    
    def get_session(self, session_id: str = "default"):
        if session_id not in self.sessions:
            self.sessions[session_id] = deque(maxlen=self.max_history)
        return self.sessions[session_id]
    
    def add_exchange(self, question: str, answer: str, session_id: str = "default"):
        session = self.get_session(session_id)
        session.append({"question": question, "answer": answer})
    
    def get_context(self, session_id: str = "default") -> str:
        session = self.get_session(session_id)
        if not session:
            return ""
        
        context = "Previous conversation:\n"
        for i, exchange in enumerate(session, 1):
            context += f"{i}. Q: {exchange['question']}\n   A: {exchange['answer']}\n"
        return context
    
    def clear_session(self, session_id: str = "default"):
        if session_id in self.sessions:
            del self.sessions[session_id]