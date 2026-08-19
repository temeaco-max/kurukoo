"""Provider-free regression tests for the guarded Hugging Face Jobs backend."""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import tempfile
from contextlib import contextmanager
from unittest.mock import patch

import huggingface_jobs_backend as backend


@contextmanager
def isolated_env(values: dict[str, str]):
    with patch.dict(os.environ, values, clear=False):
        yield


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: pathlib.Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def accepted_row(index: int) -> dict:
    return {"exampleId": f"accepted-{index}", "reviewed": True, "accepted": True, "messages": [{"role": "user", "content": f"example {index}"}, {"role": "assistant", "content": "safe response"}]}


def make_config(root: pathlib.Path, expected_dataset_hash: str | None = None, cost_cap: float | None = 3.0) -> backend.BackendConfig:
    root.mkdir(parents=True, exist_ok=True)
    dataset = root / "accepted-train.jsonl"
    with dataset.open("w", encoding="utf-8") as handle:
        for index in range(1000):
            handle.write(json.dumps(accepted_row(index), sort_keys=True) + "\n")
    dataset_hash = sha256(dataset)
    pack_hash = "pack-hash-1"
    corpus = root / "corpus.json"
    curation = root / "curation.json"
    pack = root / "pack.json"
    write_json(corpus, {
        "datasetVersion": "kurukoo-training-v2",
        "packHash": pack_hash,
        "combined": {"splits": {"train": {"sha256": dataset_hash}}},
        "privacy": {"productionUserDataIncluded": False},
        "validation": {"exactConversationLeakage": False, "groupSplitLeakage": False},
    })
    write_json(curation, {
        "status": "ready_for_training",
        "outputSha256": dataset_hash,
        "acceptedRows": 1000,
        "rejectedRows": 0,
        "syntheticOnly": True,
        "teacherOutputTrustedAutomatically": False,
    })
    write_json(pack, {"packVersion": "test-pack-v1", "packHash": pack_hash})
    return backend.BackendConfig(
        root=backend.ROOT,
        backend="huggingface",
        dataset=dataset,
        corpus_manifest=corpus,
        curation_manifest=curation,
        behaviour_pack=pack,
        expected_dataset_hash=expected_dataset_hash or dataset_hash,
        expected_pack_hash=pack_hash,
        base_model="HuggingFaceTB/SmolLM2-1.7B-Instruct",
        base_model_revision=None,
        output_root=root / "job-state",
        artifact_repo="test-owner/kurukoo-student-v1",
        min_gpu_memory_gib=16,
        timeout_seconds=3600,
        max_estimated_cost_usd=cost_cap,
        image="pytorch/pytorch:2.6.0-cuda12.4-cudnn9-devel",
        run_kind="student_candidate",
    )


class FakeProvider:
    def __init__(self) -> None:
        self.stage = "SCHEDULING"
        self.cancelled = False
        self.launched: dict | None = None
        self.output_receipt: dict | None = None

    def whoami(self) -> dict:
        return {"name": "test-owner"}

    def model_revision(self, model: str, requested_revision: str | None) -> str:
        assert model == "HuggingFaceTB/SmolLM2-1.7B-Instruct"
        return "base-revision-immutable"

    def list_hardware(self):
        return [
            {"name": "cpu-basic", "accelerator": None, "unit_cost_usd": 0.0002, "unit_label": "minute"},
            {"name": "a10g-small", "accelerator": {"manufacturer": "Nvidia", "model": "A10G", "quantity": "1", "vram": "24 GB"}, "unit_cost_usd": 0.0167, "unit_label": "minute"},
            {"name": "t4-small", "accelerator": {"manufacturer": "Nvidia", "model": "T4", "quantity": "1", "vram": "16 GB"}, "unit_cost_usd": 0.0067, "unit_label": "minute"},
        ]

    def sync_input(self, local_dir: pathlib.Path, mount_path: str, read_only: bool):
        assert local_dir.exists()
        return {"type": "bucket", "source": "test-owner/jobs-artifacts", "path": "input" if read_only else "output", "mount_path": mount_path, "read_only": read_only}

    def launch(self, **kwargs):
        self.launched = kwargs
        assert kwargs["flavor"] == "t4-small"
        assert kwargs["timeout"] == 3600
        assert kwargs["secrets"].keys() == {"HF_TOKEN"}
        return {"id": "job-1", "url": "https://huggingface.co/jobs/test-owner/job-1", "flavor": kwargs["flavor"], "status": {"stage": self.stage, "message": None}}

    def inspect(self, job_id: str):
        assert job_id == "job-1"
        return {"id": job_id, "url": "https://huggingface.co/jobs/test-owner/job-1", "flavor": "t4-small", "status": {"stage": self.stage, "message": "simulated" if self.stage == "ERROR" else None}}

    def cancel(self, job_id: str):
        assert job_id == "job-1"
        self.cancelled = True
        self.stage = "CANCELED"

    def sync_output(self, volume: dict, destination: pathlib.Path):
        assert volume["source"] == "test-owner/jobs-artifacts"
        assert self.output_receipt is not None
        write_json(destination / "remote-job-result.json", self.output_receipt)
        return str(destination)

    def download_snapshot(self, repo_id: str, revision: str, destination: pathlib.Path):
        assert repo_id == "test-owner/kurukoo-student-v1"
        assert revision == "manifest-revision-1"
        destination.mkdir(parents=True, exist_ok=True)
        (destination / "adapter_config.json").write_text("{}\n", encoding="utf-8")
        (destination / "adapter_model.safetensors").write_bytes(b"adapter")
        (destination / "tokenizer_config.json").write_text("{}\n", encoding="utf-8")
        return str(destination)


