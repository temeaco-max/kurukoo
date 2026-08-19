#!/usr/bin/env python3
"""Hugging Face Jobs backend for the canonical Kurukoo Student v1 trainer.

This module does not implement another training algorithm. It validates the existing
accepted Corpus v2, syncs that exact data and the canonical trainer to Hugging Face
Jobs, and launches `ml/train_smollm2_qlora.py` remotely. Remote Jobs are pay-as-you-go;
therefore launch additionally requires both a bounded estimate and an explicit
operator approval environment flag. Secrets are passed only through the provider's
encrypted Jobs-secret channel and never written to manifests or logs.
"""
from __future__ import annotations

import argparse
import dataclasses
import hashlib
import json
import math
import os
import pathlib
import re
import shutil
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable, Protocol

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_DATASET_HASH = "b8ec82700f5817ec23702d21b2f8f869ffef393f5b7109ffd1bb83e20f05ff02"
DEFAULT_PACK_HASH = "e0883f4a630d57f7cf7b78415fa0a7bf017189c3adfe04cef4bbdb5267969715"
TERMINAL_STAGES = {"COMPLETED", "CANCELED", "ERROR", "DELETED"}
ACTIVE_STAGES = {"SCHEDULING", "RUNNING"}


class BackendError(RuntimeError):
    """Expected fail-closed remote backend error."""


@dataclass(frozen=True)
class BackendConfig:
    root: pathlib.Path
    backend: str
    dataset: pathlib.Path
    corpus_manifest: pathlib.Path
    curation_manifest: pathlib.Path
    behaviour_pack: pathlib.Path
    expected_dataset_hash: str
    expected_pack_hash: str
    base_model: str
    base_model_revision: str | None
    output_root: pathlib.Path
    artifact_repo: str | None
    min_gpu_memory_gib: int
    timeout_seconds: int
    max_estimated_cost_usd: float | None
    image: str
    run_kind: str

    @classmethod
    def from_env(cls, root: pathlib.Path = ROOT) -> "BackendConfig":
        backend = os.environ.get("KURUKOO_TRAINING_BACKEND", "local_cuda").strip().lower()
        if backend not in {"local_cuda", "huggingface"}:
            raise BackendError("KURUKOO_TRAINING_BACKEND must be local_cuda or huggingface")
        dataset = pathlib.Path(os.environ.get("KURUKOO_TRAIN_DATASET", str(root / "ml/datasets/kurukoo-training-v2.accepted.train.jsonl"))).expanduser()
        corpus_manifest = pathlib.Path(os.environ.get("KURUKOO_TRAIN_CORPUS_MANIFEST", str(root / "ml/datasets/kurukoo-training-v2.manifest.json"))).expanduser()
        curation_manifest = pathlib.Path(os.environ.get("KURUKOO_TRAIN_CURATION_MANIFEST", str(root / "ml/datasets/kurukoo-training-v2.accepted.train.manifest.json"))).expanduser()
        behaviour_pack = pathlib.Path(os.environ.get("KURUKOO_BEHAVIOUR_PACK", str(root / "ml/behaviour/latest.json"))).expanduser()
        output_root = pathlib.Path(os.environ.get("KURUKOO_HF_JOB_STATE_DIR", str(root / "ml/artifacts/kurukoo-smollm2-v1/remote"))).expanduser()
        timeout = int(os.environ.get("KURUKOO_HF_TRAIN_TIMEOUT_SECONDS", "14400"))
        if timeout < 60 or timeout > 43200:
            raise BackendError("KURUKOO_HF_TRAIN_TIMEOUT_SECONDS must be between 60 and 43200")
        cap_raw = os.environ.get("KURUKOO_HF_MAX_ESTIMATED_COST_USD", "").strip()
        cap = float(cap_raw) if cap_raw else None
        if cap is not None and (not math.isfinite(cap) or cap <= 0):
            raise BackendError("KURUKOO_HF_MAX_ESTIMATED_COST_USD must be a positive finite number")
        return cls(
            root=root,
            backend=backend,
            dataset=dataset,
            corpus_manifest=corpus_manifest,
            curation_manifest=curation_manifest,
            behaviour_pack=behaviour_pack,
            expected_dataset_hash=os.environ.get("KURUKOO_TRAIN_EXPECTED_DATASET_SHA256", DEFAULT_DATASET_HASH).strip(),
            expected_pack_hash=os.environ.get("KURUKOO_TRAIN_EXPECTED_PACK_SHA256", DEFAULT_PACK_HASH).strip(),
            base_model=os.environ.get("KURUKOO_SMOLLM2_BASE_MODEL", "HuggingFaceTB/SmolLM2-1.7B-Instruct").strip(),
            base_model_revision=os.environ.get("KURUKOO_SMOLLM2_BASE_MODEL_REVISION", "").strip() or None,
            output_root=output_root,
            artifact_repo=os.environ.get("KURUKOO_HF_ARTIFACT_REPO", "").strip() or None,
            min_gpu_memory_gib=max(1, int(os.environ.get("KURUKOO_TRAIN_MIN_CUDA_MEMORY_GIB", "16"))),
            timeout_seconds=timeout,
            max_estimated_cost_usd=cap,
            image=os.environ.get("KURUKOO_HF_JOB_IMAGE", "pytorch/pytorch:2.6.0-cuda12.4-cudnn9-devel").strip(),
            run_kind=os.environ.get("KURUKOO_TRAIN_RUN_KIND", "student_candidate").strip().lower(),
        )


