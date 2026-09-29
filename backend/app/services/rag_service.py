"""
app/services/rag_service.py
─────────────────────────────────────────────────────────────────────────────
Pashu Sentinel — RAG-Based Veterinary Knowledge System

Architecture:
  • Vector store  : ChromaDB (local, persistent on disk)
  • Embeddings    : Local ONNX all-MiniLM-L6-v2 (fast, reliable, zero API costs)
  • Generation    : Google Gemini (with robust ICAR/DAHD knowledge base fallback)
  • Retrieval     : Cosine similarity top-k (ChromaDB native)
  • Safety guards : Strict guardrails — never prescribe Schedule H drugs; BVO escalation

Environment variables:
  GEMINI_API_KEY=<your-google-ai-studio-key>
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

logger = logging.getLogger("pashu.rag")

# ─── Lazy-initialised singletons ─────────────────────────────────────────────
_chroma_client: Optional[chromadb.PersistentClient] = None
_collection = None
_gemini_configured = False

# Persist the vector store next to the SQLite DB
_CHROMA_PATH = str(Path(__file__).resolve().parents[2] / "chroma_db")
_COLLECTION_NAME = "vet_knowledge"

# Candidate Gemini models in priority order
_GEMINI_CANDIDATE_MODELS = [
    "models/gemini-2.5-flash",
    "models/gemini-3.8-flash",
    "models/gemini-flash-latest",
]

# ─── SYSTEM PROMPT (safety guardrails) ───────────────────────────────────────
_SYSTEM_PROMPT = """
You are VetAssist, an AI livestock health advisor for the Pashu Sentinel platform.
Your role is to help Indian farmers, para-veterinary workers, and field staff understand
livestock diseases, first-aid, biosecurity procedures, and vaccination protocols.

STRICT RULES — YOU MUST ALWAYS FOLLOW THESE:
1. NEVER prescribe or recommend Schedule H antibiotics, prescription drugs, or any
   medication that requires a veterinarian's prescription (e.g., oxytetracycline,
   penicillin, sulphonamides, steroids). You may describe that such treatments EXIST
   but you must direct users to the veterinarian for prescriptions.
2. ALWAYS end your response with the disclaimer:
   "⚕️ For formal clinical diagnosis and prescription treatment, please consult your
   Block Veterinary Officer (BVO). You can also report this case in Pashu Sentinel
   to automatically alert the nearest available veterinarian."
3. Prioritize ICAR-NIVEDI guidelines, DAHD protocols, and NDDB EVM formulations.
4. Use simple, clear language suitable for rural farmers. Avoid complex medical jargon.
5. If the query is about a potential zoonotic emergency (Anthrax, Brucellosis, Rabies,
   suspected Avian Influenza), immediately flag the human health risk and recommend
   contacting the district IDSP in addition to the BVO.
6. Answer ONLY questions related to livestock health, animal disease, veterinary
   first-aid, biosecurity, and animal husbandry. For other topics, politely redirect.