def assert_blocked(callback, label: str) -> None:
    try:
        callback()
    except backend.BackendError:
        return
    raise AssertionError(f"{label} unexpectedly passed")


def test_default_backend_is_local_cuda() -> None:
    with isolated_env({"KURUKOO_TRAINING_BACKEND": "local_cuda"}):
        assert backend.BackendConfig.from_env().backend == "local_cuda"


def test_preflight_hash_and_pack_boundaries() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        config = make_config(pathlib.Path(tmp))
        evidence = backend.preflight(config)
        assert evidence["status"] == "ready_for_remote_submission"
        assert evidence["datasetRows"] == 1000
        assert_blocked(lambda: backend.preflight(make_config(pathlib.Path(tmp) / "hash-mismatch", expected_dataset_hash="wrong")), "dataset hash mismatch")
        broken_pack = json.loads(config.behaviour_pack.read_text(encoding="utf-8"))
        broken_pack["packHash"] = "wrong-pack"
        write_json(config.behaviour_pack, broken_pack)
        assert_blocked(lambda: backend.preflight(config), "pack hash mismatch")


def test_hardware_selection_uses_cheapest_safe_provider_option() -> None:
    provider = FakeProvider()
    selected = backend.choose_hardware(provider.list_hardware(), 16)
    assert selected.flavor == "t4-small"
    assert selected.memory_gib == 16
    assert round(float(selected.cost_per_hour_usd or 0), 2) == 0.40


def test_launch_requires_explicit_cost_bounded_approval() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        config = make_config(pathlib.Path(tmp))
        provider = FakeProvider()
        with isolated_env({"FF_HUGGINGFACE_JOBS": "false", "KURUKOO_REMOTE_TRAINING_LAUNCH_APPROVED": "true", "KURUKOO_HF_MAX_ESTIMATED_COST_USD": "3"}):
            assert_blocked(lambda: backend.launch_remote(config, provider), "feature-disabled remote launch")
        with isolated_env({"FF_HUGGINGFACE_JOBS": "true", "KURUKOO_REMOTE_TRAINING_LAUNCH_APPROVED": "false", "KURUKOO_HF_MAX_ESTIMATED_COST_USD": "3"}):
            assert_blocked(lambda: backend.launch_remote(config, provider), "unapproved remote launch")
        with isolated_env({"FF_HUGGINGFACE_JOBS": "true", "KURUKOO_REMOTE_TRAINING_LAUNCH_APPROVED": "true", "KURUKOO_HF_MAX_ESTIMATED_COST_USD": "3"}):
            record = backend.launch_remote(config, provider)
        assert record["status"] == "submitted"
        assert record["job"]["jobId"] == "job-1"
        assert record["preflight"]["selectedHardware"]["flavor"] == "t4-small"
        assert provider.launched is not None
        assert "HF_TOKEN" not in json.dumps(record)


