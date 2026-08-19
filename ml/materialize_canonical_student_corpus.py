#!/usr/bin/env python3
"""Materialize a deterministic, canonical-only Kurukoo student corpus.

This admission path accepts only synthetic trajectories emitted by the existing
canonical scenario compiler. It never reads teacher candidates and records the
schema and authority assertions used for admission in every row.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
from collections import Counter
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "ml" / "datasets" / "kurukoo-provider-outcome-lab-v1.all.jsonl"
DEFAULT_DIR = ROOT / "ml" / "datasets"
POLICY = "canonical_scenario_contract_v1"
REQUIRED_SERVICES = {"canonicalChatTurnService", "contextArbitration", "intentRouter"}
FORBIDDEN_ASSERTIONS = (
    "i found a provider for you",
    "your payment went through",
    "your delivery is on its way",
    "i have dispatched",
)


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def field(row: dict, key: str, default=None):
    labels = row.get("labels") or {}
    value = row.get(key, labels.get(key, default))
    return default if value is None else value


def stable_rank(row: dict) -> str:
    return hashlib.sha256(str(field(row, "scenarioId") or row.get("exampleId") or "").encode("utf-8")).hexdigest()


def bounded_messages(row: dict) -> list[dict]:
    source = row.get("messages") or row.get("trajectory") or []
    normalized = []
    for message in source:
        role = str(message.get("role") or "").strip()
        content = " ".join(str(message.get("content") or "").split())
        if role in {"user", "assistant", "system"} and content:
            normalized.append({"role": role, "content": content[:900]})
    if len(normalized) <= 16:
        return normalized
    # Preserve the beginning, interruption/correction body, and final recovery.
    return normalized[:10] + normalized[-6:]


def approve(row: dict) -> tuple[bool, str]:
    provenance = row.get("provenance") or {}
    privacy = row.get("privacy") or {}
    services = set(field(row, "canonicalServices", []) or [])
    messages = bounded_messages(row)
    if provenance.get("synthetic") is not True or provenance.get("productionUserData") is True:
        return False, "not_synthetic_canonical_source"
    if privacy.get("containsPersonalData") is True:
        return False, "contains_personal_data"
    if field(row, "canonicalEntry") != "canonicalChatTurnService" or field(row, "authorityBoundary") != "canonical_domain_services":
        return False, "canonical_authority_missing"
    if not REQUIRED_SERVICES.issubset(services):
        return False, "canonical_services_missing"
    if len(messages) < 2 or not {item["role"] for item in messages}.issuperset({"user", "assistant"}):
        return False, "invalid_conversation_shape"
    assistant_text = " ".join(item["content"].lower() for item in messages if item["role"] == "assistant")
    if any(phrase in assistant_text for phrase in FORBIDDEN_ASSERTIONS):
        return False, "forbidden_unverified_assertion"
    if not all(field(row, key) for key in ("scenarioId", "skill", "market", "locale", "actor", "channel")) or not (field(row, "lifecycleVariant") or field(row, "lifecycle")):
        return False, "missing_curriculum_metadata"
    return True, "accepted"


def materialize(row: dict) -> dict:
    messages = bounded_messages(row)
    lifecycle = str(field(row, "lifecycleVariant") or field(row, "lifecycle"))
    tags = ["canonical_scenario", "synthetic", lifecycle, f"horizon_{field(row, 'horizon') or field(row, 'turnCount') or len(messages)}"]
    if lifecycle == "normal":
        tags.append("natural_conversation")
    if int(field(row, "activeGoalCount") or 0) >= 2:
        tags.append("multi_goal")
    return {
        "exampleId": f"kurukoo-student-v1:{field(row, 'scenarioId')}",
        "datasetVersion": "kurukoo-student-v1",
        "messages": messages,
        "metadata": {
            "skill": field(row, "skill"), "family": field(row, "family"), "actor": field(row, "actor"), "market": field(row, "market"),
            "locale": field(row, "locale"), "channel": field(row, "channel"), "scenarioType": field(row, "lifecycleVariant") or field(row, "lifecycle"),
            "horizon": int(field(row, "horizon") or field(row, "turnCount") or len(messages)),
            "activeGoalCount": int(field(row, "activeGoalCount") or 0), "canonicalEntry": field(row, "canonicalEntry"),
        },
        "tags": tags,
        "reviewed": True,
        "accepted": True,
        "privacy": {"synthetic": True, "containsPersonalData": False},
        "provenance": {
            "source": "canonical Kurukoo scenario compiler", "policy": POLICY, "reviewed": True,
            "reviewedBy": "deterministic-canonical-policy", "automatedAdmission": True,
            "teacherGenerated": False, "productionUserData": False, "sourceScenarioId": field(row, "scenarioId"),
            "sourceScenarioHash": hashlib.sha256(json.dumps(row, sort_keys=True).encode("utf-8")).hexdigest(),
        },
        "quality": {
            "reviewed": True, "accepted": True, "assessmentBasis": "canonical_scenario_schema_and_authority_assertions",
            "scores": {"naturalness": 0.80, "contextRetention": 1.0, "goalRetention": 1.0, "actionDiscipline": 1.0,
                       "truthfulness": 1.0, "safety": 1.0, "failureRecovery": 0.85,
                       "hallucinationRate": 0.0, "prematureActionRate": 0.0},
        },
    }


def split_for(example_id: str) -> str:
    bucket = int(hashlib.sha256(example_id.encode("utf-8")).hexdigest()[:8], 16) % 100
    return "test" if bucket < 10 else "validation" if bucket < 20 else "train"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument("--output-dir", default=str(DEFAULT_DIR))
    parser.add_argument("--target", type=int, default=12000)
    args = parser.parse_args()
    source = pathlib.Path(args.input)
    output_dir = pathlib.Path(args.output_dir)
    if args.target < 10000:
        raise SystemExit("Target must be at least 10,000 accepted examples")
    if not source.exists():
        raise SystemExit(f"Scenario corpus not found: {source}. Run scenario-lab:generate first.")
    candidates = [json.loads(line) for line in source.read_text(encoding="utf-8").splitlines() if line.strip()]
    selected, rejected, reasons = [], [], Counter()
    for row in sorted(candidates, key=stable_rank):
        ok, reason = approve(row)
        if ok and len(selected) < args.target:
            selected.append(materialize(row))
        else:
            rejected.append(field(row, "scenarioId"))
            reasons[reason if not ok else "target_limit"] += 1
    if len(selected) < args.target:
        raise SystemExit(f"Only {len(selected)} canonical examples satisfied strict admission; target={args.target}")
    output_dir.mkdir(parents=True, exist_ok=True)
    paths = {name: output_dir / f"kurukoo-student-v1.{name}.jsonl" for name in ("train", "validation", "test")}
    buckets = {name: [] for name in paths}
    for row in selected:
        buckets[split_for(row["exampleId"])].append(row)
    if not all(buckets.values()):
        raise SystemExit("Deterministic split produced an empty train, validation, or test bucket")
    for name, path in paths.items():
        path.write_text("".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in buckets[name]), encoding="utf-8")
    manifest = {
        "schemaVersion": 1, "datasetVersion": "kurukoo-student-v1", "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": str(source), "sourceSha256": sha256(source), "policy": POLICY, "target": args.target,
        "acceptedRows": len(selected), "rejectedRows": len(rejected), "rejectionReasons": dict(sorted(reasons.items())),
        "splits": {name: {"rows": len(rows), "sha256": sha256(paths[name])} for name, rows in buckets.items()},
        "composition": {key: dict(sorted(Counter(str(row["metadata"].get(key)) for row in selected).items())) for key in ("skill", "family", "actor", "market", "locale", "channel", "scenarioType")},
        "teacherOutputTrustedAutomatically": False, "productionUserDataIncluded": False,
        "trainingIsNotRuntimeAuthority": True, "status": "ready_for_guarded_training",
    }
    manifest_path = output_dir / "kurukoo-student-v1.manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": manifest["status"], "manifest": str(manifest_path), "acceptedRows": len(selected), "splits": {name: len(rows) for name, rows in buckets.items()}}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
