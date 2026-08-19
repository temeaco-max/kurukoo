#!/usr/bin/env python3
"""Run the canonical teacher adapters against the OS-driven Behaviour Pack corpus.

This remains a thin adapter: provider selection, model calls, JSON validation,
free-first routing and provenance stay in generate_trajectory_candidates.py.
Only the scenario shape and Behaviour Pack teaching context are adapted here.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import pathlib
import random
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
PACK_PATH = ROOT / "ml" / "behaviour" / "latest.json"
SCENARIO_PATH = ROOT / "ml" / "datasets" / "kurukoo-os-v1.all.jsonl"
TEACHER_MODULE_PATH = ROOT / "ml" / "teachers" / "generate_trajectory_candidates.py"

if not PACK_PATH.exists():
    raise SystemExit("Behaviour Pack missing. Run npx tsx scripts/compile-kurukoo-behaviour-pack.ts first.")
if not SCENARIO_PATH.exists():
    raise SystemExit("OS-driven scenarios missing. Run npx tsx scripts/compile-kurukoo-scenarios.ts first.")

pack = json.loads(PACK_PATH.read_text(encoding="utf-8"))

spec = importlib.util.spec_from_file_location("kurukoo_teacher", TEACHER_MODULE_PATH)
if spec is None or spec.loader is None:
    raise SystemExit("Unable to load the canonical teacher implementation.")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

behaviour_context = {
    "packVersion": pack.get("packVersion"),
    "packHash": pack.get("packHash"),
    "constitution": pack.get("constitution", {}),
    "behaviourFamilies": pack.get("behaviourFamilies", []),
    "truthBoundary": pack.get("truthBoundary", {}),
    "safetyBoundary": pack.get("safetyBoundary", {}),
    "activationStates": pack.get("activationStates", {}),
}


def load_os_rows():
    rows = []
    for line in SCENARIO_PATH.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        raw = json.loads(line)
        labels = raw.get("labels", {})
        messages = raw.get("messages", [])
        trajectory = [
            {"role": str(message.get("role") or "user"), "content": str(message.get("content") or "")}
            for message in messages
            if isinstance(message, dict) and str(message.get("content") or "").strip()
        ]
        rows.append({
            "scenarioId": raw.get("exampleId"),
            "skill": labels.get("skill"),
            "family": labels.get("family"),
            "lifecycleVariant": labels.get("behaviourFamily"),
            "lifecycle": labels.get("lifecycle"),
            "market": str(labels.get("locale") or "unknown").split(":", 1)[0],
            "locale": labels.get("locale"),
            "actor": labels.get("actor"),
            "channel": labels.get("channel"),
            "providerType": labels.get("mode"),
            "horizon": 1,
            "activeGoalCount": 1 if raw.get("state", {}).get("activeContext") else 0,
            "trajectory": trajectory,
            "packHash": raw.get("packHash"),
        })
    rng = random.Random(int(os.environ.get("KURUKOO_TEACHER_SEED", "42")))
    rng.shuffle(rows)
    limit = max(1, min(int(os.environ.get("KURUKOO_TEACHER_LIMIT", "25")), 500))
    return rows[:limit]


def candidate_id(row, index, provider, model):
    base = f"{row.get('scenarioId', index)}:{provider}:{model}:{os.environ.get('KURUKOO_TEACHER_SEED', '42')}:{pack.get('packHash', '')}"
    return hashlib.sha256(base.encode()).hexdigest()[:24]


module.SCENARIO_PATH = SCENARIO_PATH
module.load_rows = load_os_rows
module.candidate_id = candidate_id
module.SYSTEM = module.SYSTEM + "\n\nCURRENT KURUKOO BEHAVIOUR PACK (authoritative teaching context; do not expose internal labels to users):\n" + json.dumps(behaviour_context, separators=(",", ":"))

sys.exit(module.main())