@dataclass(frozen=True)
class HardwareOption:
    flavor: str
    accelerator: str
    memory_gib: float
    cost_per_hour_usd: float | None
    raw: dict[str, Any]


class JobsProvider(Protocol):
    def whoami(self) -> dict[str, Any]: ...
    def model_revision(self, model: str, requested_revision: str | None) -> str: ...
    def list_hardware(self) -> Iterable[Any]: ...
    def sync_input(self, local_dir: pathlib.Path, mount_path: str, read_only: bool) -> Any: ...
    def launch(self, *, image: str, command: list[str], flavor: str, timeout: int, volumes: list[Any], env: dict[str, str], secrets: dict[str, str], labels: dict[str, str]) -> Any: ...
    def inspect(self, job_id: str) -> Any: ...
    def cancel(self, job_id: str) -> Any: ...
    def download_snapshot(self, repo_id: str, revision: str, destination: pathlib.Path) -> str: ...
    def sync_output(self, volume: dict[str, Any], destination: pathlib.Path) -> str: ...


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: pathlib.Path, label: str) -> dict[str, Any]:
    if not path.exists():
        raise BackendError(f"{label} not found: {path}")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise BackendError(f"{label} is not valid JSON: {path}") from exc
    if not isinstance(payload, dict):
        raise BackendError(f"{label} must be a JSON object: {path}")
    return payload


def accepted_rows(path: pathlib.Path) -> int:
    count = 0
    try:
        from train_smollm2_qlora import assert_explicitly_accepted, read_rows
    except ImportError:
        from ml.train_smollm2_qlora import assert_explicitly_accepted, read_rows
    try:
        rows = read_rows(path)
        assert_explicitly_accepted(rows)
    except Exception as exc:
        raise BackendError(f"approved-corpus verification failed: {exc}") from exc
    count = len(rows)
    if count < 1000:
        raise BackendError(f"refusing remote full-corpus job for only {count} accepted rows")
    return count


