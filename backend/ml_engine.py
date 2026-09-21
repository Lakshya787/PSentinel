"""
Pashu Sentinel — Three-Tier ML Intelligence Engine
====================================================
ref.md §10 — Three-Tiered Hybrid Intelligence Pipeline

Tier 1 | Case-Level Triage (Isolation Forest)
  Detects anomalous combinations of prodromal symptoms, species susceptibility,
  and atypical case-fatality rates. Threshold: anomaly_score > 0.65 → escalate.
  Source: Liu et al. (2008, IEEE ICDM); VanderWaal et al. (2020, Front. Vet. Sci.)

Tier 2 | Temporal Baseline Aberration (EWMA + Farrington-style)
  EWMA (alpha=0.3) models weekly syndromic incidence against rolling seasonal baselines.
  Noufaily-Farrington upper threshold with negative-binomial overdispersion:
    threshold = mu_EWMA + z_0.99 * sqrt(mu_EWMA * phi)
  Source: Noufaily et al. (2012, Statistics in Medicine); Vial & Berezowski (2015)

Tier 3 | Spatio-Temporal Outbreak Delineation (ST-DBSCAN)
  Pure-Python ST-DBSCAN clusters georeferenced high-risk reports into contiguous
  outbreak boundaries using haversine spatial distance + temporal window.
    eps_spatial  = 10 km   (surveillance ring radius, ref.md §11)
    eps_temporal = 7 days
    minPts       = 2
  Source: Kulldorff et al. (2005, PLoS Medicine); Birant & Kut (2007, DATAK)
"""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger("pashu.ml")

# ─── Constants ────────────────────────────────────────────────────────────────
ANOMALY_THRESHOLD     = 0.65    # ref.md §10.1 — s > 0.65 triggers tier-1 flag
EWMA_ALPHA            = 0.3     # smoothing factor
FARRINGTON_Z_99       = 2.576   # 99% one-tailed CI (Noufaily-modified Farrington)
ST_EPS_SPATIAL_KM     = 10.0   # 10 km spatial neighbourhood (ref.md §11)
ST_EPS_TEMPORAL_DAYS  = 7      # 7-day temporal window
ST_MINPTS             = 2      # minimum points to form a cluster

# ─── Seven Core Syndromic Case Definitions (ref.md §10.2) ────────────────────
SYNDROME_DEFINITIONS = {
    "vesicular_podal": {
        "label":    "Vesicular / Podal Syndrome",
        "triggers": {"oral vesicles", "excessive salivation", "lameness", "blister"},
        "diseases": ["FMD", "Vesicular Stomatitis", "SVD"],
    },
    "acute_respiratory": {
        "label":    "Acute Respiratory Syndrome",
        "triggers": {"respiratory distress", "nasal discharge", "cough", "dyspnoea"},
        "diseases": ["BRDC", "PPR", "CBPP"],
    },
    "enteric_diarrheal": {
        "label":    "Enteric / Diarrheal Syndrome",
        "triggers": {"diarrhoea", "diarrhea", "blood in stool", "dehydration"},
        "diseases": ["BVD", "Salmonellosis", "Rotavirus", "Johne's Disease"],
    },
    "abortion_reproductive": {
        "label":    "Abortion / Reproductive Storm",
        "triggers": {"abortion", "stillbirth", "reproductive failure", "infertility"},
        "diseases": ["Brucellosis", "Leptospirosis"],
    },
    "neurological": {
        "label":    "Neurological Syndrome",
        "triggers": {"neurological symptoms", "convulsions", "paralysis", "circling"},
        "diseases": ["Rabies", "Listeriosis", "Japanese Encephalitis"],
    },
    "sudden_death_septicemic": {
        "label":    "Sudden Death / Septicemic Syndrome",
        "triggers": {"sudden death", "haemorrhage", "bloody discharge", "anthrax"},
        "diseases": ["Anthrax", "Hemorrhagic Septicemia", "Blackleg"],
    },
    "cutaneous_nodular": {
        "label":    "Cutaneous / Nodular Pox-like Syndrome",
        "triggers": {"skin / nodular lesions", "nodular lesions", "skin lesions", "pox"},
        "diseases": ["Lumpy Skin Disease (LSD)", "Sheep Pox", "Goat Pox"],
    },
}

