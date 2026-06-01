from typing import Dict, Any, Tuple
import re

class GuardrailsService:
    def __init__(self):
        self.fallback_phrases = [
            "i don't know",
            "i don't have enough information",
            "cannot answer",
            "not in the context",
            "not in the document",
            "based on the provided context"  # ✅ Be careful with this
        ]
    
    def validate_answer(self, answer: str, context: str) -> Tuple[bool, str]:
        """
        Check if answer is grounded in context
        Returns: (is_valid, validated_answer)
        """
        answer_lower = answer.lower()
        
        # Check for fallback phrases
        for phrase in self.fallback_phrases:
            if phrase in answer_lower:
                return True, answer
        
        # ✅ HALLUCINATION DETECTION
        # Check if answer claims specific numbers not in context
        numbers_in_answer = re.findall(r'\$[\d,]+|\b\d{3,}\b', answer)
        numbers_in_context = re.findall(r'\$[\d,]+|\b\d{3,}\b', context)
        
        hallucinated_numbers = []
        for num in numbers_in_answer:
            if num not in numbers_in_context and len(num) > 3:
                hallucinated_numbers.append(num)
        
        if hallucinated_numbers:
            return False, f"I cannot provide accurate numbers. The document does not contain: {', '.join(hallucinated_numbers)}"
        
        # ✅ Check if answer is too specific without context support
        answer_words = set(answer_lower.split())
        context_words = set(context.lower().split())
        
        # If less than 20% of answer words are from context, likely hallucination
        if len(answer_words) > 10:
            overlap = answer_words.intersection(context_words)
            coverage = len(overlap) / len(answer_words)
            if coverage < 0.2:
                return False, "I cannot provide an accurate answer based on the document content."
        
        return True, answer
    
    def sanitize_answer(self, answer: str) -> str:
        """Remove unwanted content"""
        answer = re.sub(r'\n{3,}', '\n\n', answer)
        answer = re.sub(r'I (think|believe|feel) that\s+', '', answer, flags=re.IGNORECASE)
        return answer.strip()
    
    def check_hallucination(self, answer: str, chunks: list) -> Dict[str, Any]:
        """Advanced hallucination check"""
        if not chunks:
            return {"hallucination_score": 1.0, "is_hallucinated": True, "message": "No context available"}
        
        all_context = " ".join([chunk.get("content", "") for chunk in chunks])
        
        # Check for invented numbers
        numbers_in_answer = re.findall(r'\$[\d,]+|\b\d{3,}\b', answer)
        numbers_in_context = re.findall(r'\$[\d,]+|\b\d{3,}\b', all_context)
        
        for num in numbers_in_answer:
            if num not in numbers_in_context:
                return {
                    "hallucination_score": 0.8,
                    "is_hallucinated": True,
                    "message": f"Found number {num} in answer but not in document"
                }
        
        return {
            "hallucination_score": 0.1,
            "is_hallucinated": False,
            "message": "Answer appears grounded in context"
        }