def preflight(config: BackendConfig) -> dict[str, Any]:
    if config.backend not in {"local_cuda", "huggingface"}:
        raise BackendError("unsupported training backend")
    if not config.dataset.exists():
        raise BackendError(f"accepted training dataset not found: {config.dataset}")
    actual_dataset_hash = sha256_file(config.dataset)
    if actual_dataset_hash != config.expected_dataset_hash:
        raise BackendError("accepted training dataset hash does not match the configured canonical hash")
    corpus = load_json(config.corpus_manifest, "reconciled corpus manifest")
    curation = load_json(config.curation_manifest, "curation manifest")
    pack = load_json(config.behaviour_pack, "Behaviour Pack")
    if corpus.get("datasetVersion") != "kurukoo-training-v2":
        raise BackendError("reconciled corpus manifest is not Kurukoo Training Corpus v2")
    corpus_train = ((corpus.get("combined") or {}).get("splits") or {}).get("train") or {}
    if corpus_train.get("sha256") != actual_dataset_hash:
        raise BackendError("reconciled corpus train split hash does not match the accepted training dataset")
    if corpus.get("packHash") != config.expected_pack_hash or pack.get("packHash") != config.expected_pack_hash:
        raise BackendError("Behaviour Pack hash does not match the configured canonical hash")
    if curation.get("status") != "ready_for_training":
        raise BackendError("curation manifest is not ready_for_training")
    if curation.get("outputSha256") != actual_dataset_hash:
        raise BackendError("curation manifest hash does not match the accepted training dataset")
    if curation.get("syntheticOnly") is not True:
        raise BackendError("curation manifest does not prove a synthetic-only training corpus")
    if curation.get("teacherOutputTrustedAutomatically") is not False:
        raise BackendError("curation manifest does not preserve the teacher-review boundary")
    privacy = corpus.get("privacy") or {}
    if privacy.get("productionUserDataIncluded") is not False:
        raise BackendError("corpus does not prove production user data exclusion")
    validation = corpus.get("validation") or {}
    if validation.get("exactConversationLeakage") is not False or validation.get("groupSplitLeakage") is not False:
        raise BackendError("corpus does not prove train/test leakage prevention")
    rows = accepted_rows(config.dataset)
    if int(curation.get("acceptedRows", 0)) != rows:
        raise BackendError("curation accepted-row count does not match the accepted training dataset")
    return {
        "schemaVersion": 1,
        "status": "ready_for_remote_submission",
        "trainingBackend": config.backend,
        "dataset": str(config.dataset),
        "datasetHash": actual_dataset_hash,
        "datasetRows": rows,
        "datasetVersion": corpus.get("datasetVersion"),
        "behaviourPack": {"path": str(config.behaviour_pack), "version": pack.get("packVersion"), "hash": pack.get("packHash")},
        "corpusValidation": {"exactConversationLeakage": validation.get("exactConversationLeakage"), "groupSplitLeakage": validation.get("groupSplitLeakage"), "productionUserDataIncluded": privacy.get("productionUserDataIncluded")},
        "curation": {"acceptedRows": curation.get("acceptedRows"), "rejectedRows": curation.get("rejectedRows"), "status": curation.get("status")},
        "baseModel": config.base_model,
        "baseModelRevision": config.base_model_revision,
        "minimumGpuMemoryGiB": config.min_gpu_memory_gib,
        "timeoutSeconds": config.timeout_seconds,
        "generatedAt": now(),
    }