ALL_SYNDROME_LABELS = [v["label"] for v in SYNDROME_DEFINITIONS.values()]


def classify_syndrome(symptoms: list[str]) -> str:
    """Map symptoms to one of the 7 syndromic case definitions (ref.md §10.2)."""
    symptom_set = {s.lower() for s in symptoms}
    best_key, best_score = "undetermined", 0
    for key, defn in SYNDROME_DEFINITIONS.items():
        overlap = len(symptom_set & defn["triggers"])
        if overlap > best_score:
            best_key, best_score = key, overlap
    if best_key == "undetermined":
        return "Undetermined Syndrome"
    return SYNDROME_DEFINITIONS[best_key]["label"]


# ─── Species Susceptibility Index ────────────────────────────────────────────
SPECIES_SUSCEPTIBILITY: dict[str, float] = {
    "cattle":  0.95,
    "buffalo": 0.90,
    "goat":    0.75,
    "sheep":   0.70,
    "pig":     0.60,
    "other":   0.50,
}


# ──────────────────────────────────────────────────────────────────────────────
# TIER 1 — Isolation Forest Case-Level Triage
# ──────────────────────────────────────────────────────────────────────────────

def _synthetic_normal_baseline(n: int = 600) -> np.ndarray:
    """Generate synthetic 'normal' field report feature vectors for IF training."""
    rng = np.random.default_rng(42)
    return np.column_stack([
        rng.integers(1, 3, n).astype(float),
        rng.uniform(0.0, 0.04, n),
        rng.uniform(18.0, 42.0, n),
        rng.uniform(1.0, 3.5, n),
        rng.choice([0.5, 0.70, 0.75], n).astype(float),
    ])


def _case_features(case: dict) -> np.ndarray:
    """Extract a (1, 5) feature vector from a case dict."""
    rf           = case.get("risk_factors", {})
    species_key  = case.get("species", "other").lower()
    susc         = SPECIES_SUSCEPTIBILITY.get(species_key, 0.50)
    mortality    = int(case.get("mortality", 0))
    affected     = max(int(case.get("affected_animals", case.get("affectedAnimals", 1))), 1)
    symptoms     = case.get("symptoms", [])
    clinical     = float(rf.get("clinical", 50))
    return np.array([[
        len(symptoms),
        mortality / affected,
        clinical,
        math.log1p(affected),
        susc,
    ]])


class IsolationForestTriage:
    """
    Tier 1: Case-Level Isolation Forest Triage.
    Trained on 600 synthetic normal reports + real seed cases.
    Anomaly score > 0.65 → immediate tier-1 escalation.
    """

    def __init__(self, contamination: float = 0.15):
        self._model  = IsolationForest(
            n_estimators=200,
            contamination=contamination,
            max_samples="auto",
            random_state=42,
            n_jobs=-1,
        )
        self._scaler  = StandardScaler()
        self._trained = False

    def fit(self, seed_cases: list[dict]) -> "IsolationForestTriage":
        synthetic  = _synthetic_normal_baseline(600)
        real_vecs  = []
        for c in seed_cases:
            try:
                real_vecs.append(_case_features(c)[0])
            except Exception as exc:
                logger.debug(f"Skipping case {c.get('id','?')} in IF training: {exc}")

        X = np.vstack([synthetic, np.array(real_vecs)]) if real_vecs else synthetic
        self._scaler.fit(X)
        self._model.fit(self._scaler.transform(X))
        self._trained = True
        logger.info(
            f"[Tier 1] IsolationForest trained — {len(X)} samples "
            f"({len(real_vecs)} real + {len(synthetic)} synthetic normals)"
        )
        return self

    def score(self, case: dict) -> dict:
        """Score a single case. Returns anomaly_score, is_anomalous, decision."""
        if not self._trained:
            return {
                "anomaly_score": 0.50,
                "is_anomalous": False,
                "decision": "UNTRAINED",
                "threshold": ANOMALY_THRESHOLD,
            }

        feat  = self._scaler.transform(_case_features(case))
        # decision_function: more negative → more anomalous → map to [0, 1]
        df    = self._model.decision_function(feat)[0]
        score = float(np.clip(0.5 - df, 0.0, 1.0))
        is_anomalous = score > ANOMALY_THRESHOLD

        affected = max(int(case.get("affected_animals", case.get("affectedAnimals", 1))), 1)
        return {
            "anomaly_score": round(score, 4),
            "is_anomalous":  is_anomalous,
            "decision":      "ANOMALOUS" if is_anomalous else "NORMAL",
            "threshold":     ANOMALY_THRESHOLD,
            "features": {
                "symptom_count":          len(case.get("symptoms", [])),
                "mortality_rate":         round(int(case.get("mortality", 0)) / affected, 3),
                "clinical_score":         case.get("risk_factors", {}).get("clinical", 50),
                "species_susceptibility": SPECIES_SUSCEPTIBILITY.get(
                    case.get("species", "other").lower(), 0.5
                ),
            },
        }


