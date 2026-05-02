# 🖥️ Local LLM Setup via Ollama — PocketJury

> **Run PocketJury entirely offline with a local LLM using Ollama. No internet required for responses.**

---

## Table of Contents

- [1. Why Local LLM?](#1-why-local-llm)
- [2. Prerequisites](#2-prerequisites)
- [3. Install Ollama](#3-install-ollama)
- [4. Choose a Model](#4-choose-a-model)
- [5. Modify PocketJury for Ollama](#5-modify-pocketjury-for-ollama)
- [6. Docker Compose Integration](#6-docker-compose-integration)
- [7. Performance Tuning](#7-performance-tuning)
- [8. Limitations](#8-limitations)
- [9. Future: Fine-tuning for Indian Law](#9-future-fine-tuning-for-indian-law)
- [10. Fine-Tuning with Hugging Face](#10-fine-tuning-with-hugging-face)

---

## 1. Why Local LLM?

| Benefit | Description |
|---------|-------------|
| **Privacy** | No data leaves your machine — critical for legal queries |
| **Offline** | Works without internet after initial model download |
| **No API costs** | Zero per-token charges |
| **Low latency** | No network round-trip for LLM calls |
| **Customizable** | Can fine-tune on Indian legal corpus |

**Trade-offs:**
- Lower quality than OpenRouter GPT-OSS-120B or Claude 3.5 Sonnet (especially for complex legal reasoning)
- Requires decent hardware (8GB+ VRAM for GPU, 16GB+ RAM for CPU)
- Slower inference on CPU

---

## 2. Prerequisites

### Minimum Hardware

| Component | CPU-only | GPU (recommended) |
|-----------|----------|-------------------|
| **RAM** | 16 GB | 16 GB |
| **VRAM** | — | 8 GB (NVIDIA) |
| **Storage** | 10 GB free | 10 GB free |
| **CPU** | 8+ cores | 4+ cores |

### Recommended Models by Hardware

| VRAM | Model | Quality |
|------|-------|---------|
| 4 GB | `phi3:mini` (3.8B) | Basic |
| 6 GB | `mistral:7b` | Good |
| 8 GB | `llama3.1:8b` | Very good |
| 12 GB | `mixtral:8x7b` | Excellent |
| 16 GB+ | `llama3.1:70b` | Near GPT-4 |
| CPU only (16GB RAM) | `llama3.1:8b` (slow) | Good |

---

## 3. Install Ollama

### Windows

```powershell
# Download and install from:
# https://ollama.com/download/windows

# Or via winget:
winget install Ollama.Ollama

# Start Ollama (runs as system service)
ollama serve
```

### macOS

```bash
# Via Homebrew:
brew install ollama
ollama serve
```

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
```

### Verify installation

```bash
ollama --version
# Should output: ollama version 0.x.x

# Pull a model
ollama pull llama3.1:8b
# Downloads ~4.7 GB

# Test it
ollama run llama3.1:8b "What are fundamental rights in India?"
```

---

## 4. Choose a Model

### Recommended for PocketJury

| Model | Size | Best For | Pull Command |
|-------|------|----------|--------------|
| **`llama3.1:8b`** | 4.7 GB | Best quality/speed balance | `ollama pull llama3.1:8b` |
| **`mistral:7b`** | 4.1 GB | Good general purpose | `ollama pull mistral:7b` |
| **`phi3:mini`** | 2.2 GB | Low-resource machines | `ollama pull phi3:mini` |
| **`mixtral:8x7b`** | 26 GB | Highest local quality | `ollama pull mixtral:8x7b` |
| **`llama3.1:70b`** | 40 GB | Near cloud quality (needs GPU) | `ollama pull llama3.1:70b` |

**Our recommendation:** Start with `llama3.1:8b` — it has good multilingual support (Hindi, Bengali) and decent legal reasoning.

---

## 5. Modify PocketJury for Ollama

Since our current provider is OpenRouter (openai/gpt-oss-120b:free), switching to Ollama requires changing config.py and llm_client.py to use the OpenAI-compatible API (Ollama supports it natively).

### Step 1: Update `config.py`

```python
# In services/ai/app/config.py, replace the OpenRouter section:

# --- LLM (Ollama - Local) ---
OLLAMA_BASE_URL: str = "http://host.docker.internal:11434/v1"  # From Docker container
LLM_MODEL_ID: str = "llama3.1:8b"
LLM_TEMPERATURE: float = 0.1
LLM_MAX_TOKENS: int = 2048
```

> **Note:** `host.docker.internal` lets the Docker container reach the host machine where Ollama runs. On Linux, use `172.17.0.1` or the host's IP instead.

### Step 2: Update `llm_client.py`

```python
# ==============================================================================
# PocketJury AI Service — LLM Client (Ollama - Local)
# ==============================================================================

from __future__ import annotations

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


class LLMClient:
    """Client for Ollama local LLM (OpenAI-compatible API)."""

    def __init__(self) -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(
            base_url=settings.OLLAMA_BASE_URL,
            api_key="ollama",  # Ollama doesn't need a real key
        )
        self._model_id = settings.LLM_MODEL_ID
        logger.info("LLM client initialized (Ollama)", model=self._model_id, base_url=settings.OLLAMA_BASE_URL)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(Exception),
    )
    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
        stop_sequences: list[str] | None = None,
    ) -> str:
        """Generate a response from Ollama."""
        messages: list[dict] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            response = await self._client.chat.completions.create(
                model=self._model_id,
                messages=messages,
                max_tokens=max_tokens or settings.LLM_MAX_TOKENS,
                temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
                stop=stop_sequences,
            )
            generated_text = response.choices[0].message.content or ""

            logger.debug(
                "LLM response generated",
                model=self._model_id,
                input_tokens=response.usage.prompt_tokens if response.usage else 0,
                output_tokens=response.usage.completion_tokens if response.usage else 0,
            )
            return generated_text

        except Exception as e:
            logger.error("LLM generation failed", error=str(e), model=self._model_id)
            raise

    async def generate_with_history(
        self,
        messages: list[dict[str, str]],
        system_prompt: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> str:
        """Generate a response with conversation history."""
        oai_messages: list[dict] = []
        if system_prompt:
            oai_messages.append({"role": "system", "content": system_prompt})
        oai_messages.extend(messages)

        try:
            response = await self._client.chat.completions.create(
                model=self._model_id,
                messages=oai_messages,
                max_tokens=max_tokens or settings.LLM_MAX_TOKENS,
                temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error("LLM generation with history failed", error=str(e))
            raise
```

### Step 3: Update `.env`

```env
# Remove OPENROUTER_API_KEY (not needed)
# Add:
OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
LLM_MODEL_ID=llama3.1:8b
```

### Step 4: Update `docker-compose.yml`

```yaml
# AI service environment section — replace OPENROUTER_API_KEY with:
OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434/v1}
LLM_MODEL_ID: ${LLM_MODEL_ID:-llama3.1:8b}
```

Add this to the AI service for Docker Desktop to resolve `host.docker.internal`:

```yaml
ai:
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

### Step 5: Rebuild and test

```bash
# Make sure Ollama is running on host
ollama serve

# Rebuild AI container
docker compose up --build -d ai

# Test
curl http://localhost:8000/health
```

---

## 6. Docker Compose Integration

### Option A: Ollama on Host (Recommended for Development)

Run Ollama natively on your machine, access from Docker containers via `host.docker.internal`:

```yaml
# docker-compose.yml — AI service section
ai:
  environment:
    OLLAMA_BASE_URL: http://host.docker.internal:11434/v1
    LLM_MODEL_ID: llama3.1:8b
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

### Option B: Ollama as Docker Container

Run Ollama inside Docker Compose alongside other services:

```yaml
# Add to docker-compose.yml:
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama-models:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]  # Remove if CPU-only
    healthcheck:
      test: ["CMD", "ollama", "list"]
      interval: 30s
      timeout: 10s
      retries: 3

  ai:
    depends_on:
      ollama:
        condition: service_healthy
    environment:
      OLLAMA_BASE_URL: http://ollama:11434/v1
      LLM_MODEL_ID: llama3.1:8b

volumes:
  ollama-models:
```

**After starting, pull the model:**
```bash
docker compose exec ollama ollama pull llama3.1:8b
```

---

## 7. Performance Tuning

### GPU Acceleration (NVIDIA)

```bash
# Install NVIDIA Container Toolkit
# https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html

# Verify GPU access
nvidia-smi
docker run --gpus all nvidia/cuda:12.0-base nvidia-smi
```

With GPU, expect:
- `llama3.1:8b`: ~30-50 tokens/sec
- `mixtral:8x7b`: ~15-25 tokens/sec

Without GPU (CPU only):
- `llama3.1:8b`: ~5-10 tokens/sec
- Response time: ~10-30 seconds per query

### Ollama Configuration

Set environment variables for Ollama:

```bash
# Increase context window (for long legal documents)
OLLAMA_NUM_CTX=4096

# Use more GPU layers (if partial GPU offloading)
OLLAMA_NUM_GPU=35

# Increase threads for CPU inference
OLLAMA_NUM_THREAD=8
```

### PocketJury Settings for Local LLM

Adjust the RAG pipeline for local model limitations:

```python
# In config.py — reduce token limits for smaller models
LLM_MAX_TOKENS: int = 1024  # Smaller models struggle with long outputs
LLM_TEMPERATURE: float = 0.1  # Keep low for factual legal responses
RAG_TOP_K_FINAL: int = 5  # Fewer context chunks to fit in smaller context window
```

---

## 8. Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| **Lower quality** | May produce less accurate legal responses | Use larger models (70B) or fine-tune |
| **Slower inference** | 10-30s per query on CPU | Use GPU or smaller models |
| **Context window** | 4K-8K tokens vs 128K for OpenRouter GPT-OSS-120B | Reduce RAG_TOP_K_FINAL, summarize context |
| **Multilingual** | Hindi/Tamil/Bengali support varies by model | Test with target languages, consider fine-tuning |
| **Hallucination** | More prone to fabricating legal citations | RAG grounding helps, but validate outputs |
| **No streaming** | Ollama supports streaming but our pipeline doesn't yet | Future enhancement |

---

## 9. Future: Fine-tuning for Indian Law

### Step 1: Prepare Training Data

```jsonl
{"messages": [{"role": "system", "content": "You are PocketJury, an Indian legal assistant."}, {"role": "user", "content": "What is Section 498A?"}, {"role": "assistant", "content": "Section 498A of the IPC (now Section 85/86 of BNS 2023) deals with cruelty by husband or relatives..."}]}
```

Gather training data from:
- Indian Kanoon case summaries
- Legal aid helpline FAQs
- IPC/BNS section explanations
- Consumer court judgments

### Step 2: Fine-tune with Ollama

```bash
# Create a Modelfile
cat > Modelfile << 'EOF'
FROM llama3.1:8b

SYSTEM """You are PocketJury, an AI legal assistant specializing in Indian law.
You provide accurate, accessible legal information in the user's language.
Always cite specific sections of Indian statutes (BNS, BNSS, BSA, Constitution).
Always include a disclaimer that this is not legal advice."""

PARAMETER temperature 0.1
PARAMETER num_ctx 4096
EOF

# Create custom model
ollama create pocketjury-legal -f Modelfile

# Test
ollama run pocketjury-legal "What are my rights if arrested?"
```

### Step 3: Fine-tune with LoRA (Advanced)

For actual fine-tuning on legal data, use tools like:
- **Unsloth** — Fast LoRA fine-tuning
- **Axolotl** — Multi-GPU training
- **LlamaFactory** — Easy fine-tuning UI

```bash
# Example with Unsloth
pip install unsloth
python fine_tune.py \
  --base-model llama3.1:8b \
  --dataset legal_qa.jsonl \
  --output pocketjury-legal-v1 \
  --epochs 3 \
  --lora-rank 16
```

After fine-tuning, import into Ollama:
```bash
ollama create pocketjury-legal-ft -f Modelfile.ft
```

Update `.env`:
```env
LLM_MODEL_ID=pocketjury-legal-ft
```

---

## Quick Start Summary

```bash
# 1. Install Ollama
winget install Ollama.Ollama  # Windows
# brew install ollama          # macOS

# 2. Pull a model
ollama pull llama3.1:8b

# 3. Update .env
# OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
# LLM_MODEL_ID=llama3.1:8b

# 4. Update config.py, llm_client.py (see Section 5)

# 5. Rebuild
docker compose up --build -d ai

# 6. Test
curl http://localhost:8000/health
```

---

## 10. Fine-Tuning with Hugging Face

### Why Fine-Tune GPT-OSS-120B for Indian Legal Domain?

PocketJury uses OpenRouter's `openai/gpt-oss-120b:free` as its cloud LLM. While this
general-purpose model handles many legal queries well, it has notable gaps in the
Indian legal context:

| Gap | Example |
|-----|---------|
| **IPC → BNS mapping** | Cannot reliably map old IPC sections to their BNS 2023 equivalents |
| **Vernacular legal terms** | Misinterprets Hindi/Tamil/Bengali legal vocabulary |
| **Procedural nuance** | Confuses CrPC timelines with BNSS 2023 changes |
| **Jurisdiction-specific rules** | Mixes up state-level amendments and central acts |
| **Citation format** | Generates incorrect AIR/SCC citation formats |

Fine-tuning with Indian legal data lets you create a domain-specialized model that:
- Maps every IPC section to its BNS equivalent accurately
- Understands multilingual legal terminology
- Produces correctly formatted Indian legal citations
- Can be self-hosted for complete data privacy (no API dependency)

---

### 10.1 Prerequisites

| Requirement | Details |
|-------------|---------|
| **Hugging Face account** | Free at [huggingface.co](https://huggingface.co) — needed for model downloads and pushing fine-tuned weights |
| **Hugging Face CLI** | `pip install huggingface-hub` then `huggingface-cli login` |
| **Python 3.11+** | With pip/conda package manager |
| **GPU (recommended)** | NVIDIA GPU with 24 GB+ VRAM (RTX 3090/4090, A100) for LoRA fine-tuning |
| **Cloud VM (alternative)** | AWS `g5.2xlarge` (A10G 24 GB), RunPod, Lambda Labs, or Google Colab Pro+ |
| **Disk space** | ~250 GB free for model weights + training artifacts |
| **RAM** | 32 GB+ system RAM |

#### Install core dependencies

```bash
# Create a virtual environment for fine-tuning
python -m venv .venv-finetune
source .venv-finetune/bin/activate  # Linux/macOS
# .venv-finetune\Scripts\activate   # Windows

# Install PyTorch with CUDA support
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install Hugging Face ecosystem
pip install \
  transformers>=4.45.0 \
  datasets>=3.0.0 \
  accelerate>=1.0.0 \
  peft>=0.13.0 \
  trl>=0.12.0 \
  bitsandbytes>=0.44.0 \
  safetensors \
  wandb

# Login to Hugging Face
huggingface-cli login
```

---

### 10.2 Dataset Preparation

Fine-tuning quality depends entirely on the training data. For PocketJury's Indian
legal domain, prepare the following datasets:

#### A. Extracting Training Data from PocketJury's Database

Since PocketJury strictly utilizes verified Indian Statutes from `legislative.gov.in` (seeded via `services/ai/seed_legal_docs.py`), you can extract these exact documents to form the basis of your fine-tuning dataset!

By fine-tuning your LLM on this exact legal corpus, it inherently internalizes the structure of the Bharatiya Nyaya Sanhita (BNS), RTI Act, and Consumer Protection laws without needing as much RAG retrieval context.

Create a python script (`extract_finetune_data.py`) to dump the embedded resources into OpenAI JSONL format for LoRA training:

```python
import json
from services.ai.seed_legal_docs import LEGAL_DOCUMENTS

def create_training_data():
    with open("data/legal_qa.jsonl", "w", encoding="utf-8") as f:
        for doc in LEGAL_DOCUMENTS:
            # Create a System Prompt
            system_msg = {
                "role": "system", 
                "content": "You are PocketJury, an AI legal assistant specializing in Indian law. Always cite specific acts based on your training."
            }
            
            # Formulate a synthetic User Query based on the Act Title
            user_msg = {
                "role": "user",
                "content": f"Under Indian Law, what are the provisions regarding {doc['title']}?"
            }
            
            # The Assistant response is the RAW verified legal text from legislative.gov.in
            assistant_msg = {
                "role": "assistant",
                "content": f"According to the {doc['act_name']}, {doc['section_number']}:\n\n{doc['body_text']}"
            }
            
            # Write JSONL Row
            json_row = {"messages": [system_msg, user_msg, assistant_msg]}
            f.write(json.dumps(json_row) + "\\n")
            
if __name__ == "__main__":
    create_training_data()
```

#### B. IPC/BNS Mapping Dataset

Create a structured mapping of all IPC sections to their BNS 2023 equivalents. This reinforces the LLM's transition logic:

```jsonl
{"messages": [{"role": "user", "content": "Map IPC Section 376 to BNS"}, {"role": "assistant", "content": "IPC Section 376 (Punishment for rape) → **BNS Section 63**\n\nKey changes in BNS 2023:\n- Minimum punishment increased from 7 years to 10 years RI\n- New sub-section for rape on woman under 16 years\n- Gang rape covered under Section 70 BNS (was 376D IPC)"}]}
{"messages": [{"role": "user", "content": "Map IPC Section 420 to BNS"}, {"role": "assistant", "content": "IPC Section 420 (Cheating and dishonestly inducing delivery of property) → **BNS Section 316**\n\nPunishment: Imprisonment up to 7 years and fine.\nThe substantive elements remain the same under BNS 2023."}]}
```

#### C. Data Sources & Augmentation

While your initial dataset comes entirely from your `seed_legal_docs.py` payload, you'll want to augment the JSONL file to reach the 3,000+ line threshold required for robust fine-tuning:

| Source | Type | Approximate Size |
|--------|------|------------------|
| **`PocketJury Seed Database`** | Your verified BNS, RTI, and PWDVA Database Texts | ~100 dense chunks |
| [Indian Kanoon](https://indiankanoon.org) | Case summaries, statutes | Scrape relevant sections |
| National Legal Services Authority (NALSA) | Legal aid FAQs | ~500 Q&A pairs |
| Bare Acts (IPC, BNS, CrPC, BNSS, Evidence Act, BSA) | Statute text | ~2,000 sections |
| Consumer forum judgments | Dispute resolutions | ~1,000 summaries |
| RTI guides and PIL procedures | Procedural guides | ~200 Q&A pairs |
| PocketJury production logs (anonymized) | Real user queries | Varies |

**Target:** 3,000–10,000 high-quality instruction-response pairs.

#### D. Data Validation Script

```python
"""Validate JSONL training data before fine-tuning."""
import json
import sys

def validate_dataset(path: str) -> None:
    errors = 0
    with open(path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            try:
                row = json.loads(line)
                msgs = row.get("messages", [])
                roles = [m["role"] for m in msgs]
                assert roles[-1] == "assistant", f"Line {i}: last message must be assistant"
                assert any(r == "user" for r in roles), f"Line {i}: must have a user message"
                for m in msgs:
                    assert len(m["content"].strip()) > 0, f"Line {i}: empty content"
            except Exception as e:
                print(f"ERROR line {i}: {e}")
                errors += 1
    print(f"Validated {i} rows, {errors} errors")
    sys.exit(1 if errors else 0)

if __name__ == "__main__":
    validate_dataset(sys.argv[1])
```

```bash
python validate_data.py training_data.jsonl
```

---

### 10.3 Fine-Tuning with PEFT/LoRA

We use **LoRA (Low-Rank Adaptation)** via Hugging Face PEFT for parameter-efficient
fine-tuning. This trains only ~0.1-1% of the model parameters, drastically reducing
GPU memory requirements.

> **Note on model weights:** GPT-OSS-120B is an open-weight model. Download the
> weights from the model's Hugging Face page or OpenAI's open-weight release
> repository. Check [huggingface.co/openai](https://huggingface.co/openai) for the
> official release. You may need to accept a license agreement before downloading.
> If the weights are not yet available on Hugging Face, check OpenAI's official
> channels for the open-weight download instructions.

#### Training Script Outline

```python
"""
PocketJury — Fine-tune GPT-OSS-120B with LoRA for Indian Legal Domain
======================================================================
Adjust model_name_or_path once weights are available on Hugging Face.
"""

from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training, TaskType
from trl import SFTTrainer

# ──────────────────────────────────────────────
# 1. Configuration
# ──────────────────────────────────────────────
MODEL_ID = "openai/gpt-oss-120b"          # Update if HF repo name differs
DATASET_PATH = "./data/legal_qa.jsonl"     # Your prepared JSONL
OUTPUT_DIR = "./output/pocketjury-legal-v1"
EPOCHS = 3
BATCH_SIZE = 2
GRADIENT_ACCUMULATION = 8                  # Effective batch = 16
LEARNING_RATE = 2e-4
MAX_SEQ_LENGTH = 4096
LORA_RANK = 16
LORA_ALPHA = 32
LORA_DROPOUT = 0.05

# ──────────────────────────────────────────────
# 2. Load model in 4-bit quantization (QLoRA)
# ──────────────────────────────────────────────
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype="bfloat16",
    bnb_4bit_use_double_quant=True,
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
)
model = prepare_model_for_kbit_training(model)

# ──────────────────────────────────────────────
# 3. Configure LoRA adapters
# ──────────────────────────────────────────────
lora_config = LoraConfig(
    r=LORA_RANK,
    lora_alpha=LORA_ALPHA,
    lora_dropout=LORA_DROPOUT,
    bias="none",
    task_type=TaskType.CAUSAL_LM,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                     "gate_proj", "up_proj", "down_proj"],
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# Expected: trainable params ~0.1-0.5% of total

# ──────────────────────────────────────────────
# 4. Load and format dataset
# ──────────────────────────────────────────────
dataset = load_dataset("json", data_files=DATASET_PATH, split="train")

def format_chat(example):
    """Convert messages list to the model's chat template."""
    return {"text": tokenizer.apply_chat_template(
        example["messages"], tokenize=False, add_generation_prompt=False
    )}

dataset = dataset.map(format_chat)

# Split 90/10 for train/eval
dataset = dataset.train_test_split(test_size=0.1, seed=42)

# ──────────────────────────────────────────────
# 5. Training arguments
# ──────────────────────────────────────────────
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=EPOCHS,
    per_device_train_batch_size=BATCH_SIZE,
    gradient_accumulation_steps=GRADIENT_ACCUMULATION,
    learning_rate=LEARNING_RATE,
    bf16=True,
    logging_steps=10,
    eval_strategy="steps",
    eval_steps=50,
    save_strategy="steps",
    save_steps=100,
    save_total_limit=3,
    warmup_ratio=0.05,
    lr_scheduler_type="cosine",
    report_to="wandb",           # Optional: track on Weights & Biases
    gradient_checkpointing=True,  # Saves VRAM at the cost of speed
)

# ──────────────────────────────────────────────
# 6. Train with SFTTrainer
# ──────────────────────────────────────────────
trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
    processing_class=tokenizer,
    max_seq_length=MAX_SEQ_LENGTH,
)

trainer.train()

# ──────────────────────────────────────────────
# 7. Save the LoRA adapter
# ──────────────────────────────────────────────
trainer.save_model(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)

# Optional: push to Hugging Face Hub
# model.push_to_hub("your-username/pocketjury-legal-v1")
# tokenizer.push_to_hub("your-username/pocketjury-legal-v1")
```

#### Running the Training

```bash
# Single GPU
python train.py

# Multi-GPU with accelerate
accelerate config  # One-time setup
accelerate launch train.py

# On a cloud VM (e.g., AWS g5.12xlarge with 4x A10G)
accelerate launch --num_processes 4 train.py
```

**Expected training time (3 epochs, ~5,000 samples):**

| Hardware | Approximate Time |
|----------|-----------------|
| 1x RTX 4090 (24 GB) | ~8-12 hours |
| 1x A100 (80 GB) | ~3-5 hours |
| 4x A10G (24 GB each) | ~2-4 hours |

---

### 10.4 Merging LoRA Weights (Optional)

To create a standalone model (no adapter overhead at inference):

```python
"""Merge LoRA adapter into base model weights."""
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

BASE_MODEL = "openai/gpt-oss-120b"
ADAPTER_PATH = "./output/pocketjury-legal-v1"
MERGED_PATH = "./output/pocketjury-legal-v1-merged"

# Load base + adapter
base_model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, device_map="auto")
model = PeftModel.from_pretrained(base_model, ADAPTER_PATH)

# Merge and save
merged_model = model.merge_and_unload()
merged_model.save_pretrained(MERGED_PATH)
AutoTokenizer.from_pretrained(ADAPTER_PATH).save_pretrained(MERGED_PATH)
```

---

### 10.5 Deploying the Fine-Tuned Model

#### Option A: Deploy via Ollama

Convert the merged model to GGUF format for Ollama:

```bash
# 1. Install llama.cpp conversion tools
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
pip install -r requirements.txt

# 2. Convert to GGUF (Q4_K_M quantization — good quality/size balance)
python convert_hf_to_gguf.py \
  ../output/pocketjury-legal-v1-merged \
  --outfile pocketjury-legal-v1.Q4_K_M.gguf \
  --outtype q4_k_m

# 3. Create an Ollama Modelfile
cat > Modelfile << 'EOF'
FROM ./pocketjury-legal-v1.Q4_K_M.gguf

SYSTEM """You are PocketJury, an AI legal assistant specializing in Indian law.
You provide accurate, accessible legal information in the user's language.
Always cite specific sections of Indian statutes (BNS, BNSS, BSA, Constitution).
Always map old IPC/CrPC sections to their BNS/BNSS equivalents.
Always include a disclaimer that this is not legal advice."""

PARAMETER temperature 0.1
PARAMETER num_ctx 4096
PARAMETER stop "<|im_end|>"
EOF

# 4. Create Ollama model
ollama create pocketjury-legal-ft -f Modelfile

# 5. Test
ollama run pocketjury-legal-ft "What is Section 498A IPC and its BNS equivalent?"
```

Then update PocketJury's `.env`:
```env
OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
LLM_MODEL_ID=pocketjury-legal-ft
```

#### Option B: Deploy via vLLM (Production)

For high-throughput production serving with GPU:

```bash
# Install vLLM
pip install vllm>=0.6.0

# Serve the merged model (or use LoRA adapter directly)
python -m vllm.entrypoints.openai.api_server \
  --model ./output/pocketjury-legal-v1-merged \
  --host 0.0.0.0 \
  --port 8001 \
  --max-model-len 4096 \
  --tensor-parallel-size 1 \
  --gpu-memory-utilization 0.9 \
  --dtype bfloat16

# Or serve base model + LoRA adapter (no merge needed)
python -m vllm.entrypoints.openai.api_server \
  --model openai/gpt-oss-120b \
  --enable-lora \
  --lora-modules pocketjury=./output/pocketjury-legal-v1 \
  --host 0.0.0.0 \
  --port 8001
```

Update PocketJury `config.py` to point to vLLM:
```python
# vLLM exposes an OpenAI-compatible API
OLLAMA_BASE_URL: str = "http://localhost:8001/v1"  # vLLM server
LLM_MODEL_ID: str = "pocketjury-legal-v1-merged"   # or adapter name
```

vLLM Docker Compose integration:
```yaml
services:
  vllm:
    image: vllm/vllm-openai:latest
    ports:
      - "8001:8001"
    volumes:
      - ./output/pocketjury-legal-v1-merged:/model
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    command: >
      --model /model
      --host 0.0.0.0
      --port 8001
      --max-model-len 4096

  ai:
    depends_on:
      - vllm
    environment:
      OLLAMA_BASE_URL: http://vllm:8001/v1
      LLM_MODEL_ID: /model
```

---

### 10.6 Testing the Fine-Tuned Model with PocketJury

#### Quick Smoke Test

```bash
# 1. Start the fine-tuned model (Ollama or vLLM)
ollama serve  # if using Ollama

# 2. Start PocketJury
docker compose up --build -d

# 3. Run test queries
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is Section 302 IPC and its BNS equivalent?"}'

curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "FIR दर्ज करने की प्रक्रिया बताएं"}'
```

#### Evaluation Checklist

| Test Category | What to Check | Pass Criteria |
|--------------|---------------|---------------|
| **IPC→BNS mapping** | Ask about 10 common IPC sections | Correct BNS section number in ≥90% |
| **Multilingual** | Ask in Hindi, Tamil, Bengali | Coherent response in same language |
| **Citation format** | Request case references | Correct AIR/SCC format |
| **Disclaimer** | Every response | Contains legal disclaimer |
| **Hallucination** | Ask about a non-existent section | Model says "not found" or similar |
| **Latency** | Time to first token | <2s (GPU), <10s (CPU) |
| **Context window** | Long multi-turn conversation | No degradation after 5+ turns |

#### Automated Evaluation Script

```python
"""Evaluate fine-tuned model against a test set."""
import json
import httpx
import asyncio

EVAL_DATA = "data/eval_set.jsonl"  # Hold-out test set
API_URL = "http://localhost:8000/api/v1/chat"

async def evaluate():
    correct = 0
    total = 0
    async with httpx.AsyncClient(timeout=60) as client:
        with open(EVAL_DATA, "r", encoding="utf-8") as f:
            for line in f:
                row = json.loads(line)
                question = row["question"]
                expected_keywords = row["expected_keywords"]  # List of must-have terms

                resp = await client.post(API_URL, json={"message": question})
                answer = resp.json().get("response", "").lower()

                hit = all(kw.lower() in answer for kw in expected_keywords)
                correct += int(hit)
                total += 1
                if not hit:
                    print(f"MISS: {question}")
                    print(f"  Expected keywords: {expected_keywords}")
                    print(f"  Got: {answer[:200]}...")

    print(f"\nAccuracy: {correct}/{total} ({100*correct/total:.1f}%)")

asyncio.run(evaluate())
```

---

### 10.7 Important Notes

1. **Model weight availability:** As of writing, `openai/gpt-oss-120b` is an
   open-weight release. Check the official Hugging Face page at
   [huggingface.co/openai](https://huggingface.co/openai) or OpenAI's release
   announcements for download instructions. You may need to accept a license
   agreement before accessing the weights.

2. **Hardware cost for fine-tuning:** If you don't have a local GPU, expect to
   spend ~$10-30 on cloud GPU rental for a full fine-tuning run (3 epochs, 5K
   samples). Services like [RunPod](https://runpod.io),
   [Lambda Labs](https://lambdalabs.com), or [Vast.ai](https://vast.ai) offer
   on-demand A100/H100 instances.

3. **Iterative improvement:** Start with a small dataset (~500 pairs), evaluate,
   identify failure patterns, add targeted training data, and retrain. Three to
   four iterations typically yield significant quality improvements.

4. **Legal compliance:** Ensure your training data is properly licensed. Court
   judgments and statutes are public domain in India, but third-party commentaries
   and annotations may be copyrighted.

5. **Model size considerations:** GPT-OSS-120B is a 120B parameter model. Even
   with 4-bit quantization (QLoRA), you'll need ~60 GB VRAM for training. For
   limited hardware, consider fine-tuning a smaller model (e.g., LLaMA 3.1 8B or
   Mistral 7B) using the same dataset and procedure above — just change `MODEL_ID`.

---

## 11. Future: Latency Optimisation with Local LLM

> **Status:** Not yet implemented. This section documents strategies for reducing
> response latency when migrating from OpenRouter (`gpt-oss-120b:free`) to a local
> LLM via Ollama. These techniques complement the SSE streaming already implemented
> in the current pipeline.

### 11.1 Problem: Sequential Translation Bottleneck

For non-English queries, the current pipeline makes **3 sequential LLM calls**:

```
User Query (Hindi) → [Translate to English] → [RAG Generation] → [Translate back to Hindi]
                          ~8-12s                    ~10-15s              ~10-15s
                     ─────────── Total: 30-40 seconds ───────────
```

With SSE streaming, users now see tokens arriving after ~2-4 seconds for English queries.
However, non-English queries still have a ~10-15 second delay before the first token
because both translation steps must complete before the main LLM generation begins.

### 11.2 Strategy A: Hybrid Model Routing

Use a **fast local LLM** (via Ollama) for translation while keeping the cloud LLM for
the critical legal reasoning stage:

```
User Query (Hindi) → [Local: Translate to English] → [Cloud: RAG Generation] → [Local: Translate back]
                           ~0.5-1s (Ollama)              ~10-15s (OpenRouter)       ~0.5-1s (Ollama)
                     ─────────── Total: ~12-17 seconds ───────────
```

**Implementation outline:**

```python
# In config.py
TRANSLATION_PROVIDER: str = "ollama"  # "ollama" or "openrouter"
OLLAMA_BASE_URL: str = "http://host.docker.internal:11434/v1"
TRANSLATION_MODEL_ID: str = "llama3.1:8b"

# In translator.py — modify to use a separate LLM client for translation
class TranslatorService:
    def __init__(self, cloud_llm: LLMClient, local_llm: LLMClient | None = None):
        self._llm = local_llm if local_llm else cloud_llm
```

**Impact:** Eliminates ~20 seconds of translation overhead for non-English queries.

### 11.3 Strategy B: Dedicated Translation Model

Replace the general-purpose LLM translation with a purpose-built neural machine
translation model from Helsinki-NLP (runs on CPU in <1 second):

| Language Pair | Model | Size | Speed (CPU) |
|--------------|-------|------|-------------|
| Hindi → English | `Helsinki-NLP/opus-mt-hi-en` | ~300 MB | ~0.3s |
| English → Hindi | `Helsinki-NLP/opus-mt-en-hi` | ~300 MB | ~0.3s |
| Tamil → English | `Helsinki-NLP/opus-mt-ta-en` | ~300 MB | ~0.3s |
| Bengali → English | `Helsinki-NLP/opus-mt-bn-en` | ~300 MB | ~0.3s |

```python
# Install: pip install transformers sentencepiece
from transformers import MarianMTModel, MarianTokenizer

class NMTTranslator:
    def __init__(self):
        self._models = {}
    
    def _load_model(self, src: str, tgt: str):
        model_name = f"Helsinki-NLP/opus-mt-{src}-{tgt}"
        tokenizer = MarianTokenizer.from_pretrained(model_name)
        model = MarianMTModel.from_pretrained(model_name)
        return tokenizer, model
    
    def translate(self, text: str, src: str, tgt: str) -> str:
        key = f"{src}-{tgt}"
        if key not in self._models:
            self._models[key] = self._load_model(src, tgt)
        tokenizer, model = self._models[key]
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        translated = model.generate(**inputs)
        return tokenizer.decode(translated[0], skip_special_tokens=True)
```

**Trade-off:** Lower translation quality than LLM-based translation for complex legal
sentences, but ~30x faster. Can be combined with Strategy A as a fallback.

### 11.4 Strategy C: Streaming with Ollama

Ollama natively supports the OpenAI-compatible streaming API. The `generate_stream()`
method added to `llm_client.py` works unchanged with Ollama — just point the config
to the local endpoint:

```env
# .env — switch to Ollama for all LLM calls
OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
LLM_MODEL_ID=llama3.1:8b
```

With a GPU (RTX 3060+), expect:
- **Time to first token:** ~0.5-1s (vs 2-4s with OpenRouter)
- **Token throughput:** ~30-50 tokens/sec (vs variable with OpenRouter free tier)
- **No rate limits:** Unlimited queries per day

### 11.5 Strategy D: Semantic Caching with Redis

Cache LLM responses for semantically similar queries. Common legal questions like
"How to file an FIR?" or "What are my rights if arrested?" can return cached answers
in <1 second:

```python
import numpy as np
from app.core.embedder import EmbedderService

class SemanticCache:
    """Cache LLM responses keyed by query embedding similarity."""
    
    SIMILARITY_THRESHOLD = 0.92  # Only cache hits with >92% similarity
    TTL = 86400  # 24 hours
    
    def __init__(self, embedder: EmbedderService, redis_client):
        self._embedder = embedder
        self._redis = redis_client
    
    async def get(self, query: str) -> str | None:
        query_embedding = self._embedder.embed_query(query)
        # Search cached embeddings for similar queries
        cached_keys = await self._redis.keys("cache:query:*")
        for key in cached_keys:
            cached = await self._redis.hgetall(key)
            cached_embedding = np.frombuffer(cached["embedding"], dtype=np.float32)
            similarity = np.dot(query_embedding, cached_embedding)
            if similarity > self.SIMILARITY_THRESHOLD:
                return cached["response"]
        return None
    
    async def set(self, query: str, response: str):
        embedding = self._embedder.embed_query(query)
        key = f"cache:query:{hash(query)}"
        await self._redis.hset(key, mapping={
            "embedding": np.array(embedding, dtype=np.float32).tobytes(),
            "response": response,
        })
        await self._redis.expire(key, self.TTL)
```

**Impact:** Cache hit rate of ~15-25% for typical legal information queries,
eliminating LLM calls entirely for those queries.

### 11.6 Combined Impact (All Strategies)

| Scenario | Current | With All Optimisations |
|----------|---------|----------------------|
| English query (cache hit) | 15-20s | **<1s** |
| English query (cache miss) | 15-20s | **0.5-1s** TTFT |
| Hindi query (cache miss) | 30-40s | **1-2s** TTFT |
| Total pipeline (Hindi, worst case) | 30-40s | **~13-17s** total |

> **Recommendation:** Implement in this order: C (Ollama streaming) → D (semantic cache)
> → A (hybrid routing) → B (NMT translation). Each step independently improves latency.

---

## More Resources

- [Ollama Documentation](https://github.com/ollama/ollama)
- [Ollama Model Library](https://ollama.com/library)
- [`MIGRATE_API.md`](MIGRATE_API.md) — Switch between cloud LLM providers
- [`POCKETJURY.md`](POCKETJURY.md) — Full technical documentation
- [`FURTHER_PHASE.md`](FURTHER_PHASE.md) — Environment variables reference
