"""
app/services/rag_service.py
─────────────────────────────────────────────────────────────────────────────
Pashu Sentinel — RAG-Based Veterinary Knowledge System

Architecture (ref.md §14):
  • Vector store  : ChromaDB (local, persistent on disk)
  • Embeddings    : Google text-embedding-004
  • Generation    : Google Gemini 1.5 Flash
  • Retrieval     : Cosine similarity top-k (ChromaDB native)
  • Safety guards : Hard system prompt rules — never prescribe Schedule H drugs

Environment variables required:
  GEMINI_API_KEY=<your-google-ai-studio-key>
─────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import logging
import os
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
        logger.warning("GEMINI_API_KEY not set — RAG will operate in retrieval-only mode.")
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
    Embed and store all VET_KNOWLEDGE_DOCS into ChromaDB.

    Args:
        force: If True, drops and re-creates the collection before seeding.
    Returns:
        Number of documents embedded.
    """
    from app.services.rag_knowledge import VET_KNOWLEDGE_DOCS

    if not _configure_gemini():
        logger.warning("Gemini not configured — skipping knowledge base seeding.")
        return 0

    import google.generativeai as genai  # type: ignore

    _, collection = _get_chroma()

    # If already seeded and not forced, skip
    if not force and collection.count() >= len(VET_KNOWLEDGE_DOCS):
        logger.info(f"Knowledge base already seeded with {collection.count()} docs — skipping.")
        return collection.count()

    if force:
        logger.info("Force re-seeding — dropping existing collection.")
        _chroma_client.delete_collection(_COLLECTION_NAME)
        global _collection
        _collection = _chroma_client.get_or_create_collection(
            name=_COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        _, collection = _get_chroma()

    ids, documents, metadatas, embeddings = [], [], [], []

    logger.info(f"Embedding {len(VET_KNOWLEDGE_DOCS)} veterinary knowledge documents...")
    for doc in VET_KNOWLEDGE_DOCS:
        # Embed: title + text for richer semantic search
        embed_text = f"{doc['title']}\n\n{doc['text']}"
        try:
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=embed_text,
                task_type="retrieval_document",
            )
            emb = result["embedding"]
        except Exception as exc:
            logger.error(f"Embedding failed for doc '{doc['id']}': {exc}")
            continue

        ids.append(doc["id"])
        documents.append(embed_text)
        metadatas.append({
            "title": doc["title"],
            "category": doc["category"],
            "language": doc["language"],
            "doc_id": doc["id"],
        })
        embeddings.append(emb)

    if ids:
        collection.add(ids=ids, documents=documents, metadatas=metadatas, embeddings=embeddings)
        logger.info(f"Successfully seeded {len(ids)} documents into ChromaDB.")

    return len(ids)


# ─── RETRIEVAL ────────────────────────────────────────────────────────────────

def retrieve_context(query: str, n_results: int = 4) -> list[dict]:
    """
    Embed the user query and retrieve the top-k most similar documents from ChromaDB.

    Returns a list of dicts with keys: id, title, category, text (snippet), score.
    """
    if not _configure_gemini():
        return []

    import google.generativeai as genai  # type: ignore

    _, collection = _get_chroma()

    if collection.count() == 0:
        logger.warning("Knowledge base is empty — run seed_knowledge_base() first.")
        return []

    try:
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=query,
            task_type="retrieval_query",
        )
        query_embedding = result["embedding"]
    except Exception as exc:
        logger.error(f"Query embedding failed: {exc}")
        return []

    try:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(n_results, collection.count()),
            include=["documents", "metadatas", "distances"],
        )
    except Exception as exc:
        logger.error(f"ChromaDB query failed: {exc}")
        return []

    docs = []
    for i, doc_id in enumerate(results["ids"][0]):
        docs.append({
            "id": doc_id,
            "title": results["metadatas"][0][i].get("title", ""),
            "category": results["metadatas"][0][i].get("category", ""),
            "text": results["documents"][0][i],
            # ChromaDB cosine distance → similarity score
            "score": round(1 - results["distances"][0][i], 4),
        })

    return docs


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
          "fallback": bool          # True if Gemini unavailable
        }
    """
    if not _configure_gemini():
        return {
            "answer": (
                "The AI assistant is currently unavailable (API key not configured). "
                "Please contact your Block Veterinary Officer (BVO) directly for assistance. "
                "Helpline: 1962 (DAHD Animal Helpline)."
            ),
            "sources": [],
            "fallback": True,
        }

    import google.generativeai as genai  # type: ignore

    # 1. Retrieve context
    sources = retrieve_context(query, n_results=4)

    if not sources:
        context_text = "No specific documents found in the knowledge base for this query."
    else:
        context_parts = []
        for i, src in enumerate(sources, 1):
            context_parts.append(
                f"[Document {i}: {src['title']}]\n{src['text'][:1500]}"
            )
        context_text = "\n\n---\n\n".join(context_parts)

    # 2. Build the augmented prompt
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

    # 3. Generate with Gemini Flash
    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=_SYSTEM_PROMPT,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,        # Low temp for factual accuracy
                max_output_tokens=1024,
                top_p=0.9,
            ),
        )

        # Build chat history for multi-turn context
        history = chat_history or []

        chat = model.start_chat(history=history)
        response = chat.send_message(augmented_query)
        answer = response.text

    except Exception as exc:
        logger.error(f"Gemini generation failed: {exc}")
        answer = (
            f"I encountered an issue generating a response: {exc}\n\n"
            "Please contact your Block Veterinary Officer (BVO) directly. "
            "Helpline: 1962 (DAHD Animal Helpline)."
        )

    return {
        "answer": answer,
        "sources": [
            {"id": s["id"], "title": s["title"], "category": s["category"], "score": s["score"]}
            for s in sources
        ],
        "fallback": False,
    }


# ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

def rag_health() -> dict:
    """Returns RAG system health status."""
    _, collection = _get_chroma()
    gemini_ok = _configure_gemini()
    return {
        "vector_store": "chromadb",
        "chroma_path": _CHROMA_PATH,
        "documents_indexed": collection.count(),
        "gemini_configured": gemini_ok,
        "status": "ready" if (gemini_ok and collection.count() > 0) else "degraded",
    }