# ──────────────────────────────────────────────────────────────────────────────
# TIER 2 — EWMA + Farrington Temporal Baseline Aberration
# ──────────────────────────────────────────────────────────────────────────────

def _iso_week(dt: datetime) -> str:
    iso = dt.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def _parse_dt(raw: Any) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except Exception:
        return None


class EWMAFarrington:
    """
    Tier 2: EWMA + Farrington-style temporal aberration detector.
    Aggregates cases by (syndrome, ISO-week) and detects statistical aberrations.
    """

    def __init__(self) -> None:
        self._series: dict[str, list[dict]] = {}

    def build_series(self, all_cases: list[dict]) -> "EWMAFarrington":
        buckets: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        for c in all_cases:
            syndrome = c.get("syndrome") or classify_syndrome(c.get("symptoms", []))
            dt = _parse_dt(c.get("reported_at") or c.get("reportedAt"))
            if dt:
                buckets[syndrome][_iso_week(dt)] += 1

        self._series = {
            syndrome: [{"week": w, "count": cnt} for w, cnt in sorted(weeks.items())]
            for syndrome, weeks in buckets.items()
        }
        logger.info(
            f"[Tier 2] EWMA series built for {len(self._series)} syndromes "
            f"from {len(all_cases)} cases."
        )
        return self

    def detect(self, syndrome: str, case_dt: datetime | None = None) -> dict:
        now          = case_dt or datetime.now(timezone.utc)
        current_week = _iso_week(now)
        historical   = self._series.get(syndrome, [])
        baseline     = [e for e in historical if e["week"] < current_week]
        current_count = next((e["count"] for e in historical if e["week"] == current_week), 0)

        if len(baseline) < 2:
            return {
                "syndrome": syndrome,
                "current_week": current_week,
                "current_count": current_count,
                "ewma_baseline": None,
                "farrington_threshold": None,
                "overdispersion": None,
                "z_score": None,
                "is_aberrant": False,
                "note": "Insufficient historical data (<2 prior weeks)",
            }

        counts = [e["count"] for e in baseline]

        # EWMA
        ewma = float(counts[0])
        for c in counts[1:]:
            ewma = EWMA_ALPHA * c + (1.0 - EWMA_ALPHA) * ewma

        # Overdispersion (negative-binomial)
        mean_c = float(np.mean(counts))
        var_c  = float(np.var(counts))
        phi    = max(1.0, var_c / mean_c) if mean_c > 0 else 1.0

        # Farrington upper threshold
        threshold = ewma + FARRINGTON_Z_99 * math.sqrt(max(ewma, 0.01) * phi)
        z_score   = (current_count - ewma) / math.sqrt(max(ewma * phi, 0.01))

        return {
            "syndrome":             syndrome,
            "current_week":         current_week,
            "current_count":        current_count,
            "ewma_baseline":        round(ewma, 3),
            "farrington_threshold": round(threshold, 3),
            "overdispersion":       round(phi, 3),
            "z_score":              round(z_score, 3),
            "is_aberrant":          current_count > threshold,
            "historical_weeks":     len(baseline),
            "alpha":                EWMA_ALPHA,
            "ci_level":             "99%",
        }


