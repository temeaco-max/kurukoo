#!/usr/bin/env python3
"""Regression coverage for guarded student-model lifecycle promotion."""
from __future__ import annotations

import argparse
import importlib.util
import json
import pathlib
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("kurukoo_model_registry", ROOT / "ml" / "model_registry.py")
assert spec and spec.loader
registry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(registry)
verify_spec = importlib.util.spec_from_file_location("kurukoo_verify_smollm2", ROOT / "ml" / "verify_smollm2_artifact.py")
assert verify_spec and verify_spec.loader
verifier = importlib.util.module_from_spec(verify_spec)
verify_spec.loader.exec_module(verifier)


def expect_blocked(callback, label: str) -> None:
    try:
        callback()
    except SystemExit:
        return
    raise AssertionError(f"{label} unexpectedly passed")


def evaluation(**overrides: float) -> dict:
    scores = {
        "truthfulness": 1.0,
        "safety": 1.0,
        "contextRetention": 1.0,
        "goalRetention": 1.0,
        "failureRecovery": 1.0,
        "actionDiscipline": 1.0,
        "hallucinationRate": 0.0,
        "prematureActionRate": 0.0,
        "latency": 1000,
        "cost": 0.001,
    }
    scores.update(overrides)
    return {"passed": True, "scores": scores, "source": "isolated-regression", "comparison": {"studentBeatsBase": True, "heldOutDatasetHash": "isolated-held-out-test-hash", "benchmarkVersion": "kurukoo-student-comparison-v1", "baseScores": {"truthfulness": 0.90}, "studentScores": {"truthfulness": 1.0}, "examinerResults": [{"provider": "isolated-regression", "model": "deterministic"}]}}


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = pathlib.Path(tmp)
        registry.REGISTRY_DIR = root / "registry"
        registry.INDEX = registry.REGISTRY_DIR / "index.json"
        manifest = root / "artifact-manifest.json"
        manifest.write_text(json.dumps({"status": "trained_candidate", "base_model": "HuggingFaceTB/SmolLM2-1.7B-Instruct", "artifactDirectory": str(root), "dataset_sha256": "test", "runtimeModel": None, "productionEnabled": False}))
        registry.register(argparse.Namespace(manifest=str(manifest), model_id="candidate-1"))
        feasibility_dir = root / "feasibility-only"
        feasibility_dir.mkdir()
        feasibility_manifest = feasibility_dir / "artifact-manifest.json"
        feasibility_manifest.write_text(json.dumps({"status": "feasibility_only", "runKind": "feasibility_only", "registryEligible": False, "candidateOnly": True, "promoted": False, "productionEnabled": False}))
        feasibility_dataset = root / "feasibility.jsonl"
        feasibility_dataset.write_text('{"scenarioId":"bounded-feasibility-probe"}\n')
        verifier.ARTIFACT = feasibility_dir
        verifier.DATASET = feasibility_dataset
        assert verifier.main() == 2, "verifier must reject feasibility-only artifacts"
        expect_blocked(lambda: registry.register(argparse.Namespace(manifest=str(feasibility_manifest), model_id="feasibility-must-not-register")), "feasibility-only registration")
        bad = root / "bad.json"
        bad.write_text(json.dumps(evaluation(hallucinationRate=0.2)))
        expect_blocked(lambda: registry.promote(argparse.Namespace(model_id="candidate-1", stage="shadow", evaluation=str(bad))), "high-hallucination promotion")
        missing = root / "missing.json"
        missing.write_text(json.dumps({"passed": True, "scores": {"truthfulness": 1.0}}))
        expect_blocked(lambda: registry.promote(argparse.Namespace(model_id="candidate-1", stage="shadow", evaluation=str(missing))), "incomplete evaluation promotion")
        no_comparison = root / "no-comparison.json"
        no_comparison.write_text(json.dumps({"passed": True, "scores": evaluation()["scores"]}))
        expect_blocked(lambda: registry.promote(argparse.Namespace(model_id="candidate-1", stage="shadow", evaluation=str(no_comparison))), "non-comparative evaluation promotion")
        good = root / "good.json"
        good.write_text(json.dumps(evaluation()))
        registry.promote(argparse.Namespace(model_id="candidate-1", stage="shadow", evaluation=str(good)))
        index = json.loads(registry.INDEX.read_text())
        assert index["models"][0]["stage"] == "shadow"
        assert index["models"][0]["productionEnabled"] is False
    print("Model-registry promotion regression passed: feasibility probes are rejected and explicit metrics, held-out base-versus-student superiority, and thresholds gate candidate advancement.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