Use ONLY the provided context documents to form your answer. If the answer is not in
the context, say so honestly and direct the user to their nearest BVO.
"""


def _get_chroma() -> tuple:
    """Lazy-init ChromaDB client and collection."""
    global _chroma_client, _collection
    if _chroma_client is None:
        logger.info(f"Initialising ChromaDB at: {_CHROMA_PATH}")
        _chroma_client = chromadb.PersistentClient(
            path=_CHROMA_PATH,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    if _collection is None:
        _collection = _chroma_client.get_or_create_collection(
            name=_COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _chroma_client, _collection


def _configure_gemini() -> bool:
    """Configure Gemini API. Returns True if configured successfully."""
    global _gemini_configured
    if _gemini_configured:
        return True
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — RAG will operate with direct knowledge-retrieval synthesis.")
        return False
    try:
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=api_key)
        _gemini_configured = True
        logger.info("Gemini API configured successfully.")
        return True
    except Exception as exc:
        logger.error(f"Failed to configure Gemini: {exc}")
        return False


# ─── KNOWLEDGE BASE SEEDING ───────────────────────────────────────────────────

def seed_knowledge_base(force: bool = False) -> int:
    """
    Embed and store all VET_KNOWLEDGE_DOCS into ChromaDB using local vector embeddings.

    Args:
        force: If True, drops and re-creates the collection before seeding.
    Returns:
        Number of documents embedded.
    """
    from app.services.rag_knowledge import VET_KNOWLEDGE_DOCS

    _, collection = _get_chroma()

    # If already seeded and not forced, return count
    if not force and collection.count() >= len(VET_KNOWLEDGE_DOCS):
        logger.info(f"Knowledge base already seeded with {collection.count()} docs — skipping.")
        return collection.count()

    if force:
        logger.info("Force re-seeding — resetting existing collection.")
        try:
            _chroma_client.delete_collection(_COLLECTION_NAME)
        except Exception:
            pass
        global _collection
        _collection = _chroma_client.get_or_create_collection(
            name=_COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        _, collection = _get_chroma()

    ids = [doc["id"] for doc in VET_KNOWLEDGE_DOCS]
    documents = [f"{doc['title']}\n\n{doc['text']}" for doc in VET_KNOWLEDGE_DOCS]
    metadatas = [
        {
            "title": doc["title"],
            "category": doc["category"],
            "language": doc["language"],
            "doc_id": doc["id"],
        }
        for doc in VET_KNOWLEDGE_DOCS
    ]

    logger.info(f"Embedding {len(documents)} veterinary knowledge documents into ChromaDB...")
    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
    logger.info(f"Successfully seeded {len(ids)} documents into ChromaDB.")

    return len(ids)


# ─── RETRIEVAL ────────────────────────────────────────────────────────────────

def retrieve_context(query: str, n_results: int = 4) -> list[dict]:
    """
    Embed the user query and retrieve the top-k most similar documents from ChromaDB.

    Returns a list of dicts with keys: id, title, category, text, score.
    """
    _, collection = _get_chroma()

    if collection.count() == 0:
        seed_knowledge_base()

    if collection.count() == 0:
        logger.warning("Knowledge base is empty.")
        return []

    try:
        results = collection.query(
            query_texts=[query],
            n_results=min(n_results, collection.count()),
            include=["documents", "metadatas", "distances"],
        )
    except Exception as exc:
        logger.error(f"ChromaDB query failed: {exc}")
        return []

    docs = []
    if results and results.get("ids") and results["ids"][0]:
        for i, doc_id in enumerate(results["ids"][0]):
            dist = results["distances"][0][i] if results.get("distances") else 0.5
            # Cosine distance to similarity percentage
            similarity = max(0.0, min(1.0, 1.0 - (dist / 2.0)))
            docs.append({
                "id": doc_id,
                "title": results["metadatas"][0][i].get("title", ""),
                "category": results["metadatas"][0][i].get("category", ""),
                "text": results["documents"][0][i],
                "score": round(similarity, 4),
            })

    return docs


# ─── LOCAL DIRECT SYNTHESIS (FALLBACK & ZERO-LATENCY MODE) ─────────────────────

def _synthesize_from_context(query: str, sources: list[dict]) -> str:
    """
    Directly synthesizes an evidence-grounded veterinary guidance report from retrieved
    ICAR/DAHD knowledge documents when Gemini is unavailable or permission-restricted.
    """
    if not sources:
        return (
            "I could not locate specific veterinary protocols matching your query in the verified database.\n\n"
            "Please contact your local Block Veterinary Officer (BVO) immediately or call the national helpline.\n\n"
            "📞 **DAHD Animal Helpline:** 1962"
        )

    top_doc = sources[0]
    top_title = top_doc.get("title", "Clinical Protocol")
    top_text = top_doc.get("text", "")

    # Check for zoonotic alerts
    zoonotic_terms = ["anthrax", "rabies", "brucellosis", "zoonotic", "zoonosis", "avian influenza"]
    is_zoonotic = any(t in query.lower() or t in top_text.lower() for t in zoonotic_terms)

    # Format extracted sections cleanly
    lines = [l.strip() for l in top_text.splitlines() if l.strip()]
    content_body = "\n\n".join(lines[1:12]) if len(lines) > 1 else top_text

    response_parts = []
    if is_zoonotic:
        response_parts.append(
            "⚠️ **CRITICAL ZOONOTIC ALERT**: This condition may transmit to humans! "
            "Wear gloves/PPE, avoid touching lesions or body fluids, do not consume unpasteurized milk or meat, "
            "and immediately notify District IDSP & the BVO."
        )

    response_parts.append(f"### Relevant Clinical Protocol: {top_title}\n\n{content_body}")

    if len(sources) > 1:
        related_titles = [f"• **{s['title']}** (Relevance: {s['score']:.0%})" for s in sources[1:3]]
        response_parts.append("### Related Guidelines\n" + "\n".join(related_titles))

    response_parts.append(
        "⚕️ **Notice**: For formal clinical diagnosis and prescription treatment, please consult your "
        "Block Veterinary Officer (BVO). You can also report this case in Pashu Sentinel to automatically alert the nearest available veterinarian.\n"
        "📞 **DAHD Animal Helpline:** 1962"
    )

    return "\n\n---\n\n".join(response_parts)


# ─── GENERATION ───────────────────────────────────────────────────────────────

def answer_query(query: str, chat_history: list[dict] | None = None) -> dict:
    """
    Full RAG pipeline: retrieve context → build prompt → generate response.

    Args:
        query:        The user's question.
        chat_history: Optional list of {"role": "user"/"model", "parts": [str]}
                      for multi-turn conversations.

    Returns:
        {
          "answer":   str,          # Generated answer
          "sources":  list[dict],   # Retrieved source documents
          "fallback": bool          # True if LLM fallback used
        }
    """
    # 1. Retrieve context from ChromaDB
    sources = retrieve_context(query, n_results=4)

    # 2. Check if Gemini is configured
    gemini_ready = _configure_gemini()
    answer: Optional[str] = None
    fallback_used = False

    if gemini_ready:
        import google.generativeai as genai  # type: ignore

        if not sources:
            context_text = "No specific documents found in the knowledge base for this query."
        else:
            context_parts = []
            for i, src in enumerate(sources, 1):
                context_parts.append(
                    f"[Document {i}: {src['title']}]\n{src['text'][:1500]}"
                )
            context_text = "\n\n---\n\n".join(context_parts)

        augmented_query = (
            f"RELEVANT VETERINARY KNOWLEDGE CONTEXT:\n"
            f"{'='*60}\n"
            f"{context_text}\n"
            f"{'='*60}\n\n"
            f"USER QUESTION: {query}\n\n"
            f"Please answer the question using ONLY the context provided above. "
            f"If the context doesn't fully answer the question, say so clearly and "
            f"recommend contacting the Block Veterinary Officer."
        )

        # Try candidate models
        for model_name in _GEMINI_CANDIDATE_MODELS:
            try:
                model = genai.GenerativeModel(
                    model_name=model_name,
                    system_instruction=_SYSTEM_PROMPT,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.3,
                        max_output_tokens=1024,
                        top_p=0.9,
                    ),
                )
                history = chat_history or []
                chat = model.start_chat(history=history)
                response = chat.send_message(augmented_query)
                if response and response.text:
                    answer = response.text
                    break
            except Exception as exc:
                logger.warning(f"Model {model_name} failed: {exc}")
                continue

    # If Gemini was not ready, failed, or project access was denied, use verified knowledge synthesis
    if not answer:
        logger.info("Using ICAR/DAHD knowledge base synthesis mode.")
        answer = _synthesize_from_context(query, sources)
        fallback_used = True

    return {
        "answer": answer,
        "sources": [
            {"id": s["id"], "title": s["title"], "category": s["category"], "score": s["score"]}
            for s in sources
        ],
        "fallback": fallback_used,
    }


# ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

def rag_health() -> dict:
    """Returns RAG system health status."""
    _, collection = _get_chroma()
    doc_count = collection.count()
    gemini_ok = _configure_gemini()
    return {
        "vector_store": "chromadb",
        "chroma_path": _CHROMA_PATH,
        "documents_indexed": doc_count,
        "gemini_configured": gemini_ok,
        "status": "ready" if doc_count > 0 else "degraded",
    }