# ──────────────────────────────────────────────────────────────────────────────
# TIER 3 — ST-DBSCAN Spatio-Temporal Clustering
# ──────────────────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R  = 6371.0
    f1 = math.radians(lat1)
    f2 = math.radians(lat2)
    df = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a  = math.sin(df / 2) ** 2 + math.cos(f1) * math.cos(f2) * math.sin(dl / 2) ** 2
    return 2.0 * R * math.asin(math.sqrt(min(a, 1.0)))


def st_dbscan(cases: list[dict]) -> list[dict]:
    """
    Spatio-Temporal DBSCAN — pure Python, no PostGIS dependency.
    Adds 'cluster_id' to each case: -1 = noise, >= 0 = cluster index.
    """
    n = len(cases)
    if n == 0:
        return []

    timestamps = [_parse_dt(c.get("reported_at") or c.get("reportedAt")) for c in cases]
    UNVISITED  = -2
    labels     = [UNVISITED] * n
    cluster_id = 0

    def neighbours(idx: int) -> list[int]:
        ci = cases[idx]
        ti = timestamps[idx]
        lat_i, lng_i = float(ci.get("lat", 0)), float(ci.get("lng", 0))
        res = []
        for j, cj in enumerate(cases):
            if j == idx:
                continue
            try:
                dist = _haversine_km(lat_i, lng_i, float(cj.get("lat", 0)), float(cj.get("lng", 0)))
            except Exception:
                continue
            if dist > ST_EPS_SPATIAL_KM:
                continue
            tj = timestamps[j]
            if ti and tj:
                if abs((ti - tj).total_seconds()) / 86_400 > ST_EPS_TEMPORAL_DAYS:
                    continue
            res.append(j)
        return res

    for i in range(n):
        if labels[i] != UNVISITED:
            continue
        nbrs = neighbours(i)
        if len(nbrs) < ST_MINPTS - 1:
            labels[i] = -1   # noise
            continue
        labels[i] = cluster_id
        seeds = set(nbrs)
        while seeds:
            j = seeds.pop()
            if labels[j] == -1:
                labels[j] = cluster_id
            if labels[j] != UNVISITED:
                continue
            labels[j] = cluster_id
            j_nbrs = neighbours(j)
            if len(j_nbrs) >= ST_MINPTS - 1:
                seeds.update(j_nbrs)
        cluster_id += 1

    return [{**c, "cluster_id": labels[i]} for i, c in enumerate(cases)]


def cluster_summary(clustered: list[dict]) -> list[dict]:
    groups: dict[int, list[dict]] = defaultdict(list)
    for c in clustered:
        cid = c.get("cluster_id", -1)
        if cid >= 0:
            groups[cid].append(c)

    summaries = []
    for cid, members in groups.items():
        scores = [m.get("risk", {}).get("score", 0) for m in members]
        summaries.append({
            "cluster_id":        cid,
            "case_count":        len(members),
            "case_ids":          [m["id"] for m in members],
            "villages":          sorted({m.get("village", "?") for m in members}),
            "districts":         sorted({m.get("district", "?") for m in members}),
            "highest_risk":      max(scores) if scores else 0,
            "mean_risk":         round(sum(scores) / len(scores), 1) if scores else 0,
            "eps_spatial_km":    ST_EPS_SPATIAL_KM,
            "eps_temporal_days": ST_EPS_TEMPORAL_DAYS,
        })
    return sorted(summaries, key=lambda s: -s["highest_risk"])


# ──────────────────────────────────────────────────────────────────────────────
# THREE-TIER PIPELINE ORCHESTRATOR
# ──────────────────────────────────────────────────────────────────────────────

