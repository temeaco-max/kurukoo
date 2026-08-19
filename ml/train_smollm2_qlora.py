#!/usr/bin/env python3
"""Guarded local LoRA/QLoRA training entrypoint for Kurukoo's SmolLM2 student.

This script prepares or runs a real local adapter training job. It never promotes
or activates an artifact automatically. A training run only executes when
KURUKOO_ENABLE_TRAINING=true is explicitly set.
"""
import hashlib
import json
import os
import pathlib
import sys
import platform
from importlib import metadata
from dataclasses import asdict, dataclass

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATASET = pathlib.Path(os.environ.get(
    "KURUKOO_TRAIN_DATASET",
    str(ROOT / "ml" / "datasets" / "kurukoo-accepted-v1.jsonl"),
))
OUTPUT = pathlib.Path(os.environ.get(
    "KURUKOO_TRAIN_OUTPUT",
    str(ROOT / "artifacts" / "smollm2-kurukoo-lora"),
))
BASE_MODEL = os.environ.get("KURUKOO_SMOLLM2_BASE_MODEL", "HuggingFaceTB/SmolLM2-1.7B-Instruct")
BASE_MODEL_REVISION = os.environ.get("KURUKOO_SMOLLM2_BASE_MODEL_REVISION", "").strip() or None
MAX_LENGTH = max(256, min(int(os.environ.get("KURUKOO_TRAIN_MAX_LENGTH", "1024")), 4096))
EPOCHS = max(1, min(int(os.environ.get("KURUKOO_TRAIN_EPOCHS", "3")), 10))
BATCH = max(1, min(int(os.environ.get("KURUKOO_TRAIN_BATCH_SIZE", "2")), 16))
GRAD_ACCUM = max(1, min(int(os.environ.get("KURUKOO_TRAIN_GRAD_ACCUM", "8")), 64))
LR = float(os.environ.get("KURUKOO_TRAIN_LR", "2e-4"))
USE_4BIT = os.environ.get("KURUKOO_TRAIN_4BIT", "true").lower() == "true"
ENABLE = os.environ.get("KURUKOO_ENABLE_TRAINING", "false").lower() == "true"
SEED = int(os.environ.get("KURUKOO_TRAIN_SEED", "42"))
MIN_CUDA_MEMORY_GIB = max(1, int(os.environ.get("KURUKOO_TRAIN_MIN_CUDA_MEMORY_GIB", "16")))
ALLOW_FULL_CPU = os.environ.get("KURUKOO_ALLOW_FULL_CPU_TRAINING", "false").lower() == "true"
FULL_CORPUS_MIN_ROWS = max(1000, int(os.environ.get("KURUKOO_FULL_CORPUS_MIN_ROWS", "1000")))
RUN_KIND = os.environ.get("KURUKOO_TRAIN_RUN_KIND", "student_candidate").strip().lower()

@dataclass(frozen=True)
class TrainingManifest:
    base_model: str
    base_model_revision: str | None
    dataset: str
    dataset_sha256: str
    output: str
    max_length: int
    epochs: int
    batch_size: int
    gradient_accumulation: int
    learning_rate: float
    four_bit_requested: bool
    training_enabled: bool
    status: str
    seed: int
    hardware: dict
    libraries: dict
    dataset_rows: int
    run_kind: str
    blocker: dict | None = None


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_rows(path: pathlib.Path):
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def assert_explicitly_accepted(rows):
    rejected = []
    for row in rows:
        provenance = row.get("provenance") or {}
        quality = row.get("quality") or {}
        reviewed = row.get("reviewed") is True or provenance.get("reviewed") is True or quality.get("reviewed") is True
        accepted = row.get("accepted") is True or quality.get("accepted") is True
        if not reviewed or not accepted:
            rejected.append(str(row.get("exampleId") or row.get("id") or "unknown"))
    if rejected:
        raise RuntimeError(f"Training corpus contains non-approved candidates; curate first. Rejected examples: {len(rejected)}")
    if not rows:
        raise RuntimeError("Training dataset is empty; no explicitly accepted examples are available")


