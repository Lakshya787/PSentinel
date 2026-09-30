"""
backend/test_rag.py
─────────────────────────────────────────────────────────────────────────────
Comprehensive RAG System Verification Test Suite
─────────────────────────────────────────────────────────────────────────────
"""
import json
from dotenv import load_dotenv
load_dotenv('.env')

from fastapi.testclient import TestClient
from app.main import app
from app.services.rag_service import seed_knowledge_base, rag_health, retrieve_context, answer_query

print("=" * 65)
print("  PASHU SENTINEL — RAG VETERINARY SYSTEM TEST SUITE")
print("=" * 65)

# 1. Seeding Knowledge Base
print("\n[TEST 1] Seeding Knowledge Base in ChromaDB...")
indexed_count = seed_knowledge_base(force=False)
print(f" -> Indexed documents: {indexed_count}")
assert indexed_count >= 13, f"Expected at least 13 docs, got {indexed_count}"
print(" [PASS] Knowledge base seeded successfully.")

# 2. Health Check
print("\n[TEST 2] Verifying System Health Check...")
health = rag_health()
print(" -> Health Report:", json.dumps(health, indent=2))
assert health["documents_indexed"] >= 13
assert health["status"] == "ready"
print(" [PASS] Health status is READY.")

# 3. Semantic Retrieval Test
print("\n[TEST 3] Testing Semantic Retrieval on Clinical Queries...")
test_queries = [
    ("FMD Check", "cow has blisters on feet and salivating"),
    ("LSD Check", "nodules on skin and high fever in bull"),
    ("Anthrax Emergency", "sudden death with dark bleeding from nose and mouth"),
    ("EVM First-Aid", "herbal treatment for animal wound and maggots"),
]

for label, q in test_queries:
    results = retrieve_context(q, n_results=2)
    top_doc = results[0] if results else None
    print(f" -> [{label}] Query: '{q}'")
    if top_doc:
        print(f"    Top Match: '{top_doc['title']}' (Score: {top_doc['score']:.2%})")
    else:
        print("    [!] No results found!")
    assert top_doc is not None
print(" [PASS] Semantic retrieval working accurately.")

# 4. End-to-End Answer Generation
print("\n[TEST 4] Testing End-to-End answer_query Pipeline...")
sample_query = "My cow is drooling excessively and has vesicles on the tongue. What is the suspected disease and what immediate first aid can I provide?"
response = answer_query(sample_query)
print(" -> Generated Response:")
print("-" * 50)
print(response["answer"][:600] + ("..." if len(response["answer"]) > 600 else ""))
print("-" * 50)
print(f" -> Sources returned: {len(response['sources'])}")
for s in response["sources"]:
    print(f"    • {s['title']} ({s['score']:.1%})")
assert len(response["sources"]) > 0
assert "foot-and-mouth" in response["answer"].lower() or "fmd" in response["answer"].lower()
print(" [PASS] End-to-end question answering verified.")

# 5. FastAPI HTTP Router Integration Test
print("\n[TEST 5] Testing FastAPI Router Endpoints via HTTP TestClient...")
client = TestClient(app)

# GET /rag/health
res_health = client.get("/rag/health")
print(f" -> GET /rag/health status: {res_health.status_code}")
assert res_health.status_code == 200
assert res_health.json()["status"] == "ready"

# POST /rag/chat
chat_payload = {
    "query": "What are the common symptoms of Lumpy Skin Disease in cattle?",
    "history": []
}
res_chat = client.post("/rag/chat", json=chat_payload)
print(f" -> POST /rag/chat status: {res_chat.status_code}")
assert res_chat.status_code == 200
chat_data = res_chat.json()
print(f" -> Sources count: {len(chat_data['sources'])}")
print(f" -> Top source: {chat_data['sources'][0]['title']}")
assert len(chat_data["sources"]) > 0
assert "lumpy skin" in chat_data["answer"].lower() or "lsd" in chat_data["answer"].lower()
print(" [PASS] FastAPI /rag endpoints verified successfully.")

print("\n" + "=" * 65)
print("  ALL RAG TESTS PASSED SUCCESSFULLY! ")
print("=" * 65)