def run_three_tier_pipeline(
    case: dict,
    if_model: IsolationForestTriage,
    ewma_model: EWMAFarrington,
    all_cases: list[dict],
) -> dict:
    """Run the full three-tier pipeline on one case and return a structured report."""

    # Tier 1
    t1 = if_model.score(case)

    # Tier 2
    syndrome = case.get("syndrome") or classify_syndrome(case.get("symptoms", []))
    case_dt  = _parse_dt(case.get("reported_at") or case.get("reportedAt"))
    t2 = ewma_model.detect(syndrome, case_dt)

    # Tier 3
    geo_cases = [c for c in all_cases if c.get("lat") is not None and c.get("lng") is not None]
    clustered = st_dbscan(geo_cases)
    summaries = cluster_summary(clustered)
    this_c    = next((c for c in clustered if c.get("id") == case.get("id")), None)
    cid       = this_c.get("cluster_id", -1) if this_c else -1
    this_cluster = next((s for s in summaries if s["cluster_id"] == cid), None) if cid >= 0 else None

    t3 = {
        "cluster_id":  cid,
        "is_isolated": cid == -1,
        "cluster":     this_cluster,
        "all_clusters": summaries,
        "parameters": {
            "eps_spatial_km":    ST_EPS_SPATIAL_KM,
            "eps_temporal_days": ST_EPS_TEMPORAL_DAYS,
            "min_pts":           ST_MINPTS,
        },
    }

    # Intelligence summary
    triggers = []
    if t1["is_anomalous"]:
        triggers.append("TIER1_ISOLATION_FOREST")
    if t2.get("is_aberrant"):
        triggers.append("TIER2_FARRINGTON_EWMA")
    if not t3["is_isolated"]:
        triggers.append("TIER3_ST_DBSCAN_CLUSTER")

    n = len(triggers)
    confidence_map = {0: "LOW", 1: "MEDIUM", 2: "HIGH", 3: "CRITICAL"}
    ml_boost       = round((n / 3.0) * 15.0, 1)   # max +15 to WLC composite score

    recommendation_map = {
        3: "CRITICAL: All three intelligence tiers activated. Immediate Rapid Response Team deployment and 3km bio-containment ring.",
        2: "HIGH: Two tiers triggered. Veterinary investigation within 24 hours recommended.",
        1: "MEDIUM: Single tier triggered. Enhanced passive surveillance and telephonic check.",
        0: "LOW: No anomaly flags detected. Routine data logging.",
    }

    return {
        "case_id":  case.get("id"),
        "syndrome": syndrome,
        "tier1": {
            **t1,
            "algorithm": "Isolation Forest (sklearn, 200 estimators, contamination=0.15)",
            "description": (
                f"Statistical outlier detected (score {t1['anomaly_score']:.4f} > {ANOMALY_THRESHOLD})"
                if t1["is_anomalous"] else
                f"Within baseline parameters (score {t1['anomaly_score']:.4f})"
            ),
        },
        "tier2": {
            **t2,
            "algorithm": f"EWMA (alpha={EWMA_ALPHA}) + Noufaily-Farrington (z={FARRINGTON_Z_99}, 99% CI)",
            "description": (
                f"Temporal aberration: count {t2.get('current_count')} > "
                f"threshold {t2.get('farrington_threshold')} (z={t2.get('z_score')})"
                if t2.get("is_aberrant") else
                "Weekly incidence within seasonal Farrington baseline"
            ),
        },
        "tier3": {
            **t3,
            "algorithm": f"ST-DBSCAN (eps={ST_EPS_SPATIAL_KM}km / {ST_EPS_TEMPORAL_DAYS}d, minPts={ST_MINPTS})",
            "description": (
                f"Cluster {cid}: {this_cluster['case_count'] if this_cluster else '?'} cases "
                f"in {this_cluster['villages'] if this_cluster else []}"
                if not t3["is_isolated"] else
                "Isolated case — no spatio-temporal cluster detected"
            ),
        },
        "intelligence_summary": {
            "triggers_fired":         triggers,
            "tiers_activated":        n,
            "ml_confidence":          confidence_map.get(n, "LOW"),
            "ml_risk_boost":          ml_boost,
            "escalation_recommended": n >= 2,
            "recommendation":         recommendation_map[n],
        },
    }
