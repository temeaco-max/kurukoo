#!/usr/bin/env python3
"""Verify a locally trained Kurukoo SmolLM2 adapter before registry review.

This is intentionally a gate, not a promotion mechanism. It checks that an
artifact exists, matches the training dataset hash, contains model/tokenizer
files and remains marked candidate-only. The canonical SmolLM2 registry still
owns approval, shadow/canary and production promotion.
"""
import hashlib
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
ARTIFACT = pathlib.Path(os.environ.get(
    "KURUKOO_SMOLLM2_ARTIFACT",
    str(ROOT / "artifacts" / "smollm2-kurukoo-lora"),
))
DATASET = pathlib.Path(os.environ.get(
    "KURUKOO_TRAIN_DATASET",
    str(ROOT / "ml" / "datasets" / "kurukoo-accepted-v1.jsonl"),
))
EVAL = os.environ.get("KURUKOO_SMOLLM2_EVAL_SUMMARY")
MIN_NATURALNESS = float(os.environ.get("KURUKOO_SMOLLM2_MIN_NATURALNESS", "0.80"))
MIN_CONTEXT = float(os.environ.get("KURUKOO_SMOLLM2_MIN_CONTEXT_RETENTION", "0.80"))
MAX_PREMATURE_ACTION = float(os.environ.get("KURUKOO_SMOLLM2_MAX_PREMATURE_ACTION", "0.15"))
EXPECTED_PACK_HASH = os.environ.get("KURUKOO_TRAIN_EXPECTED_PACK_SHA256", "e0883f4a630d57f7cf7b78415fa0a7bf017189c3adfe04cef4bbdb5267969715").strip()


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fail(reason):
    print(json.dumps({"status": "ineligible_for_registry_review", "reason": reason}, indent=2))
    return 2


def main():
    if not ARTIFACT.exists():
        return fail(f"artifact directory does not exist: {ARTIFACT}")
    if not DATASET.exists():
        return fail(f"accepted training dataset does not exist: {DATASET}")
    if DATASET.stat().st_size == 0:
        return fail("accepted training dataset is empty; no explicitly approved examples exist")

    manifest_path = ARTIFACT / "artifact-manifest.json"
    if not manifest_path.exists():
        return fail("artifact-manifest.json is missing")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    if manifest.get("runKind") == "feasibility_only" or manifest.get("status") == "feasibility_only" or manifest.get("registryEligible") is False:
        return fail("feasibility-only artifact is not eligible for registry review")
    if manifest.get("candidateOnly") is not True or manifest.get("promoted") is not False or manifest.get("productionEnabled") is not False:
        return fail("artifact manifest is not explicitly candidate-only")

    dataset_hash = sha256(DATASET)
    if manifest.get("dataset_sha256") != dataset_hash:
        return fail("artifact was trained against a different dataset hash")
    if manifest.get("trainingBackend") == "huggingface":
        remote = manifest.get("remoteTraining") or {}
        required_remote = ("trainingBackend", "jobId", "behaviourPackHash", "datasetHash", "gpu", "trainingStartedAt", "trainingCompletedAt", "trainingDurationSeconds", "artifactRepository", "artifactPayloadSha256", "baseModelRevision", "tokenizerRevision")
        missing_remote = [key for key in required_remote if remote.get(key) in (None, "", {})]
        if missing_remote:
            return fail("remote artifact manifest is missing provenance: " + ", ".join(missing_remote))
        if remote.get("trainingBackend") != "huggingface" or remote.get("datasetHash") != dataset_hash or remote.get("behaviourPackHash") != EXPECTED_PACK_HASH:
            return fail("remote artifact provenance does not match the canonical training contract")
        if not isinstance(remote.get("gpu"), dict) or not remote["gpu"].get("cudaDevices"):
            return fail("remote artifact manifest does not prove CUDA hardware")
        if not isinstance(manifest.get("artifactUri"), str) or not manifest.get("artifactUri").startswith("hf://") or not isinstance(manifest.get("artifactHash"), str):
            return fail("remote artifact manifest is missing immutable artifact identity")

    required = ["adapter_config.json", "adapter_model.safetensors"]
    missing = [name for name in required if not (ARTIFACT / name).exists()]
    if missing:
        return fail(f"missing adapter files: {', '.join(missing)}")
    if not ((ARTIFACT / "tokenizer.json").exists() or (ARTIFACT / "tokenizer_config.json").exists()):
        return fail("tokenizer artifact is missing")

    evaluation = None
    if EVAL:
        eval_path = pathlib.Path(EVAL)
        if not eval_path.exists():
            return fail(f"evaluation summary not found: {eval_path}")
        evaluation = json.loads(eval_path.read_text(encoding="utf-8"))
        means = evaluation.get("means", {})
        naturalness = float(means.get("naturalness", 0))
        context = float(means.get("contextRetention", 0))
        premature = float(means.get("prematureActionRate", 1))
        if naturalness < MIN_NATURALNESS:
            return fail(f"naturalness {naturalness:.3f} is below {MIN_NATURALNESS:.3f}")
        if context < MIN_CONTEXT:
            return fail(f"contextRetention {context:.3f} is below {MIN_CONTEXT:.3f}")
        if premature > MAX_PREMATURE_ACTION:
            return fail(f"prematureActionRate {premature:.3f} exceeds {MAX_PREMATURE_ACTION:.3f}")

    result = {
        "status": "eligible_for_registry_review",
        "artifact": str(ARTIFACT),
        "baseModel": manifest.get("base_model"),
        "datasetSha256": dataset_hash,
        "evaluationProvided": evaluation is not None,
        "registryPromotion": "not performed by this verifier",
        "productionActivation": "not performed by this verifier",
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
