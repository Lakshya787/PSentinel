import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from copy import deepcopy
from app.services.risk_engine import calculate_risk
from app.services.ml_engine import (
    IsolationForestTriage, EWMAFarrington,
    classify_syndrome, st_dbscan, cluster_summary,
    run_three_tier_pipeline, SYNDROME_DEFINITIONS
)
from scripts.seed_data import SEEDED_CASES

print("=== Pashu Sentinel ML Engine Smoke Test ===")


# 1. Syndrome classification
syms = ["fever", "oral vesicles", "excessive salivation", "lameness"]
s = classify_syndrome(syms)
print(f"[classify_syndrome] {syms} -> \"{s}\"")
assert s == "Vesicular / Podal Syndrome", f"Expected Vesicular / Podal, got {s}"

# 2. Prepare enriched seed
seed = [deepcopy(c) for c in SEEDED_CASES]
for c in seed:
    rf = c.get("risk_factors", {})
    if rf:
        c["risk"] = calculate_risk(**rf)
    if not c.get("syndrome"):
        c["syndrome"] = classify_syndrome(c.get("symptoms", []))

# 3. Tier 1 — Isolation Forest
if_model = IsolationForestTriage(contamination=0.15).fit(seed)
primary  = seed[0]  # COW-1024 (CRITICAL case)
r        = if_model.score(primary)
print(f"[Tier 1] COW-1024 anomaly_score={r['anomaly_score']:.4f}, decision={r['decision']}")
assert r["is_anomalous"], f"Expected ANOMALOUS for COW-1024, got {r}"

# Score a synthetic normal case
normal_case = {
    "id": "TEST-NORMAL", "species": "Goat",
    "symptoms": ["fever"], "mortality": 0, "affectedAnimals": 1,
    "risk_factors": {"clinical": 22, "vaccination": 30, "environmental": 25, "spatial": 20},
}
rn = if_model.score(normal_case)
print(f"[Tier 1] TEST-NORMAL anomaly_score={rn['anomaly_score']:.4f}, decision={rn['decision']}")

# 4. Tier 2 — EWMA / Farrington
ewma_model = EWMAFarrington().build_series(seed)
t2 = ewma_model.detect("Vesicular / Podal Syndrome")
print(f"[Tier 2] ewma_baseline={t2['ewma_baseline']}, threshold={t2['farrington_threshold']}, aberrant={t2['is_aberrant']}")

# 5. Tier 3 — ST-DBSCAN
geo      = [c for c in seed if c.get("lat") and c.get("lng")]
clustered = st_dbscan(geo)
summaries = cluster_summary(clustered)
print(f"[Tier 3] {len(summaries)} cluster(s) from {len(geo)} geo-cases")
for cs in summaries:
    print(f"  Cluster {cs['cluster_id']}: {cs['case_count']} cases | villages={cs['villages']} | peak_risk={cs['highest_risk']}")

# 6. Full pipeline
analysis = run_three_tier_pipeline(primary, if_model, ewma_model, seed)
intel    = analysis["intelligence_summary"]
print(f"[Pipeline] triggers={intel['triggers_fired']}")
print(f"[Pipeline] ml_confidence={intel['ml_confidence']}")
print(f"[Pipeline] recommendation={intel['recommendation'][:70]}...")

# 7. Check 7 syndrome definitions
assert len(SYNDROME_DEFINITIONS) == 7, f"Expected 7 syndromes, got {len(SYNDROME_DEFINITIONS)}"
print(f"[Syndromes] All 7 defined: {[v['label'] for v in SYNDROME_DEFINITIONS.values()]}")

print()
print("All checks passed.")
