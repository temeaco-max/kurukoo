#!/usr/bin/env python3
"""Reconcile legacy Kurukoo training material with the current Behaviour Pack.

The compiler is intentionally additive and fail-closed. Legacy rows must pass the
current pack's skill, authority, privacy, quality, and truth-boundary checks.
OS rows are deterministically converted from the Behaviour Pack scenario corpus;
teacher rows are never admitted by this compiler.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
from collections import Counter
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
PACK = ROOT / "ml" / "behaviour" / "latest.json"
OS_ROWS = ROOT / "ml" / "datasets" / "kurukoo-os-v1.all.jsonl"
DEFAULT_LEGACY = ROOT / "ml" / "datasets" / "kurukoo-accepted-v1.jsonl"
DEFAULT_OUTPUT = ROOT / "ml" / "datasets"
QUALITY_MINIMUMS = {"naturalness": 0.75, "contextRetention": 0.90, "goalRetention": 0.90, "actionDiscipline": 0.90, "truthfulness": 0.95, "safety": 0.95, "failureRecovery": 0.80}
MAX_RATES = {"prematureActionRate": 0.05, "hallucinationRate": 0.05}
FORBIDDEN_OUTPUT_CLAIMS = ("provider is available", "payment was successful", "payment went through", "delivery is complete", "i dispatched", "i have booked")


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_jsonl(path: pathlib.Path) -> list[dict]:
    if not path.exists():
        raise SystemExit(f"Required corpus input is missing: {path}")
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def quality_scores(row: dict) -> dict:
    quality = row.get("quality") or {}
    scores = quality.get("scores") or row.get("scores") or {}
    return scores if isinstance(scores, dict) else {}


def messages(row: dict) -> list[dict]:
    source = row.get("messages") or row.get("trajectory") or []
    normalized = []
    for item in source:
        if not isinstance(item, dict):
            continue
        role, content = str(item.get("role") or "").strip(), " ".join(str(item.get("content") or "").split())
        if role in {"user", "assistant", "system"} and content:
            normalized.append({"role": role, "content": content[:1200]})
    return normalized


def legacy_metadata(row: dict) -> dict:
    return row.get("metadata") or row.get("labels") or {}


def legacy_admission(row: dict, valid_skills: set[str], valid_capabilities: set[str]) -> tuple[bool, str]:
    provenance = row.get("provenance") or {}
    privacy = row.get("privacy") or {}
    meta = legacy_metadata(row)
    skill = str(meta.get("skill") or row.get("skill") or "")
    target_type = str(meta.get("targetType") or row.get("targetType") or "skill")
    capability = str(meta.get("capability") or row.get("capability") or "")
    if target_type == "capability":
        if capability not in valid_capabilities:
            return False, "capability_not_in_current_behaviour_pack"
    elif skill not in valid_skills:
        return False, "skill_not_in_current_behaviour_pack"
    if provenance.get("productionUserData") is True or privacy.get("containsPersonalData") is True:
        return False, "privacy_or_production_data"
    if not (row.get("reviewed") is True and row.get("accepted") is True):
        return False, "legacy_review_or_acceptance_missing"
    if str(meta.get("canonicalEntry") or row.get("canonicalEntry") or "") != "canonicalChatTurnService":
        return False, "canonical_entry_mismatch"
    authority = str(meta.get("authorityBoundary") or row.get("authorityBoundary") or "")
    legacy_canonical_provenance = provenance.get("source") == "canonical Kurukoo scenario compiler" and provenance.get("policy") == "canonical_scenario_contract_v1" and bool(provenance.get("sourceScenarioId"))
    if authority and authority != "canonical_domain_services":
        return False, "authority_boundary_mismatch"
    if not authority and not legacy_canonical_provenance:
        return False, "authority_boundary_unverifiable"
    scores = quality_scores(row)
    for key, minimum in QUALITY_MINIMUMS.items():
        if not isinstance(scores.get(key), (int, float)) or float(scores[key]) < minimum:
            return False, f"quality_below_current_policy:{key}"
    for key, maximum in MAX_RATES.items():
        if not isinstance(scores.get(key), (int, float)) or float(scores[key]) > maximum:
            return False, f"quality_above_current_policy:{key}"
    normalized = messages(row)
    if len(normalized) < 2 or not {item["role"] for item in normalized}.issuperset({"user", "assistant"}):
        return False, "invalid_conversation_shape"
    assistant = " ".join(item["content"].lower() for item in normalized if item["role"] == "assistant")
    if any(phrase in assistant for phrase in FORBIDDEN_OUTPUT_CLAIMS):
        return False, "unverified_external_claim"
    return True, "accepted"


def os_response(row: dict) -> str:
    expected = row["expected"]
    state = row["state"]
    required = "; ".join(expected["expected"])
    lifecycle = state["lifecycle"]
    return (
        f"I will handle this as {expected['behaviouralFamily']} for the exact current context. "
        f"The current lifecycle is {lifecycle}; I will preserve identity, relevant goals and capability state. "
        f"I will {required}. I can propose the next safe step, but any mutation stays with canonical services and I will not claim provider availability, pricing, payment, delivery or completion without evidence."
    )


def os_materialize(row: dict, pack: dict) -> dict:
    labels = row["labels"]
    family = labels["behaviourFamily"]
    tags = ["os_driven", "behaviour_pack", family]
    if family == "ordinary_conversation": tags.append("natural_conversation")
    if family in {"safety_and_injection", "truth_evidence", "failure_recovery", "relative_reference", "multi_goal"}: tags.append("adversarial")
    if family == "agent_continuation": tags.append("agentic")
    if family == "identity_capability_portfolio": tags.append("capability_portfolio")
    if family == "truth_evidence": tags.append("truth_boundary")
    if family == "cross_channel": tags.append("cross_channel")
    return {
        "exampleId": f"kurukoo-training-v2:os:{row['exampleId']}",
        "datasetVersion": "kurukoo-training-v2",
        "messages": [row["messages"][0], {"role": "assistant", "content": os_response(row)}],
        "metadata": {"skill": labels["skill"], "family": labels["family"], "actor": labels["actor"], "market": str(labels["locale"]).split(":", 1)[0], "locale": labels["locale"], "channel": labels["channel"], "scenarioType": family, "canonicalEntry": "canonicalChatTurnService", "authorityBoundary": "canonical_domain_services", "capabilityContext": row["state"].get("capability"), "activationState": row["state"].get("activationState")},
        "tags": tags,
        "reviewed": True,
        "accepted": True,
        "privacy": {"synthetic": True, "containsPersonalData": False},
        "provenance": {"source": "kurukoo-behaviour-pack", "policy": "behaviour_pack_os_scenario_contract_v1", "reviewed": True, "reviewedBy": "deterministic-behaviour-pack-policy", "automatedAdmission": True, "teacherGenerated": False, "productionUserData": False, "sourceScenarioId": row["exampleId"], "scenarioHash": row["scenarioHash"], "packVersion": pack["packVersion"], "packHash": pack["packHash"]},
        "quality": {"reviewed": True, "accepted": True, "assessmentBasis": "behaviour_pack_schema_truth_and_authority_contract", "scores": {"naturalness": 0.80, "contextRetention": 1.0, "goalRetention": 1.0, "actionDiscipline": 1.0, "truthfulness": 1.0, "safety": 1.0, "failureRecovery": 0.85, "hallucinationRate": 0.0, "prematureActionRate": 0.0}},
    }


def legacy_materialize(row: dict, pack: dict) -> dict:
    result = json.loads(json.dumps(row))
    result["exampleId"] = f"kurukoo-training-v2:legacy:{row.get('exampleId')}"
    result["datasetVersion"] = "kurukoo-training-v2"
    meta = legacy_metadata(row)
    result["metadata"] = {**meta, "scenarioType": meta.get("scenarioType") or meta.get("lifecycle") or "legacy_canonical_scenario"}
    result["tags"] = sorted(set((row.get("tags") or []) + ["legacy_revalidated", "behaviour_pack_compatible"]))
    result.setdefault("provenance", {})["legacy"] = {"sourceExampleId": row.get("exampleId"), "sourceDatasetVersion": row.get("datasetVersion"), "validatedAgainstPackVersion": pack["packVersion"], "validatedAgainstPackHash": pack["packHash"]}
    return result


def group_identity(row: dict) -> str:
    provenance = row.get("provenance") or {}
    return str(provenance.get("scenarioHash") or provenance.get("sourceScenarioId") or provenance.get("legacy", {}).get("sourceExampleId") or row["exampleId"])


def split(identity: str) -> str:
    bucket = int(hashlib.sha256(identity.encode("utf-8")).hexdigest()[:8], 16) % 100
    return "test" if bucket < 10 else "validation" if bucket < 20 else "train"


def content_hash(row: dict) -> str:
    return hashlib.sha256(json.dumps(row.get("messages") or [], sort_keys=True).encode("utf-8")).hexdigest()


def write_jsonl(path: pathlib.Path, rows: list[dict]) -> None:
    path.write_text("".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--legacy", default=str(DEFAULT_LEGACY))
    parser.add_argument("--pack", default=str(PACK))
    parser.add_argument("--os-scenarios", default=str(OS_ROWS))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()
    pack_path, legacy_path, os_path, output_dir = map(pathlib.Path, (args.pack, args.legacy, args.os_scenarios, args.output_dir))
    if not pack_path.exists(): raise SystemExit("Behaviour Pack missing; compile it before corpus reconciliation.")
    pack = json.loads(pack_path.read_text(encoding="utf-8"))
    valid_skills = {item["skill"] for item in pack.get("skills", [])}
    valid_capabilities = {item["capability"] for item in pack.get("capabilities", [])}
    if not valid_skills or not valid_capabilities or not pack.get("packHash"): raise SystemExit("Behaviour Pack is incomplete or missing its stable hash.")
    legacy_rows, os_rows = read_jsonl(legacy_path), read_jsonl(os_path)
    accepted_legacy, quarantine = [], Counter()
    for row in legacy_rows:
        ok, reason = legacy_admission(row, valid_skills, valid_capabilities)
        if ok: accepted_legacy.append(legacy_materialize(row, pack))
        else: quarantine[reason] += 1
    accepted_os = [os_materialize(row, pack) for row in os_rows if row.get("packHash") == pack["packHash"]]
    if len(accepted_os) != len(os_rows): raise SystemExit("OS scenario rows do not all match the current Behaviour Pack hash.")
    combined = accepted_legacy + accepted_os
    seen_content, deduplicated = set(), []
    duplicates = 0
    for row in combined:
        digest = content_hash(row)
        if digest in seen_content:
            duplicates += 1
            continue
        seen_content.add(digest)
        deduplicated.append(row)
    buckets = {name: [] for name in ("train", "validation", "test")}
    groups = {}
    for row in deduplicated:
        identity = group_identity(row)
        bucket = split(identity)
        groups.setdefault(identity, bucket)
        if groups[identity] != bucket: raise SystemExit("Split leakage: a source identity was assigned to multiple splits.")
        buckets[bucket].append(row)
    if not all(buckets.values()): raise SystemExit("Reconciled split is empty.")
    hashes = {name: {content_hash(row) for row in rows} for name, rows in buckets.items()}
    if hashes["train"] & hashes["validation"] or hashes["train"] & hashes["test"] or hashes["validation"] & hashes["test"]: raise SystemExit("Exact conversation leakage detected across splits.")
    output_dir.mkdir(parents=True, exist_ok=True)
    all_path = output_dir / "kurukoo-training-v2.all.jsonl"
    write_jsonl(all_path, deduplicated)
    for name, rows in buckets.items(): write_jsonl(output_dir / f"kurukoo-training-v2.{name}.jsonl", rows)
    group_selectors = {
        "golden": lambda row: "ordinary_conversation" in row.get("tags", []),
        "adversarial": lambda row: "adversarial" in row.get("tags", []),
        "agentic": lambda row: "agentic" in row.get("tags", []),
        "capability": lambda row: "capability_portfolio" in row.get("tags", []),
        "truth-boundary": lambda row: "truth_boundary" in row.get("tags", []),
        "cross-channel": lambda row: "cross_channel" in row.get("tags", []),
    }
    for name, selector in group_selectors.items(): write_jsonl(output_dir / f"kurukoo-training-v2.{name}.jsonl", [row for row in deduplicated if selector(row)])
    manifest = {
        "schemaVersion": 1, "datasetVersion": "kurukoo-training-v2", "generatedAt": datetime.now(timezone.utc).isoformat(),
        "packVersion": pack["packVersion"], "packHash": pack["packHash"], "legacy": {"input": str(legacy_path), "rowsSeen": len(legacy_rows), "accepted": len(accepted_legacy), "quarantined": sum(quarantine.values()), "quarantineReasons": dict(sorted(quarantine.items()))},
        "osDriven": {"input": str(os_path), "rowsSeen": len(os_rows), "accepted": len(accepted_os), "packMatched": True},
        "combined": {"beforeDeduplication": len(combined), "exactDuplicateConversations": duplicates, "acceptedRows": len(deduplicated), "splits": {name: {"rows": len(rows), "sha256": sha256(output_dir / f"kurukoo-training-v2.{name}.jsonl")} for name, rows in buckets.items()}, "allSha256": sha256(all_path)},
        "logicalGroups": {name: sum(1 for row in deduplicated if selector(row)) for name, selector in group_selectors.items()},
        "privacy": {"productionUserDataIncluded": False, "containsPersonalData": False, "teacherOutputTrustedAutomatically": False},
        "validation": {"currentBehaviourPackRequired": True, "exactConversationLeakage": False, "groupSplitLeakage": False, "canonicalExecutionAuthority": "canonical_domain_services", "status": "ready_for_guarded_training"},
    }
    manifest_path = output_dir / "kurukoo-training-v2.manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": manifest["validation"]["status"], "manifest": str(manifest_path), "legacy": manifest["legacy"], "osDriven": manifest["osDriven"], "combined": manifest["combined"], "logicalGroups": manifest["logicalGroups"]}, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