def runtime_metadata(torch=None):
    libraries = {}
    for package in ("torch", "transformers", "peft", "datasets", "accelerate", "safetensors"):
        try:
            libraries[package] = metadata.version(package)
        except metadata.PackageNotFoundError:
            libraries[package] = None
    hardware = {"platform": platform.platform(), "python": sys.version.split()[0], "cudaAvailable": False, "cudaDevices": [], "minRequiredCudaMemoryGiB": MIN_CUDA_MEMORY_GIB}
    if torch is not None:
        hardware["torchVersion"] = getattr(torch, "__version__", None)
        hardware["cudaAvailable"] = bool(torch.cuda.is_available())
        if torch.cuda.is_available():
            for index in range(torch.cuda.device_count()):
                props = torch.cuda.get_device_properties(index)
                hardware["cudaDevices"].append({"index": index, "name": props.name, "memoryGiB": round(props.total_memory / (1024 ** 3), 2)})
    return hardware, libraries


def write_manifest(payload):
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    (OUTPUT.parent / "training-manifest.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def row_to_text(row, tokenizer):
    messages = row.get("messages") or []
    if not messages:
        raise ValueError(f"Example {row.get('exampleId', '?')} has no messages")
    normalized = []
    for message in messages:
        role = str(message.get("role", "user"))
        content = str(message.get("content", ""))
        if content:
            normalized.append({"role": role, "content": content})
    if not normalized:
        raise ValueError(f"Example {row.get('exampleId', '?')} has no textual messages")
    try:
        return tokenizer.apply_chat_template(normalized, tokenize=False, add_generation_prompt=False)
    except Exception:
        return "\n".join(f"{item['role']}: {item['content']}" for item in normalized)


def main():
    print("Kurukoo SmolLM2 training entrypoint")
    print(f"base model: {BASE_MODEL}")
    print(f"base model revision: {BASE_MODEL_REVISION or 'provider default'}")
    print(f"dataset: {DATASET}")

    if not DATASET.exists():
        if not ENABLE:
            print(f"Accepted training dataset not present: {DATASET}")
            print("Training is disabled. Run ml/curate_candidate_corpus.py after explicit review and acceptance.")
            print("No model weights were created or promoted.")
            return 0
        raise SystemExit(f"Training dataset not found: {DATASET}. Run ml/curate_candidate_corpus.py first.")

    rows = read_rows(DATASET)
    if ENABLE:
        try:
            assert_explicitly_accepted(rows)
        except RuntimeError as exc:
            raise SystemExit(str(exc)) from exc
    dataset_hash = sha256(DATASET)
    if not ENABLE:
        hardware, libraries = runtime_metadata()
        manifest = TrainingManifest(base_model=BASE_MODEL, base_model_revision=BASE_MODEL_REVISION, dataset=str(DATASET), dataset_sha256=dataset_hash, output=str(OUTPUT), max_length=MAX_LENGTH, epochs=EPOCHS, batch_size=BATCH, gradient_accumulation=GRAD_ACCUM, learning_rate=LR, four_bit_requested=USE_4BIT, training_enabled=False, status="training_disabled", seed=SEED, hardware=hardware, libraries=libraries, dataset_rows=len(rows), run_kind=RUN_KIND)
        print(json.dumps(asdict(manifest), indent=2))
        write_manifest(asdict(manifest))
        print("Training is disabled. No model weights were created or promoted.")
        return 0

    try:
        import torch
        from datasets import Dataset
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, DataCollatorForLanguageModeling, TrainingArguments, Trainer
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    except Exception as exc:
        raise SystemExit(f"Training dependencies are unavailable: {exc}")

    hardware, libraries = runtime_metadata(torch)
    minimum_satisfied = any(float(device.get("memoryGiB", 0)) >= MIN_CUDA_MEMORY_GIB for device in hardware["cudaDevices"])
    if len(rows) >= FULL_CORPUS_MIN_ROWS and not ALLOW_FULL_CPU and not minimum_satisfied:
        blocker = {"code": "insufficient_gpu_for_full_corpus_training", "reason": "A full Kurukoo Student v1 run is intentionally blocked without a CUDA GPU meeting the configured memory floor.", "requiredGpuMemoryGiB": MIN_CUDA_MEMORY_GIB, "observedCudaDevices": hardware["cudaDevices"], "cpuOverrideEnv": "KURUKOO_ALLOW_FULL_CPU_TRAINING=true", "expectedArtifact": str(OUTPUT / "artifact-manifest.json"), "trainingCommand": "KURUKOO_ENABLE_TRAINING=true KURUKOO_TRAIN_DATASET=<accepted-train.jsonl> KURUKOO_TRAIN_OUTPUT=<artifact-dir> python3 ml/train_smollm2_qlora.py"}
        manifest = TrainingManifest(base_model=BASE_MODEL, base_model_revision=BASE_MODEL_REVISION, dataset=str(DATASET), dataset_sha256=dataset_hash, output=str(OUTPUT), max_length=MAX_LENGTH, epochs=EPOCHS, batch_size=BATCH, gradient_accumulation=GRAD_ACCUM, learning_rate=LR, four_bit_requested=USE_4BIT, training_enabled=True, status="blocked_hardware", seed=SEED, hardware=hardware, libraries=libraries, dataset_rows=len(rows), run_kind=RUN_KIND, blocker=blocker)
        print(json.dumps(asdict(manifest), indent=2))
        write_manifest(asdict(manifest))
        return 3

    manifest = TrainingManifest(base_model=BASE_MODEL, base_model_revision=BASE_MODEL_REVISION, dataset=str(DATASET), dataset_sha256=dataset_hash, output=str(OUTPUT), max_length=MAX_LENGTH, epochs=EPOCHS, batch_size=BATCH, gradient_accumulation=GRAD_ACCUM, learning_rate=LR, four_bit_requested=USE_4BIT, training_enabled=True, status="training_requested", seed=SEED, hardware=hardware, libraries=libraries, dataset_rows=len(rows), run_kind=RUN_KIND)
    print(json.dumps(asdict(manifest), indent=2))
    write_manifest(asdict(manifest))

    if not torch.cuda.is_available() and USE_4BIT:
        print("CUDA is unavailable; falling back to non-4-bit LoRA training.")
        use_4bit = False
    else:
        use_4bit = USE_4BIT

    revision_kwargs = {"revision": BASE_MODEL_REVISION} if BASE_MODEL_REVISION else {}
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, use_fast=True, **revision_kwargs)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    texts = [row_to_text(row, tokenizer) for row in rows]
    dataset = Dataset.from_dict({"text": texts})

    def tokenize(batch):
        return tokenizer(batch["text"], truncation=True, max_length=MAX_LENGTH)

    tokenized = dataset.map(tokenize, batched=True, remove_columns=["text"])

    quant_config = None
    model_kwargs = {}
    if use_4bit:
        quant_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
        )
        model_kwargs["quantization_config"] = quant_config
        model_kwargs["device_map"] = "auto"

    model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, **model_kwargs, **revision_kwargs)
    if use_4bit:
        model = prepare_model_for_kbit_training(model)

    lora = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    training_args = TrainingArguments(
        output_dir=str(OUTPUT),
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=BATCH,
        gradient_accumulation_steps=GRAD_ACCUM,
        learning_rate=LR,
        logging_steps=10,
        save_strategy="epoch",
        report_to=[],
        seed=SEED,
        fp16=torch.cuda.is_available(),
        bf16=torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
        gradient_checkpointing=True,
        remove_unused_columns=False,
    )
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized,
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
    )
    trainer.train()
    trainer.save_model(str(OUTPUT))
    tokenizer.save_pretrained(str(OUTPUT))

    artifact_manifest = {
        **asdict(manifest),
        "status": "feasibility_only" if RUN_KIND == "feasibility_only" else "trained_candidate",
        "runKind": RUN_KIND,
        "artifactDirectory": str(OUTPUT),
        "runtimeModel": (os.environ.get("KURUKOO_SMOLLM2_RUNTIME_MODEL") or "").strip() or None,
        "candidateOnly": True,
        "registryEligible": RUN_KIND != "feasibility_only",
        "promoted": False,
        "productionEnabled": False,
        "datasetRows": len(rows),
    }
    (OUTPUT / "artifact-manifest.json").write_text(json.dumps(artifact_manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(artifact_manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