def object_map(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if dataclasses.is_dataclass(value):
        return dataclasses.asdict(value)
    result: dict[str, Any] = {}
    for name in ("name", "flavor", "accelerator", "gpu", "memory", "memory_gib", "gpu_memory_gib", "cost_per_hour", "cost_per_hour_usd", "price", "hourly_price"):
        if hasattr(value, name):
            result[name] = getattr(value, name)
    if not result and hasattr(value, "__dict__"):
        result = dict(value.__dict__)
    return result


def parse_float(value: Any) -> float | None:
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    if isinstance(value, str):
        match = re.search(r"\$?\s*(\d+(?:\.\d+)?)", value)
        if match:
            return float(match.group(1))
    return None


def memory_from_hardware(raw: dict[str, Any]) -> float:
    for key in ("memory_gib", "gpu_memory_gib", "vram_gib", "memoryGiB"):
        parsed = parse_float(raw.get(key))
        if parsed is not None:
            return parsed
    accelerator_raw = raw.get("accelerator") or raw.get("gpu") or ""
    accelerator = str(accelerator_raw.get("vram") if isinstance(accelerator_raw, dict) else accelerator_raw)
    match = re.search(r"(\d+(?:\.\d+)?)\s*(?:G(?:i)?B|GB)", accelerator, flags=re.I)
    return float(match.group(1)) if match else 0.0


def normalize_hardware(item: Any) -> HardwareOption:
    raw = object_map(item)
    flavor = str(raw.get("name") or raw.get("flavor") or "").strip()
    if not flavor:
        raise BackendError("Hugging Face hardware discovery returned an option without a flavor name")
    accelerator_raw = raw.get("accelerator") or raw.get("gpu") or ""
    accelerator_map = accelerator_raw if isinstance(accelerator_raw, dict) else {}
    accelerator = " ".join(str(part) for part in (accelerator_map.get("manufacturer"), accelerator_map.get("model"), accelerator_map.get("quantity"), accelerator_map.get("vram")) if part) or str(accelerator_raw).strip()
    cost = None
    for key in ("cost_per_hour_usd", "cost_per_hour", "hourly_price", "price"):
        cost = parse_float(raw.get(key))
        if cost is not None:
            break
    if cost is None:
        unit_cost = parse_float(raw.get("unit_cost_usd"))
        unit_label = str(raw.get("unit_label") or "").strip().lower()
        multiplier = {"second": 3600, "seconds": 3600, "minute": 60, "minutes": 60, "hour": 1, "hours": 1}.get(unit_label)
        if unit_cost is not None and multiplier is not None:
            cost = unit_cost * multiplier
    return HardwareOption(flavor=flavor, accelerator=accelerator, memory_gib=memory_from_hardware(raw), cost_per_hour_usd=cost, raw=raw)


def choose_hardware(items: Iterable[Any], required_memory_gib: int) -> HardwareOption:
    compatible = [normalize_hardware(item) for item in items]
    compatible = [item for item in compatible if item.memory_gib >= required_memory_gib and item.cost_per_hour_usd is not None]
    if not compatible:
        raise BackendError("no discovered Hugging Face GPU option has both the required VRAM and a comparable hourly price")
    return sorted(compatible, key=lambda item: (float(item.cost_per_hour_usd or math.inf), item.memory_gib, item.flavor))[0]


def environment_token() -> str | None:
    for name in ("HF_TOKEN", "HUGGINGFACE_API_KEY", "HUGGINGFACEHUB_API_TOKEN"):
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return None


class HuggingFaceJobsProvider:
    """Thin, lazy adapter around the supported huggingface_hub Jobs API."""

    def __init__(self, token: str):
        try:
            import huggingface_hub as hub
        except ImportError as exc:
            raise BackendError("huggingface_hub>=1.8 is required for KURUKOO_TRAINING_BACKEND=huggingface") from exc
        self.hub = hub
        self.token = token
        self.api = hub.HfApi(token=token, library_name="kurukoo-student-training")

    def whoami(self) -> dict[str, Any]:
        result = self.api.whoami(token=self.token)
        return result if isinstance(result, dict) else object_map(result)

    def model_revision(self, model: str, requested_revision: str | None) -> str:
        info = self.api.model_info(model, revision=requested_revision, token=self.token)
        revision = getattr(info, "sha", None) or object_map(info).get("sha")
        if not isinstance(revision, str) or not revision.strip():
            raise BackendError("Hugging Face did not return an immutable base-model revision")
        return revision.strip()

    def list_hardware(self) -> Iterable[Any]:
        method = getattr(self.api, "list_jobs_hardware", None) or getattr(self.hub, "list_jobs_hardware", None)
        if method is None:
            raise BackendError("installed huggingface_hub does not expose Jobs hardware discovery")
        return method(token=self.token)

    def sync_input(self, local_dir: pathlib.Path, mount_path: str, read_only: bool) -> Any:
        method = getattr(self.hub, "sync_job_volume", None)
        if method is None:
            raise BackendError("installed huggingface_hub does not expose sync_job_volume")
        try:
            return method(local_dir, mount_path, read_only=read_only, token=self.token)
        except TypeError:
            return method(local_dir, mount_path, read_only=read_only)

    def launch(self, **kwargs: Any) -> Any:
        method = getattr(self.api, "run_job", None) or getattr(self.hub, "run_job", None)
        if method is None:
            raise BackendError("installed huggingface_hub does not expose run_job")
        return method(token=self.token, **kwargs)

    def inspect(self, job_id: str) -> Any:
        method = getattr(self.api, "inspect_job", None) or getattr(self.hub, "inspect_job", None)
        return method(job_id=job_id, token=self.token)

    def cancel(self, job_id: str) -> Any:
        method = getattr(self.api, "cancel_job", None) or getattr(self.hub, "cancel_job", None)
        return method(job_id=job_id, token=self.token)

    def download_snapshot(self, repo_id: str, revision: str, destination: pathlib.Path) -> str:
        method = getattr(self.hub, "snapshot_download", None)
        if method is None:
            raise BackendError("installed huggingface_hub does not expose snapshot_download")
        return str(method(repo_id=repo_id, revision=revision, local_dir=str(destination), token=self.token))

    def sync_output(self, volume: dict[str, Any], destination: pathlib.Path) -> str:
        source = str(volume.get("source") or "").strip()
        path = str(volume.get("path") or "").strip().strip("/")
        if not source:
            raise BackendError("remote output volume did not retain a Hugging Face bucket source")
        method = getattr(self.hub, "sync_bucket", None)
        if method is None:
            raise BackendError("installed huggingface_hub does not expose sync_bucket")
        uri = f"hf://buckets/{source}" + (f"/{path}" if path else "")
        destination.mkdir(parents=True, exist_ok=True)
        try:
            return str(method(uri, str(destination), token=self.token))
        except TypeError:
            return str(method(uri, str(destination)))


def job_value(job: Any, *names: str) -> Any:
    if isinstance(job, dict):
        for name in names:
            if name in job:
                return job[name]
    for name in names:
        if hasattr(job, name):
            return getattr(job, name)
    return None


def job_status(job: Any) -> tuple[str | None, str | None]:
    status = job_value(job, "status")
    if isinstance(status, dict):
        return str(status.get("stage") or "") or None, status.get("message")
    return (str(getattr(status, "stage", "")) or None, getattr(status, "message", None))


def volume_record(volume: Any) -> dict[str, Any]:
    raw = object_map(volume)
    return {"type": raw.get("type"), "source": raw.get("source"), "path": raw.get("path"), "mountPath": raw.get("mount_path") or raw.get("mountPath"), "readOnly": raw.get("read_only") if "read_only" in raw else raw.get("readOnly")}


def safe_job_record(job: Any) -> dict[str, Any]:
    stage, message = job_status(job)
    return {
        "jobId": job_value(job, "id"),
        "jobUrl": job_value(job, "url"),
        "stage": stage,
        "message": message,
        "flavor": job_value(job, "flavor"),
        "createdAt": str(job_value(job, "created_at", "createdAt") or "") or None,
        "startedAt": str(job_value(job, "started_at", "startedAt") or "") or None,
        "finishedAt": str(job_value(job, "finished_at", "finishedAt") or "") or None,
        "durations": object_map(job_value(job, "durations")) if job_value(job, "durations") is not None else None,
    }


def write_json(path: pathlib.Path, payload: dict[str, Any]) -> pathlib.Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path


def stage_remote_input(config: BackendConfig, evidence: dict[str, Any]) -> pathlib.Path:
    staging = pathlib.Path(tempfile.mkdtemp(prefix="kurukoo-hf-job-input-"))
    try:
        (staging / "ml").mkdir(parents=True, exist_ok=True)
        for source in ("train_smollm2_qlora.py", "huggingface_remote_train_entrypoint.py", "requirements-smollm2.txt"):
            shutil.copy2(config.root / "ml" / source, staging / "ml" / source)
        shutil.copy2(config.dataset, staging / "accepted-train.jsonl")
        shutil.copy2(config.corpus_manifest, staging / "corpus-manifest.json")
        shutil.copy2(config.curation_manifest, staging / "curation-manifest.json")
        shutil.copy2(config.behaviour_pack, staging / "behaviour-pack.json")
        write_json(staging / "submission-preflight.json", evidence)
        return staging
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def launch_remote(config: BackendConfig, provider: JobsProvider) -> dict[str, Any]:
    if config.backend != "huggingface":
        raise BackendError("launch_remote requires KURUKOO_TRAINING_BACKEND=huggingface")
    if os.environ.get("FF_HUGGINGFACE_JOBS", "false").lower() != "true":
        raise BackendError("remote launch requires FF_HUGGINGFACE_JOBS=true")
    if os.environ.get("KURUKOO_REMOTE_TRAINING_LAUNCH_APPROVED", "false").lower() != "true":
        raise BackendError("remote launch requires KURUKOO_REMOTE_TRAINING_LAUNCH_APPROVED=true")
    if config.max_estimated_cost_usd is None:
        raise BackendError("remote launch requires KURUKOO_HF_MAX_ESTIMATED_COST_USD to bound billable GPU use")
    if config.run_kind != "student_candidate":
        raise BackendError("remote full-corpus launch only permits KURUKOO_TRAIN_RUN_KIND=student_candidate")
    evidence = preflight(config)
    identity = provider.whoami()
    owner = str(identity.get("name") or identity.get("fullname") or "").strip()
    if not owner:
        raise BackendError("Hugging Face credential validation did not return an account name")
    base_revision = provider.model_revision(config.base_model, config.base_model_revision)
    selected = choose_hardware(provider.list_hardware(), config.min_gpu_memory_gib)
    estimate = float(selected.cost_per_hour_usd or 0) * config.timeout_seconds / 3600
    if estimate > config.max_estimated_cost_usd:
        raise BackendError(f"estimated remote GPU cost ${estimate:.2f} exceeds configured cap ${config.max_estimated_cost_usd:.2f}")
    artifact_repo = config.artifact_repo or f"{owner}/kurukoo-student-v1"
    evidence.update({
        "baseModelRevision": base_revision,
        "artifactRepo": artifact_repo,
        "selectedHardware": dataclasses.asdict(selected),
        "estimatedCostUsd": round(estimate, 6),
        "account": owner,
        "launchApproval": "explicit_environment_flag",
    })
    staging = stage_remote_input(config, evidence)
    try:
        input_volume = provider.sync_input(staging, "/kurukoo-input", read_only=True)
        output_seed = pathlib.Path(tempfile.mkdtemp(prefix="kurukoo-hf-job-output-"))
        try:
            output_volume = provider.sync_input(output_seed, "/kurukoo-output", read_only=False)
        finally:
            shutil.rmtree(output_seed, ignore_errors=True)
        command = [
            "bash", "-lc",
            "set -euo pipefail; "
            "python3 -m pip install --no-cache-dir -r /kurukoo-input/ml/requirements-smollm2.txt 'huggingface_hub>=1.8'; "
            "PYTHONPATH=/kurukoo-input/ml python3 /kurukoo-input/ml/huggingface_remote_train_entrypoint.py",
        ]
        env = {
            "KURUKOO_TRAIN_INPUT_DIR": "/kurukoo-input",
            "KURUKOO_TRAIN_OUTPUT": "/kurukoo-output/model",
            "KURUKOO_ENABLE_TRAINING": "true",
            "KURUKOO_TRAIN_RUN_KIND": config.run_kind,
            "KURUKOO_SMOLLM2_BASE_MODEL": config.base_model,
            "KURUKOO_SMOLLM2_BASE_MODEL_REVISION": base_revision,
            "KURUKOO_TRAIN_EXPECTED_DATASET_SHA256": evidence["datasetHash"],
            "KURUKOO_TRAIN_EXPECTED_PACK_SHA256": evidence["behaviourPack"]["hash"],
            "KURUKOO_HF_ARTIFACT_REPO": artifact_repo,
            "KURUKOO_HF_JOB_TIMEOUT_SECONDS": str(config.timeout_seconds),
            "KURUKOO_HF_ESTIMATED_COST_USD": str(round(estimate, 6)),
            "KURUKOO_TRAIN_MIN_CUDA_MEMORY_GIB": str(config.min_gpu_memory_gib),
        }
        for name in ("KURUKOO_TRAIN_MAX_LENGTH", "KURUKOO_TRAIN_EPOCHS", "KURUKOO_TRAIN_BATCH_SIZE", "KURUKOO_TRAIN_GRAD_ACCUM", "KURUKOO_TRAIN_LR", "KURUKOO_TRAIN_4BIT", "KURUKOO_TRAIN_SEED"):
            if os.environ.get(name):
                env[name] = os.environ[name]
        labels = {"name": "kurukoo-student-v1-train", "dataset": evidence["datasetHash"][:12], "behaviour-pack": evidence["behaviourPack"]["hash"][:12], "run-kind": config.run_kind}
        job = provider.launch(image=config.image, command=command, flavor=selected.flavor, timeout=config.timeout_seconds, volumes=[input_volume, output_volume], env=env, secrets={"HF_TOKEN": environment_token() or ""}, labels=labels)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    record = {
        "schemaVersion": 1,
        "status": "submitted",
        "submittedAt": now(),
        "trainingBackend": "huggingface",
        "preflight": evidence,
        "job": safe_job_record(job),
        "artifact": {"repository": artifact_repo, "runtimeModel": None, "retrievalRequired": True},
        "outputVolume": volume_record(output_volume),
        "cleanup": {"onError": "cancel active job", "onIntegrityFailure": "cancel active job", "terminalStages": sorted(TERMINAL_STAGES)},
    }
    job_id = record["job"].get("jobId")
    if not isinstance(job_id, str) or not job_id:
        raise BackendError("Hugging Face launch did not return a job ID")
    write_json(config.output_root / f"{job_id}.json", record)
    write_json(config.output_root / "latest.json", record)
    return record


def locate_job_manifest(config: BackendConfig, job_id: str) -> pathlib.Path:
    path = config.output_root / f"{job_id}.json"
    if not path.exists():
        raise BackendError(f"remote job state manifest not found: {path}")
    return path


def monitor_job(config: BackendConfig, provider: JobsProvider, job_id: str) -> dict[str, Any]:
    path = locate_job_manifest(config, job_id)
    record = load_json(path, "remote job state manifest")
    job = provider.inspect(job_id)
    observed = safe_job_record(job)
    record["job"] = observed
    record["checkedAt"] = now()
    stage = observed.get("stage")
    selected = ((record.get("preflight") or {}).get("selectedHardware") or {})
    estimated = (record.get("preflight") or {}).get("estimatedCostUsd")
    durations = observed.get("durations") or {}
    running_seconds = parse_float(durations.get("running_secs") or durations.get("runningSeconds") or durations.get("total_secs") or durations.get("totalSeconds"))
    hourly = parse_float(selected.get("cost_per_hour_usd"))
    record["cost"] = {"estimatedCostUsd": estimated, "actualDurationSeconds": running_seconds, "actualCostUsd": round(hourly * running_seconds / 3600, 6) if hourly is not None and running_seconds is not None else None, "actualCostSource": "provider-reported duration × selected provider price" if hourly is not None and running_seconds is not None else "provider billing value unavailable"}
    if stage in TERMINAL_STAGES:
        record["status"] = "completed" if stage == "COMPLETED" else "terminal_failure"
        if stage != "COMPLETED":
            record["cleanupEvent"] = {"observedAt": now(), "reason": "provider returned terminal failure", "cancelInvoked": False, "detail": "not required because the provider reports the job is already terminal"}
    elif stage in ACTIVE_STAGES:
        record["status"] = "running"
    else:
        record["status"] = "unknown_provider_state"
    write_json(path, record)
    write_json(config.output_root / "latest.json", record)
    return record


def cancel_job(config: BackendConfig, provider: JobsProvider, job_id: str, reason: str) -> dict[str, Any]:
    path = locate_job_manifest(config, job_id)
    record = load_json(path, "remote job state manifest")
    current = provider.inspect(job_id)
    stage, _ = job_status(current)
    canceled = False
    if stage not in TERMINAL_STAGES:
        provider.cancel(job_id)
        canceled = True
    record["job"] = safe_job_record(provider.inspect(job_id))
    record["status"] = "cleanup_requested" if canceled else "already_terminal"
    record["cleanupEvent"] = {"requestedAt": now(), "reason": reason, "cancelInvoked": canceled}
    write_json(path, record)
    write_json(config.output_root / "latest.json", record)
    return record


def tree_hash(directory: pathlib.Path, exclude: set[str] | None = None) -> str:
    excluded = exclude or set()
    digest = hashlib.sha256()
    for file in sorted(path for path in directory.rglob("*") if path.is_file()):
        relative = file.relative_to(directory).as_posix()
        if relative in excluded:
            continue
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(sha256_file(file).encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def retrieve_artifact(config: BackendConfig, provider: JobsProvider, job_id: str, destination: pathlib.Path | None = None) -> dict[str, Any]:
    record_path = locate_job_manifest(config, job_id)
    record = load_json(record_path, "remote job state manifest")
    if ((record.get("job") or {}).get("stage")) != "COMPLETED":
        raise BackendError("cannot retrieve an artifact until the remote job is confirmed COMPLETED")
    artifact = record.get("artifact") or {}
    output_volume = record.get("outputVolume") or {}
    receipt_dir = pathlib.Path(tempfile.mkdtemp(prefix=f"kurukoo-hf-receipt-{job_id}-"))
    try:
        provider.sync_output(output_volume, receipt_dir)
        receipt = load_json(receipt_dir / "remote-job-result.json", "remote job retrieval receipt")
    finally:
        shutil.rmtree(receipt_dir, ignore_errors=True)
    if receipt.get("status") != "completed":
        raise BackendError("remote job did not write a completed artifact receipt")
    remote_artifact = receipt.get("artifact") or {}
    repo_id = str(remote_artifact.get("repository") or artifact.get("repository") or "").strip()
    revision = str(remote_artifact.get("manifestRevision") or "").strip()
    if not repo_id or not revision:
        raise BackendError("remote job receipt does not contain an immutable artifact repository revision")
    target = destination or (config.output_root / "retrieved" / job_id)
    if target.exists():
        shutil.rmtree(target)
    provider.download_snapshot(repo_id, revision, target)
    manifest_path = target / "artifact-manifest.json"
    manifest = load_json(manifest_path, "retrieved artifact manifest")
    if manifest.get("status") != "trained_candidate" or manifest.get("runKind") == "feasibility_only" or manifest.get("registryEligible") is not True:
        raise BackendError("retrieved artifact is not an eligible trained candidate")
    if manifest.get("dataset_sha256") != config.expected_dataset_hash:
        raise BackendError("retrieved artifact dataset hash does not match the canonical training corpus")
    remote = manifest.get("remoteTraining") or {}
    if remote.get("behaviourPackHash") != config.expected_pack_hash:
        raise BackendError("retrieved artifact Behaviour Pack hash does not match the canonical pack")
    expected_hash = str(remote.get("artifactPayloadSha256") or "")
    actual_hash = tree_hash(target, exclude={"artifact-manifest.json", ".gitattributes"})
    if not expected_hash or actual_hash != expected_hash:
        raise BackendError("retrieved artifact payload hash does not match its immutable training manifest")
    artifact.update({"repository": repo_id, "revision": revision, "payloadRevision": remote_artifact.get("payloadRevision"), "uri": f"hf://{repo_id}@{revision}", "artifactPayloadSha256": actual_hash, "localPath": str(target), "retrievedAt": now()})
    record["artifact"] = artifact
    record["status"] = "artifact_retrieved_verified"
    write_json(record_path, record)
    write_json(config.output_root / "latest.json", record)
    return record


def require_provider() -> HuggingFaceJobsProvider:
    token = environment_token()
    if not token:
        raise BackendError("missing Hugging Face credential: set one of HF_TOKEN, HUGGINGFACE_API_KEY, or HUGGINGFACEHUB_API_TOKEN")
    return HuggingFaceJobsProvider(token)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("preflight")
    sub.add_parser("launch")
    status = sub.add_parser("status")
    status.add_argument("--job-id", required=True)
    cancel = sub.add_parser("cancel")
    cancel.add_argument("--job-id", required=True)
    cancel.add_argument("--reason", default="operator_requested_cleanup")
    retrieve = sub.add_parser("retrieve")
    retrieve.add_argument("--job-id", required=True)
    retrieve.add_argument("--destination")
    args = parser.parse_args()
    try:
        config = BackendConfig.from_env()
        if args.command == "preflight":
            payload = preflight(config)
        elif args.command == "launch":
            payload = launch_remote(config, require_provider())
        elif args.command == "status":
            payload = monitor_job(config, require_provider(), args.job_id)
        elif args.command == "cancel":
            payload = cancel_job(config, require_provider(), args.job_id, args.reason)
        else:
            destination = pathlib.Path(args.destination).expanduser() if args.destination else None
            payload = retrieve_artifact(config, require_provider(), args.job_id, destination)
    except BackendError as exc:
        payload = {"status": "blocked", "reason": str(exc)}
        print(json.dumps(payload, indent=2, sort_keys=True))
        return 2
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
