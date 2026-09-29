from dotenv import load_dotenv
load_dotenv('.env')
from app.services.rag_service import seed_knowledge_base, rag_health, answer_query
import json

print("=== Seeding knowledge base... ===")
count = seed_knowledge_base(force=True)
print(f"Seeded: {count} documents")

print()
print("=== Health check ===")
print(json.dumps(rag_health(), indent=2))

print()
print("=== Test query ===")
result = answer_query("My cow has blisters on its feet and is drooling a lot. What is it and what should I do?")
print("ANSWER:")
print(result["answer"][:800])
print()
print("SOURCES:")
for s in result["sources"]:
    score = s["score"]
    title = s["title"]
    print(f"  [{score:.2%}] {title}")
