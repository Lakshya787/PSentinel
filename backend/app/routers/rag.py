"""
app/routers/rag.py
─────────────────────────────────────────────────────────────────────────────
Pashu Sentinel — RAG API Router

Endpoints:
  POST /rag/chat         — Submit a question and get a RAG-generated answer
  GET  /rag/health       — RAG system health / status check
  POST /rag/seed         — (Admin) Re-seed the knowledge base
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.middleware.auth import get_current_user, get_current_user_optional
from app.models.user import User

logger = logging.getLogger("pashu.rag.router")

router = APIRouter(prefix="/rag", tags=["RAG Veterinary Knowledge"])


# ─── Request / Response Schemas ───────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'model'")
    content: str = Field(..., description="Message text")


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=1000, description="User's question")
    history: Optional[list[ChatMessage]] = Field(
        default=None,
        description="Previous conversation messages for multi-turn context",
    )


class SourceDoc(BaseModel):
    id: str
    title: str
    category: str
    score: float


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceDoc]
    fallback: bool


class SeedResponse(BaseModel):
    documents_indexed: int
    message: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Ask the Veterinary Knowledge Assistant",
    description=(
        "Submit a livestock health question. The system retrieves the most relevant "
        "ICAR-NIVEDI/DAHD knowledge documents and generates a safe, grounded answer "
        "using Gemini 1.5 Flash. Prescription drugs are never recommended directly."
    ),
)
async def rag_chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """RAG-powered veterinary Q&A endpoint."""
    from app.services.rag_service import answer_query

    # Convert history format for Gemini SDK
    history = None
    if request.history:
        history = [
            {"role": msg.role, "parts": [msg.content]}
            for msg in request.history
        ]

    try:
        result = answer_query(query=request.query, chat_history=history)
    except Exception as exc:
        logger.error(f"RAG chat error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Knowledge assistant error: {str(exc)}",
        )

    return ChatResponse(
        answer=result["answer"],
        sources=[SourceDoc(**s) for s in result["sources"]],
        fallback=result["fallback"],
    )


@router.get(
    "/health",
    summary="RAG System Health Check",
)
async def rag_health_check():
    """Check the status of the RAG vector store and Gemini configuration."""
    from app.services.rag_service import rag_health
    return rag_health()


@router.post(
    "/seed",
    response_model=SeedResponse,
    summary="(Admin) Seed / Re-seed the Knowledge Base",
    description="Embeds all veterinary knowledge documents into ChromaDB. Safe to call multiple times.",
)
async def seed_knowledge(
    force: bool = False,
    current_user: User = Depends(get_current_user),
):
    """Seed the veterinary knowledge base. Set force=true to re-embed all documents."""
    # Only VET / DVO roles can trigger a re-seed
    if current_user.role not in ("VET", "DVO") and force:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only VET or DVO users can force re-seed the knowledge base.",
        )

    from app.services.rag_service import seed_knowledge_base

    try:
        count = seed_knowledge_base(force=force)
    except Exception as exc:
        logger.error(f"Knowledge base seeding error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Seeding error: {str(exc)}",
        )

    return SeedResponse(
        documents_indexed=count,
        message=(
            f"Successfully indexed {count} veterinary knowledge documents."
            if count > 0
            else "Knowledge base was already up to date or Gemini API key is not configured."
        ),
    )
