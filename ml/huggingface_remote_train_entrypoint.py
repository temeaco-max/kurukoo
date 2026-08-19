#!/usr/bin/env python3
"""Remote Hugging Face Jobs wrapper for the existing canonical Student v1 trainer.

This wrapper is copied with the approved input bundle into a managed job. It does
not train a different model: it verifies the staged Corpus v2 and Behaviour Pack,
then invokes `train_smollm2_qlora.py`. Only after that trainer has emitted an
eligible candidate manifest does it persist the adapter to the configured private
Hugging Face model repository.
"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import subprocess
import sys
import time
from datetime import datetime, timezone

INPUT = pathlib.Path(os.environ.get("KURUKOO_TRAIN_INPUT_DIR", "/kurukoo-input"))
OUTPUT = pathlib.Path(os.environ.get("KURUKOO_TRAIN_OUTPUT", "/kurukoo-output/model"))
DATASET = INPUT / "accepted-train.jsonl"
CORPUS_MANIFEST = INPUT / "corpus-manifest.json"
CURATION_MANIFEST = INPUT / "curation-manifest.json"
PACK = INPUT / "behaviour-pack.json"
TRAINER = INPUT / "ml" / "train_smollm2_qlora.py"
EXPECTED_DATASET_HASH = os.environ.get("KURUKOO_TRAIN_EXPECTED_DATASET_SHA256", "").strip()
EXPECTED_PACK_HASH = os.environ.get("KURUKOO_TRAIN_EXPECTED_PACK_SHA256", "").strip()
ARTIFACT_REPO = os.environ.get("KURUKOO_HF_ARTIFACT_REPO", "").strip()
TOKEN = os.environ.get("HF_TOKEN", "").strip()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def tree_hash(directory: pathlib.Path, excluded: set[str] | None = None) -> str:
    digest = hashlib.sha256()
    excluded = excluded or set()
    for path in sorted(item for item in directory.rglob("*") if item.is_file()):
        name = path.relative_to(directory).as_posix()
        if name in excluded:
            continue
        digest.update(name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(sha256_file(path).encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def load(path: pathlib.Path, label: str) -> dict:
    if not path.exists():
        raise RuntimeError(f"{label} is missing")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError(f"{label} must be a JSON object")
    return payload


def verify_inputs() -> dict:
    if not EXPECTED_DATASET_HASH or not EXPECTED_PACK_HASH:
        raise RuntimeError("remote job was not given canonical dataset and Behaviour Pack hashes")
    actual_dataset_hash = sha256_file(DATASET)
    if actual_dataset_hash != EXPECTED_DATASET_HASH:
        raise RuntimeError("staged training dataset hash mismatch")
    corpus = load(CORPUS_MANIFEST, "reconciled corpus manifest")
    curation = load(CURATION_MANIFEST, "curation manifest")
    pack = load(PACK, "Behaviour Pack")
    train = ((corpus.get("combined") or {}).get("splits") or {}).get("train") or {}
    if train.get("sha256") != actual_dataset_hash or curation.get("outputSha256") != actual_dataset_hash:
        raise RuntimeError("staged corpus manifest does not match training dataset")
    if corpus.get("packHash") != EXPECTED_PACK_HASH or pack.get("packHash") != EXPECTED_PACK_HASH:
        raise RuntimeError("staged Behaviour Pack hash mismatch")
    if curation.get("status") != "ready_for_training" or curation.get("syntheticOnly") is not True:
        raise RuntimeError("staged curation evidence is not ready synthetic-only training material")
    privacy = corpus.get("privacy") or {}
    validation = corpus.get("validation") or {}
    if privacy.get("productionUserDataIncluded") is not False or validation.get("exactConversationLeakage") is not False or validation.get("groupSplitLeakage") is not False:
        raise RuntimeError("staged corpus does not satisfy privacy and leakage boundaries")
    return {"datasetHash": actual_dataset_hash, "packHash": pack.get("packHash"), "datasetRows": int(curation.get("acceptedRows", 0))}


def hardware() -> dict:
    import torch
    devices = []
    if torch.cuda.is_available():
        for index in range(torch.cuda.device_count()):
            props = torch.cuda.get_device_properties(index)
            devices.append({"index": index, "name": props.name, "memoryGiB": round(props.total_memory / (1024 ** 3), 2)})
    return {"acceleratorFlavor": os.environ.get("ACCELERATOR") or None, "cudaAvailable": bool(torch.cuda.is_available()), "cudaDevices": devices, "torchVersion": getattr(torch, "__version__", None)}


def publish_artifact(manifest: dict, evidence: dict, started: float) -> dict:
    if not TOKEN:
        raise RuntimeError("HF_TOKEN secret was not injected into the remote job")
    if not ARTIFACT_REPO:
        raise RuntimeError("KURUKOO_HF_ARTIFACT_REPO is required for durable trained artifact storage")
    from huggingface_hub import HfApi

    payload_hash = tree_hash(OUTPUT, excluded={"artifact-manifest.json"})
    remote = {
        "trainingBackend": "huggingface",
        "jobId": os.environ.get("JOB_ID") or None,
        "jobUrl": None,
        "behaviourPackHash": evidence["packHash"],
        "datasetHash": evidence["datasetHash"],
        "gpu": hardware(),
        "trainingStartedAt": datetime.fromtimestamp(started, tz=timezone.utc).isoformat(),
        "trainingCompletedAt": now(),
        "trainingDurationSeconds": round(time.monotonic() - started, 3),
        "estimatedCostUsd": os.environ.get("KURUKOO_HF_ESTIMATED_COST_USD") or None,
        "actualCostUsd": None,
        "artifactRepository": ARTIFACT_REPO,
        "artifactPayloadSha256": payload_hash,
        "baseModelRevision": os.environ.get("KURUKOO_SMOLLM2_BASE_MODEL_REVISION") or None,
        "tokenizerRevision": os.environ.get("KURUKOO_SMOLLM2_BASE_MODEL_REVISION") or None,
    }
    manifest["remoteTraining"] = remote
    manifest["artifactUri"] = f"hf://{ARTIFACT_REPO}"
    manifest["artifactHash"] = payload_hash
    manifest["studentVersion"] = "kurukoo-student-v1"
    manifest["datasetVersion"] = "kurukoo-training-v2"
    manifest["behaviourPackHash"] = evidence["packHash"]
    manifest["trainingBackend"] = "huggingface"
    (OUTPUT / "artifact-manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    api = HfApi(token=TOKEN, library_name="kurukoo-student-training")
    api.create_repo(repo_id=ARTIFACT_REPO, repo_type="model", private=True, exist_ok=True, token=TOKEN)
    payload_commit = api.upload_folder(repo_id=ARTIFACT_REPO, repo_type="model", folder_path=str(OUTPUT), commit_message="Upload Kurukoo Student v1 candidate artifact", token=TOKEN)
    payload_revision = str(getattr(payload_commit, "oid", "") or "")
    if not payload_revision:
        raise RuntimeError("Hugging Face did not return an immutable artifact payload revision")
    remote["artifactPayloadRevision"] = payload_revision
    remote["artifactUri"] = f"hf://{ARTIFACT_REPO}@{payload_revision}"
    manifest["artifactUri"] = remote["artifactUri"]
    (OUTPUT / "artifact-manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    manifest_commit = api.upload_file(
        path_or_fileobj=str(OUTPUT / "artifact-manifest.json"),
        path_in_repo="artifact-manifest.json",
        repo_id=ARTIFACT_REPO,
        repo_type="model",
        commit_message="Record immutable Kurukoo Student v1 training metadata",
        token=TOKEN,
    )
    manifest_revision = str(getattr(manifest_commit, "oid", "") or "")
    if not manifest_revision:
        raise RuntimeError("Hugging Face did not return an immutable artifact manifest revision")
    return {
        "repository": ARTIFACT_REPO,
        "payloadRevision": payload_revision,
        "manifestRevision": manifest_revision,
        "artifactUri": remote["artifactUri"],
        "artifactPayloadSha256": payload_hash,
        "manifestUri": f"hf://{ARTIFACT_REPO}@{manifest_revision}/artifact-manifest.json",
    }


def main() -> int:
    started = time.monotonic()
    result_path = OUTPUT.parent / "remote-job-result.json"
    try:
        evidence = verify_inputs()
        job_hardware = hardware()
        required = int(os.environ.get("KURUKOO_TRAIN_MIN_CUDA_MEMORY_GIB", "16"))
        if not any(float(device.get("memoryGiB", 0)) >= required for device in job_hardware["cudaDevices"]):
            raise RuntimeError(f"managed job hardware does not meet the {required} GiB CUDA requirement")
        env = os.environ.copy()
        env.update({
            "KURUKOO_ENABLE_TRAINING": "true",
            "KURUKOO_TRAIN_DATASET": str(DATASET),
            "KURUKOO_TRAIN_OUTPUT": str(OUTPUT),
            "KURUKOO_ALLOW_FULL_CPU_TRAINING": "false",
        })
        completed = subprocess.run([sys.executable, str(TRAINER)], env=env, text=True)
        if completed.returncode != 0:
            raise RuntimeError(f"canonical trainer exited with code {completed.returncode}")
        manifest_path = OUTPUT / "artifact-manifest.json"
        manifest = load(manifest_path, "canonical trainer artifact manifest")
        if manifest.get("status") != "trained_candidate" or manifest.get("runKind") == "feasibility_only" or manifest.get("registryEligible") is not True:
            raise RuntimeError("canonical trainer did not produce an eligible candidate artifact")
        if manifest.get("dataset_sha256") != evidence["datasetHash"]:
            raise RuntimeError("canonical artifact manifest dataset hash mismatch")
        published = publish_artifact(manifest, evidence, started)
        result = {"status": "completed", "completedAt": now(), "jobId": os.environ.get("JOB_ID") or None, "evidence": evidence, "hardware": job_hardware, "artifact": published}
        exit_code = 0
    except Exception as exc:
        result = {"status": "failed", "completedAt": now(), "jobId": os.environ.get("JOB_ID") or None, "reason": str(exc)}
        exit_code = 1
    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2, sort_keys=True))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