def test_monitor_cancel_and_verified_artifact_retrieval() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        config = make_config(pathlib.Path(tmp))
        provider = FakeProvider()
        with isolated_env({"FF_HUGGINGFACE_JOBS": "true", "KURUKOO_REMOTE_TRAINING_LAUNCH_APPROVED": "true", "KURUKOO_HF_MAX_ESTIMATED_COST_USD": "3"}):
            backend.launch_remote(config, provider)
        provider.stage = "RUNNING"
        running = backend.monitor_job(config, provider, "job-1")
        assert running["status"] == "running"
        cancelled = backend.cancel_job(config, provider, "job-1", "simulated_failure_cleanup")
        assert cancelled["cleanupEvent"]["cancelInvoked"] is True
        assert provider.cancelled is True

        provider.stage = "SCHEDULING"
        with isolated_env({"FF_HUGGINGFACE_JOBS": "true", "KURUKOO_REMOTE_TRAINING_LAUNCH_APPROVED": "true", "KURUKOO_HF_MAX_ESTIMATED_COST_USD": "3"}):
            backend.launch_remote(config, provider)
        provider.stage = "COMPLETED"
        backend.monitor_job(config, provider, "job-1")
        snapshot = pathlib.Path(tmp) / "snapshot"
        snapshot.mkdir()
        (snapshot / "adapter_config.json").write_text("{}\n", encoding="utf-8")
        (snapshot / "adapter_model.safetensors").write_bytes(b"adapter")
        (snapshot / "tokenizer_config.json").write_text("{}\n", encoding="utf-8")
        payload_hash = backend.tree_hash(snapshot, exclude={"artifact-manifest.json"})
        provider.output_receipt = {"status": "completed", "artifact": {"repository": "test-owner/kurukoo-student-v1", "payloadRevision": "payload-revision-1", "manifestRevision": "manifest-revision-1", "artifactPayloadSha256": payload_hash}}

        original_download = provider.download_snapshot
        def download_with_manifest(repo_id: str, revision: str, destination: pathlib.Path):
            original_download(repo_id, revision, destination)
            write_json(destination / "artifact-manifest.json", {"status": "trained_candidate", "runKind": "student_candidate", "registryEligible": True, "dataset_sha256": config.expected_dataset_hash, "remoteTraining": {"behaviourPackHash": config.expected_pack_hash, "artifactPayloadSha256": payload_hash}})
            return str(destination)
        provider.download_snapshot = download_with_manifest  # type: ignore[method-assign]
        retrieved = backend.retrieve_artifact(config, provider, "job-1")
        assert retrieved["status"] == "artifact_retrieved_verified"
        assert retrieved["artifact"]["artifactPayloadSha256"] == payload_hash


def test_feasibility_only_manifest_is_never_retrieved_as_candidate() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        config = make_config(pathlib.Path(tmp))
        provider = FakeProvider()
        with isolated_env({"FF_HUGGINGFACE_JOBS": "true", "KURUKOO_REMOTE_TRAINING_LAUNCH_APPROVED": "true", "KURUKOO_HF_MAX_ESTIMATED_COST_USD": "3"}):
            backend.launch_remote(config, provider)
        provider.stage = "COMPLETED"
        backend.monitor_job(config, provider, "job-1")
        provider.output_receipt = {"status": "completed", "artifact": {"repository": "test-owner/kurukoo-student-v1", "manifestRevision": "manifest-revision-1"}}
        def feasibility_download(repo_id: str, revision: str, destination: pathlib.Path):
            destination.mkdir(parents=True, exist_ok=True)
            write_json(destination / "artifact-manifest.json", {"status": "feasibility_only", "runKind": "feasibility_only", "registryEligible": False})
            return str(destination)
        provider.download_snapshot = feasibility_download  # type: ignore[method-assign]
        assert_blocked(lambda: backend.retrieve_artifact(config, provider, "job-1"), "feasibility-only artifact retrieval")


if __name__ == "__main__":
    test_default_backend_is_local_cuda()
    test_preflight_hash_and_pack_boundaries()
    test_hardware_selection_uses_cheapest_safe_provider_option()
    test_launch_requires_explicit_cost_bounded_approval()
    test_monitor_cancel_and_verified_artifact_retrieval()
    test_feasibility_only_manifest_is_never_retrieved_as_candidate()
    print("Hugging Face Jobs backend regression passed: remote training remains canonical, cost-bounded, integrity-checked, retrievable, and fail-closed.")
