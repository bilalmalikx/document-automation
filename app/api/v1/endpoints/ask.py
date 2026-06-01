from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from app.services.qa_service import QAService
from app.services.guardrails_service import GuardrailsService
from app.models.schemas import QuestionRequest, AnswerResponse, ErrorResponse

router = APIRouter()
qa_service = QAService()
guardrails_service = GuardrailsService()

@router.post("/ask", response_model=AnswerResponse)
async def ask_question(request: QuestionRequest):
    """
    Angular se question receive karta hai
    Supports both single PDF (pdf_name) and multiple PDFs (pdf_names)
    """
    try:
        if not request.question or len(request.question.strip()) == 0:
            raise HTTPException(status_code=400, detail="Question cannot be empty")
        
        # ✅ NO VALIDATION - User can ask without selecting any document
        # If no document selected, backend will search ALL documents
        
        # Get session_id from request
        session_id = getattr(request, 'session_id', 'default')
        
        # Priority: pdf_names (multiple) > pdf_name (single)
        if request.pdf_names and len(request.pdf_names) > 0:
            result = qa_service.answer_question(
                question=request.question,
                pdf_names=request.pdf_names,
                session_id=session_id
            )
        else:
            result = qa_service.answer_question(
                question=request.question,
                pdf_name=request.pdf_name,
                session_id=session_id
            )
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["answer"])
        
        # Apply guardrails validation
        context = " ".join([s.get("content", "") for s in result.get("sources", [])])
        is_valid, validated_answer = guardrails_service.validate_answer(
            result["answer"],
            context
        )
        
        if not is_valid:
            validated_answer = result["answer"]
        
        final_answer = guardrails_service.sanitize_answer(validated_answer)
        
        return AnswerResponse(
            question=request.question,
            answer=final_answer,
            source_chunks=[s["content"] for s in result.get("sources", [])[:2]] if result.get("sources") else [],
            confidence=result.get("confidence", 0.5)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error="Question processing failed",
                details=str(e)
            ).dict()
        )

@router.post("/clear-memory")
async def clear_memory(session_id: str = "default"):
    """Clear conversation memory for a session"""
    qa_service.clear_memory(session_id)
    return {"status": "memory cleared", "session_id": session_id}

@router.get("/health")
async def ask_health():
    return {"status": "qa_service_ok"}