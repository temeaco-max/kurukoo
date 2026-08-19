#!/usr/bin/env python3
"""Run Kurukoo's guarded teacher -> curation -> training handoff.

The learning cycle starts from the OS itself: a versioned Behaviour Pack is compiled
from the canonical registries, then an OS-driven scenario dataset is compiled from
that pack before teacher generation/curation. External credentials, quotas and
compute remain deployment concerns; absent providers are recorded explicitly.
"""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
STATUS = ROOT / "artifacts" / "learning-cycle" / "latest.json"


def run(cmd: list[str], env: dict[str, str] | None = None) -> tuple[int, str]:
    print("$", " ".join(cmd))
    merged = os.environ.copy()
    if env:
        merged.update(env)
    proc = subprocess.run(cmd, cwd=ROOT, env=merged, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    print(proc.stdout)
    return proc.returncode, proc.stdout


def load_json(path: pathlib.Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def main() -> int:
    started = datetime.now(timezone.utc).isoformat()
    stages: list[dict] = []

    commands = [
        ("behaviour_pack_compilation", ["npx", "tsx", "scripts/compile-kurukoo-behaviour-pack.ts"]),
        ("behaviour_pack_validation", ["npx", "tsx", "scripts/test-kurukoo-behaviour-pack.ts"]),
        ("os_driven_scenario_compilation", ["npx", "tsx", "scripts/compile-kurukoo-scenarios.ts"]),
        ("os_driven_scenario_validation", ["npx", "tsx", "scripts/test-kurukoo-scenario-compiler.ts"]),
        ("scenario_generation", ["npm", "run", "scenario-lab:generate"]),
        ("behaviour_teacher_candidate_generation", ["python3", "ml/teachers/run_behaviour_teacher.py"]),
        ("teacher_candidate_import", ["npm", "run", "ml:import-teacher-candidates"]),
        ("teacher_evaluation", ["npm", "run", "benchmark:teacher"]),
        ("deterministic_golden_seed", ["npm", "run", "ml:seed-golden"]),
        ("corpus_curation", ["npm", "run", "ml:curate"]),
    ]
    for name, cmd in commands:
        code, output = run(cmd)
        stages.append({"stage": name, "exitCode": code, "outputTail": output[-2000:]})
        if code != 0:
            break

    pack = load_json(ROOT / "ml" / "behaviour" / "latest.json")
    scenario_manifest = load_json(ROOT / "ml" / "datasets" / "kurukoo-os-v1.manifest.json")
    corpus_manifest = load_json(ROOT / "ml" / "datasets" / "kurukoo-accepted-v1.manifest.json")
    accepted = int((corpus_manifest or {}).get("acceptedRows", 0))
    training_requested = os.environ.get("KURUKOO_ENABLE_TRAINING", "false").lower() == "true"

    if accepted == 0:
        stages.append({"stage": "training", "status": "blocked_no_accepted_examples", "acceptedRows": accepted})
    elif not training_requested:
        stages.append({"stage": "training", "status": "disabled", "acceptedRows": accepted})
    else:
        code, output = run(["python3", "ml/train_smollm2_qlora.py"])
        stages.append({"stage": "training", "exitCode": code, "outputTail": output[-3000:]})

    manifest = load_json(ROOT / "artifacts" / "smollm2-kurukoo-lora" / "artifact-manifest.json")
    registry_status = {"registered": False}
    if manifest and manifest.get("status") == "trained_candidate":
        code, output = run(["python3", "ml/model_registry.py", "register", "--manifest", str(ROOT / "artifacts" / "smollm2-kurukoo-lora" / "artifact-manifest.json")])
        registry_status = {"registered": code == 0, "exitCode": code, "outputTail": output[-2000:]}
    stages.append({"stage": "registry", **registry_status})

    failed_stages = [stage["stage"] for stage in stages if isinstance(stage.get("exitCode"), int) and stage["exitCode"] != 0]
    if failed_stages:
        final_status = "failed_stage"
    elif registry_status.get("registered"):
        final_status = "trained_candidate_registered"
    elif accepted == 0:
        final_status = "blocked_no_accepted_examples"
    elif not training_requested:
        final_status = "ready_for_training"
    else:
        final_status = "incomplete"

    final = {
        "schemaVersion": 2,
        "startedAt": started,
        "completedAt": datetime.now(timezone.utc).isoformat(),
        "providerMode": os.environ.get("KURUKOO_TEACHER_PROVIDER", "auto"),
        "freeFirst": os.environ.get("KURUKOO_TEACHER_FREE_FIRST", "true").lower() == "true",
        "behaviourPack": {"packVersion": (pack or {}).get("packVersion"), "packHash": (pack or {}).get("packHash")},
        "scenarioCompiler": {"datasetVersion": (scenario_manifest or {}).get("datasetVersion"), "manifestHash": (scenario_manifest or {}).get("manifestHash"), "exampleCount": (scenario_manifest or {}).get("exampleCount")},
        "acceptedRows": accepted,
        "trainingRequested": training_requested,
        "stages": stages,
        "status": final_status,
        "failedStages": failed_stages,
        "productionActivation": "never automatic; use guarded model registry promotion after independent evaluation",
    }
    STATUS.parent.mkdir(parents=True, exist_ok=True)
    STATUS.write_text(json.dumps(final, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(final, indent=2))
    return 0 if final["status"] in {"trained_candidate_registered", "ready_for_training"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
