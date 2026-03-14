# 🔄 LLM Provider Migration Guide — PocketJury

> **Step-by-step instructions for switching between LLM providers: OpenRouter (current), OpenAI, Anthropic, Google Gemini, AWS Bedrock, Groq, and DeepSeek.**

---

## Table of Contents

- [1. Architecture Overview](#1-architecture-overview)
- [2. Current Setup (OpenRouter)](#2-current-setup-openrouter)
- [3. Switch to Anthropic (Claude)](#3-switch-to-anthropic-claude)
- [4. Switch to OpenAI](#4-switch-to-openai)
- [5. Switch to Google Gemini](#5-switch-to-google-gemini)
- [6. Switch to AWS Bedrock](#6-switch-to-aws-bedrock)
- [7. Switch to Groq API](#7-switch-to-groq-api)
- [8. Switch to DeepSeek API](#8-switch-to-deepseek-api)
- [9. Files to Modify (Checklist)](#9-files-to-modify-checklist)
- [10. Testing After Migration](#10-testing-after-migration)

---

## 1. Architecture Overview

The LLM integration is isolated in **3 files** — switching providers requires changes to only these files plus environment variables:

```
services/ai/
├── app/
│   ├── config.py              ← Environment variable definitions
│   └── core/
│       └── llm_client.py      ← LLM API client (THE MAIN FILE)
└── requirements.txt           ← Python dependencies
```

**Plus environment configuration:**
```
.env                           ← API keys and model ID
docker-compose.yml             ← Env var passthrough to container
```

### LLMClient Interface Contract

Every provider implementation must expose these two methods:

```python
class LLMClient:
    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
        stop_sequences: list[str] | None = None,
    ) -> str: ...

    async def generate_with_history(
        self,
        messages: list[dict[str, str]],  # [{"role": "user"|"assistant", "content": "..."}]
        system_prompt: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> str: ...
```

As long as these methods return a plain `str`, the rest of the 13-stage RAG pipeline works unchanged.

---

## 2. Current Setup (OpenRouter)

**Provider**: OpenRouter  
**Model**: `gpt-oss-120b:free`  
**SDK**: `openai` (with custom `base_url`)

OpenRouter is a unified API gateway that provides access to hundreds of models from OpenAI, Anthropic, Google, Meta, and others through a single OpenAI-compatible endpoint. It supports free-tier models, making it ideal for development and prototyping.

### config.py (current)
```python
OPENROUTER_API_KEY: str = ""
LLM_MODEL_ID: str = "gpt-oss-120b:free"
LLM_TEMPERATURE: float = 0.1
LLM_MAX_TOKENS: int = 2048
```

### llm_client.py (current)
```python
from openai import AsyncOpenAI

class LLMClient:
    def __init__(self) -> None:
        self._client = AsyncOpenAI(
            api_key=settings.OPENROUTER_API_KEY,
            base_url="https://openrouter.ai/api/v1",
        )
        self._model_id = settings.LLM_MODEL_ID

    async def generate(self, prompt, system_prompt=None, max_tokens=None, temperature=None, stop_sequences=None):
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await self._client.chat.completions.create(
            model=self._model_id,
            messages=messages,
            max_tokens=max_tokens or settings.LLM_MAX_TOKENS,
            temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
            stop=stop_sequences,
        )
        return response.choices[0].message.content or ""
```

### requirements.txt entry
```
openai==1.58.1
```

### .env
```env
OPENROUTER_API_KEY=sk-or-v1-...
LLM_MODEL_ID=gpt-oss-120b:free
```

### docker-compose.yml (ai service environment)
```yaml
OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:-}
LLM_MODEL_ID: ${LLM_MODEL_ID:-gpt-oss-120b:free}
```

### Available OpenRouter Models
| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| `openai/gpt-oss-120b:free` | Fast | Free | **Recommended** — current default |
| `google/gemini-2.0-flash-exp:free` | Very fast | Free | Free Gemini via OpenRouter |
| `meta-llama/llama-3.3-70b-instruct:free` | Fast | Free | Open-source, free |
| `anthropic/claude-3.5-sonnet` | Fast | ~$3/1M tokens | High quality, paid |
| `openai/gpt-4o` | Fast | ~$5/1M tokens | OpenAI flagship, paid |

> **Note:** OpenRouter uses the OpenAI SDK with a custom `base_url`. This means switching to direct OpenAI only requires changing the `base_url` and API key — the rest of the code stays the same.

---

## 3. Switch to Anthropic (Claude)

### Step 1: Get API Key
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Format: `sk-ant-api03-...`

### Step 2: Update `requirements.txt`

```diff
- openai==1.58.1
+ anthropic==0.52.0
```

### Step 3: Update `config.py`

```python
# Replace OpenRouter section with:
ANTHROPIC_API_KEY: str = ""
LLM_MODEL_ID: str = "claude-sonnet-4-20250514"
LLM_TEMPERATURE: float = 0.1
LLM_MAX_TOKENS: int = 2048
```

### Step 4: Rewrite `llm_client.py`

```python
# ==============================================================================
# PocketJury AI Service — LLM Client (Anthropic Claude API)
# ==============================================================================

from __future__ import annotations

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


class LLMClient:
    """Client for Anthropic Claude API."""

    def __init__(self) -> None:
        import anthropic

        api_key = settings.ANTHROPIC_API_KEY
        if not api_key:
            logger.warning("ANTHROPIC_API_KEY not set — LLM calls will fail")

        self._client = anthropic.AsyncAnthropic(api_key=api_key or "missing")
        self._model_id = settings.LLM_MODEL_ID

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
        """Generate a response from Claude via the Anthropic API."""
        kwargs: dict = {
            "model": self._model_id,
            "max_tokens": max_tokens or settings.LLM_MAX_TOKENS,
            "temperature": temperature if temperature is not None else settings.LLM_TEMPERATURE,
            "messages": [{"role": "user", "content": prompt}],
        }

        if system_prompt:
            kwargs["system"] = system_prompt
        if stop_sequences:
            kwargs["stop_sequences"] = stop_sequences

        try:
            response = await self._client.messages.create(**kwargs)
            generated_text = response.content[0].text

            logger.debug(
                "LLM response generated",
                model=self._model_id,
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                stop_reason=response.stop_reason,
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
        kwargs: dict = {
            "model": self._model_id,
            "max_tokens": max_tokens or settings.LLM_MAX_TOKENS,
            "temperature": temperature if temperature is not None else settings.LLM_TEMPERATURE,
            "messages": messages,
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        try:
            response = await self._client.messages.create(**kwargs)
            return response.content[0].text
        except Exception as e:
            logger.error("LLM generation with history failed", error=str(e))
            raise
```

### Step 5: Update `.env`
```env
ANTHROPIC_API_KEY=sk-ant-api03-...
LLM_MODEL_ID=claude-sonnet-4-20250514
```

### Step 6: Update `docker-compose.yml`
```yaml
# AI service environment section:
ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
LLM_MODEL_ID: ${LLM_MODEL_ID:-claude-sonnet-4-20250514}
```

### Step 7: Rebuild
```bash
docker compose up --build -d ai
```

### Available Anthropic Models
| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| `claude-sonnet-4-20250514` | Fast | ~$3/1M tokens | Best balance |
| `claude-3-5-haiku-20241022` | Very fast | ~$0.25/1M tokens | Budget-friendly |
| `claude-opus-4-20250514` | Slow | ~$15/1M tokens | Highest quality |

> **Note:** Anthropic uses a different message format — `system` is a top-level parameter, not a message role. The code above handles this correctly.

---

## 4. Switch to OpenAI

### Step 1: Get API Key
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Format: `sk-proj-...`

### Step 2: Update `requirements.txt`

```diff
- openai==1.58.1
  # (openai SDK is already in requirements.txt — no package change needed,
  #  just update config.py and llm_client.py to point directly at OpenAI)
```

> **Note:** Since OpenRouter already uses the `openai` SDK, switching to direct OpenAI only requires removing the custom `base_url` and changing the API key.

### Step 3: Update `config.py`

```python
# Replace OpenRouter section with:
OPENAI_API_KEY: str = ""
LLM_MODEL_ID: str = "gpt-4o"
LLM_TEMPERATURE: float = 0.1
LLM_MAX_TOKENS: int = 2048
```

### Step 4: Rewrite `llm_client.py`

```python
# ==============================================================================
# PocketJury AI Service — LLM Client (OpenAI API)
# ==============================================================================

from __future__ import annotations

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


class LLMClient:
    """Client for OpenAI API."""

    def __init__(self) -> None:
        from openai import AsyncOpenAI

        api_key = settings.OPENAI_API_KEY
        if not api_key:
            logger.warning("OPENAI_API_KEY not set — LLM calls will fail")

        self._client = AsyncOpenAI(api_key=api_key or "missing")
        self._model_id = settings.LLM_MODEL_ID

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
        """Generate a response from OpenAI."""
        messages = []
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
        api_messages = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        api_messages.extend(messages)

        try:
            response = await self._client.chat.completions.create(
                model=self._model_id,
                messages=api_messages,
                max_tokens=max_tokens or settings.LLM_MAX_TOKENS,
                temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error("LLM generation with history failed", error=str(e))
            raise
```

### Step 5: Update `.env`
```env
OPENAI_API_KEY=sk-proj-...
LLM_MODEL_ID=gpt-4o
```

### Step 6: Update `docker-compose.yml`
```yaml
OPENAI_API_KEY: ${OPENAI_API_KEY:-}
LLM_MODEL_ID: ${LLM_MODEL_ID:-gpt-4o}
```

### Step 7: Rebuild
```bash
docker compose up --build -d ai
```

### Available OpenAI Models
| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| `gpt-4o` | Fast | ~$5/1M tokens | Best balance of quality and speed |
| `gpt-4o-mini` | Very fast | ~$0.15/1M tokens | Budget-friendly, good for demos |
| `gpt-4-turbo` | Medium | ~$10/1M tokens | Highest quality |
| `o1-mini` | Slow | ~$3/1M tokens | Complex reasoning |

---

## 5. Switch to Google Gemini

### Overview

Google Gemini offers fast, capable models with a generous free tier (15 RPM). It uses its own SDK (`google-generativeai`) with a different API pattern than the OpenAI-compatible providers.

### Step 1: Get API Key
1. Go to [aistudio.google.dev](https://aistudio.google.dev)
2. Create an API key
3. Format: `AIzaSy...`

### Step 2: Update `requirements.txt`

```diff
- openai==1.58.1
+ google-generativeai>=0.8.0
```

### Step 3: Update `config.py`

```python
# Replace OpenRouter section with:
GEMINI_API_KEY: str = ""
LLM_MODEL_ID: str = "gemini-2.0-flash"
LLM_TEMPERATURE: float = 0.1
LLM_MAX_TOKENS: int = 2048
```

### Step 4: Rewrite `llm_client.py`

```python
# ==============================================================================
# PocketJury AI Service — LLM Client (Google Gemini API)
# ==============================================================================

from __future__ import annotations

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


class LLMClient:
    """Client for Google Gemini API."""

    def __init__(self) -> None:
        import google.generativeai as genai

        api_key = settings.GEMINI_API_KEY
        if not api_key:
            logger.warning("GEMINI_API_KEY not set — LLM calls will fail")

        genai.configure(api_key=api_key or "missing")
        self._genai = genai
        self._model_id = settings.LLM_MODEL_ID

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
        """Generate a response from Google Gemini."""
        model = self._genai.GenerativeModel(
            model_name=self._model_id,
            system_instruction=system_prompt,
            generation_config=self._genai.GenerationConfig(
                max_output_tokens=max_tokens or settings.LLM_MAX_TOKENS,
                temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
                stop_sequences=stop_sequences or [],
            ),
        )

        try:
            response = await model.generate_content_async(prompt)
            generated_text = response.text

            logger.debug(
                "LLM response generated",
                model=self._model_id,
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
        model = self._genai.GenerativeModel(
            model_name=self._model_id,
            system_instruction=system_prompt,
            generation_config=self._genai.GenerationConfig(
                max_output_tokens=max_tokens or settings.LLM_MAX_TOKENS,
                temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
            ),
        )

        # Convert OpenAI-style messages to Gemini format
        gemini_history = []
        for msg in messages[:-1]:
            role = "user" if msg["role"] == "user" else "model"
            gemini_history.append({"role": role, "parts": [msg["content"]]})

        try:
            chat = model.start_chat(history=gemini_history)
            last_message = messages[-1]["content"] if messages else ""
            response = await chat.send_message_async(last_message)
            return response.text
        except Exception as e:
            logger.error("LLM generation with history failed", error=str(e))
            raise
```

### Step 5: Update `.env`
```env
GEMINI_API_KEY=AIzaSy...
LLM_MODEL_ID=gemini-2.0-flash
```

### Step 6: Update `docker-compose.yml`
```yaml
GEMINI_API_KEY: ${GEMINI_API_KEY:-}
LLM_MODEL_ID: ${LLM_MODEL_ID:-gemini-2.0-flash}
```

### Step 7: Rebuild
```bash
docker compose up --build -d ai
```

### Available Gemini Models
| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| `gemini-2.0-flash` | Very fast | Free tier available | **Recommended** — fast, capable |
| `gemini-2.0-flash-lite` | Very fast | Free tier available | Budget-friendly, lightweight |
| `gemini-1.5-pro` | Medium | ~$1.25/1M tokens | Stable, proven |
| `gemini-1.5-flash` | Very fast | ~$0.075/1M tokens | Budget-friendly |

> **Note:** Gemini uses a different SDK and message format than OpenAI-compatible providers. The `generate_with_history` method converts OpenAI-style messages to Gemini's `history` + `send_message` pattern.

---

## 6. Switch to AWS Bedrock

### Step 1: Enable Bedrock Access
1. AWS Console → Amazon Bedrock → Model access
2. Request access to: `Anthropic Claude 3.5 Sonnet`
3. Wait for approval (usually instant for Anthropic models)

### Step 2: Update `requirements.txt`

```diff
- openai==1.58.1
+ boto3>=1.34.0
```

### Step 3: Update `config.py`

```python
# Replace OpenRouter section with:
AWS_ACCESS_KEY_ID: str = ""
AWS_SECRET_ACCESS_KEY: str = ""
AWS_REGION: str = "ap-south-1"
BEDROCK_MODEL_ID: str = "anthropic.claude-3-5-sonnet-20241022-v2:0"
LLM_TEMPERATURE: float = 0.1
LLM_MAX_TOKENS: int = 2048
```

### Step 4: Rewrite `llm_client.py`

```python
# ==============================================================================
# PocketJury AI Service — LLM Client (AWS Bedrock)
# ==============================================================================

from __future__ import annotations

import asyncio
import json
import structlog
import boto3
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


class LLMClient:
    """Client for AWS Bedrock (Claude models)."""

    def __init__(self) -> None:
        self._client = boto3.client(
            "bedrock-runtime",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        )
        self._model_id = settings.BEDROCK_MODEL_ID

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
        """Generate via AWS Bedrock (sync wrapped in executor)."""
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens or settings.LLM_MAX_TOKENS,
            "temperature": temperature if temperature is not None else settings.LLM_TEMPERATURE,
            "messages": [{"role": "user", "content": prompt}],
        }

        if system_prompt:
            body["system"] = system_prompt
        if stop_sequences:
            body["stop_sequences"] = stop_sequences

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._client.invoke_model(
                    modelId=self._model_id,
                    contentType="application/json",
                    accept="application/json",
                    body=json.dumps(body),
                ),
            )

            result = json.loads(response["body"].read())
            generated_text = result["content"][0]["text"]

            logger.debug(
                "LLM response generated",
                model=self._model_id,
                input_tokens=result.get("usage", {}).get("input_tokens", 0),
                output_tokens=result.get("usage", {}).get("output_tokens", 0),
                stop_reason=result.get("stop_reason"),
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
        """Generate with conversation history via Bedrock."""
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens or settings.LLM_MAX_TOKENS,
            "temperature": temperature if temperature is not None else settings.LLM_TEMPERATURE,
            "messages": messages,
        }
        if system_prompt:
            body["system"] = system_prompt

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._client.invoke_model(
                    modelId=self._model_id,
                    contentType="application/json",
                    accept="application/json",
                    body=json.dumps(body),
                ),
            )
            result = json.loads(response["body"].read())
            return result["content"][0]["text"]

        except Exception as e:
            logger.error("LLM generation with history failed", error=str(e))
            raise
```

### Step 5: Update `.env`
```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

### Step 6: Update `docker-compose.yml`
```yaml
AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:-}
AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY:-}
AWS_REGION: ${AWS_REGION:-ap-south-1}
LLM_MODEL_ID: ${BEDROCK_MODEL_ID:-anthropic.claude-3-5-sonnet-20241022-v2:0}
```

### Step 7: Rebuild
```bash
docker compose up --build -d ai
```

### Available Bedrock Models
| Model | Model ID | Best For |
|-------|----------|----------|
| Claude 3.5 Sonnet v2 | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Best balance |
| Claude 3.5 Haiku | `anthropic.claude-3-5-haiku-20241022-v1:0` | Fast & cheap |
| Claude 3 Opus | `anthropic.claude-3-opus-20240229-v1:0` | Highest quality |
| Llama 3.1 70B | `meta.llama3-1-70b-instruct-v1:0` | Open-source alternative |

> **Note:** Bedrock uses `invoke_model` (sync API) wrapped in `asyncio.run_in_executor()` since there's no native async boto3 Bedrock client. For production, consider [aioboto3](https://github.com/aio-libs/aioboto3).

---

## 7. Switch to Groq API

### Overview

[Groq](https://groq.com) provides ultra-fast LLM inference powered by their custom LPU (Language Processing Unit) hardware. Groq Cloud API offers some of the fastest token generation speeds available, with a generous free tier ideal for development and prototyping. The API is OpenAI-compatible, making migration from OpenRouter straightforward.

### Step 1: Get API Key
1. Go to [console.groq.com/keys](https://console.groq.com/keys)
2. Create an API key
3. Format: `gsk_...`

### Step 2: Update `requirements.txt`

```diff
  # No change needed — Groq uses the openai SDK with a custom base_url
  openai==1.58.1
```

### Step 3: Update `config.py`

```python
# Replace OpenRouter section with:
GROQ_API_KEY: str = ""
LLM_MODEL_ID: str = "llama-3.3-70b-versatile"
LLM_TEMPERATURE: float = 0.1
LLM_MAX_TOKENS: int = 2048
```

### Step 4: Rewrite `llm_client.py`

```python
# ==============================================================================
# PocketJury AI Service — LLM Client (Groq API)
# ==============================================================================

from __future__ import annotations

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


class LLMClient:
    """Client for Groq API (OpenAI-compatible)."""

    def __init__(self) -> None:
        from openai import AsyncOpenAI

        api_key = settings.GROQ_API_KEY
        if not api_key:
            logger.warning("GROQ_API_KEY not set — LLM calls will fail")

        self._client = AsyncOpenAI(
            api_key=api_key or "missing",
            base_url="https://api.groq.com/openai/v1",
        )
        self._model_id = settings.LLM_MODEL_ID

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
        """Generate a response from Groq."""
        messages = []
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
        api_messages = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        api_messages.extend(messages)

        try:
            response = await self._client.chat.completions.create(
                model=self._model_id,
                messages=api_messages,
                max_tokens=max_tokens or settings.LLM_MAX_TOKENS,
                temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error("LLM generation with history failed", error=str(e))
            raise
```

### Step 5: Update `.env`
```env
GROQ_API_KEY=gsk_...
LLM_MODEL_ID=llama-3.3-70b-versatile
```

### Step 6: Update `docker-compose.yml`
```yaml
GROQ_API_KEY: ${GROQ_API_KEY:-}
LLM_MODEL_ID: ${LLM_MODEL_ID:-llama-3.3-70b-versatile}
```

### Step 7: Rebuild
```bash
docker compose up --build -d ai
```

### Available Groq Models
| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| `llama-3.3-70b-versatile` | Very fast | Free tier (6K req/day) | **Recommended** — best quality on Groq |
| `gemma2-9b-it` | Very fast | Free tier (14.4K req/day) | Lightweight, fast responses |
| `mixtral-8x7b-32768` | Very fast | Free tier (14.4K req/day) | Large 32K context window |

### Groq Comparison Notes

| Aspect | Details |
|--------|---------|
| **Speed** | Fastest inference available — 500+ tokens/sec on LPU hardware |
| **Cost** | Generous free tier with daily rate limits; paid plans for higher throughput |
| **Model quality** | Hosts open-source models (Llama, Gemma, Mixtral) — not proprietary like GPT-4o/Claude |
| **Best for** | Development, prototyping, latency-sensitive applications |

> **Note:** Groq uses the OpenAI SDK with `base_url="https://api.groq.com/openai/v1"`. The code is nearly identical to the OpenRouter setup — only the `base_url` and API key differ.

---

## 8. Switch to DeepSeek API

### Overview

[DeepSeek](https://deepseek.com) offers cost-effective, high-quality LLM models with strong reasoning capabilities. Their `deepseek-chat` model rivals GPT-4 class models at a fraction of the cost, and `deepseek-reasoner` provides chain-of-thought reasoning similar to OpenAI's o1 series. The API is OpenAI-compatible.

### Step 1: Get API Key
1. Go to [platform.deepseek.com/api-keys](https://platform.deepseek.com/api-keys)
2. Create an API key
3. Format: `sk-...`

### Step 2: Update `requirements.txt`

```diff
  # No change needed — DeepSeek uses the openai SDK with a custom base_url
  openai==1.58.1
```

### Step 3: Update `config.py`

```python
# Replace OpenRouter section with:
DEEPSEEK_API_KEY: str = ""
LLM_MODEL_ID: str = "deepseek-chat"
LLM_TEMPERATURE: float = 0.1
LLM_MAX_TOKENS: int = 2048
```

### Step 4: Rewrite `llm_client.py`

```python
# ==============================================================================
# PocketJury AI Service — LLM Client (DeepSeek API)
# ==============================================================================

from __future__ import annotations

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


class LLMClient:
    """Client for DeepSeek API (OpenAI-compatible)."""

    def __init__(self) -> None:
        from openai import AsyncOpenAI

        api_key = settings.DEEPSEEK_API_KEY
        if not api_key:
            logger.warning("DEEPSEEK_API_KEY not set — LLM calls will fail")

        self._client = AsyncOpenAI(
            api_key=api_key or "missing",
            base_url="https://api.deepseek.com",
        )
        self._model_id = settings.LLM_MODEL_ID

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
        """Generate a response from DeepSeek."""
        messages = []
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
        api_messages = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        api_messages.extend(messages)

        try:
            response = await self._client.chat.completions.create(
                model=self._model_id,
                messages=api_messages,
                max_tokens=max_tokens or settings.LLM_MAX_TOKENS,
                temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error("LLM generation with history failed", error=str(e))
            raise
```

### Step 5: Update `.env`
```env
DEEPSEEK_API_KEY=sk-...
LLM_MODEL_ID=deepseek-chat
```

### Step 6: Update `docker-compose.yml`
```yaml
DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-}
LLM_MODEL_ID: ${LLM_MODEL_ID:-deepseek-chat}
```

### Step 7: Rebuild
```bash
docker compose up --build -d ai
```

### Available DeepSeek Models
| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| `deepseek-chat` | Fast | ~$0.27/1M input, ~$1.10/1M output | **Recommended** — GPT-4 class at low cost |
| `deepseek-reasoner` | Medium | ~$0.55/1M input, ~$2.19/1M output | Complex reasoning, chain-of-thought |

### DeepSeek Comparison Notes

| Aspect | Details |
|--------|---------|
| **Cost** | One of the cheapest providers — up to 50× cheaper than GPT-4o |
| **Reasoning quality** | `deepseek-reasoner` provides explicit chain-of-thought reasoning |
| **Context window** | 64K tokens for `deepseek-chat`, 64K for `deepseek-reasoner` |
| **Best for** | Budget-conscious deployments, reasoning-heavy legal queries |

> **Note:** DeepSeek uses the OpenAI SDK with `base_url="https://api.deepseek.com"`. The code is nearly identical to OpenRouter/Groq — only the `base_url` and API key differ.

---

## 9. Files to Modify (Checklist)

For **any** provider switch, modify these files:

| # | File | What to Change |
|---|------|---------------|
| 1 | `services/ai/app/config.py` | API key field name, model ID default |
| 2 | `services/ai/app/core/llm_client.py` | Full rewrite of LLMClient class |
| 3 | `services/ai/requirements.txt` | Replace SDK package |
| 4 | `.env` | API key value, model ID |
| 5 | `docker-compose.yml` | Env var names in `ai` service section (~line 87-88) |
| 6 | `.env.example` | Update template for new users |

**Files that do NOT need changes:**
- `rag_pipeline.py` — Calls `llm.generate()` which is the same interface for all providers
- `prompt_templates.py` — Prompts are provider-agnostic
- `routes/query.py` — Uses the pipeline, not the LLM directly
- Any Express API or Next.js code — They don't interact with the LLM

---

## 10. Testing After Migration

After switching providers, verify the full pipeline:

```bash
# 1. Rebuild AI container
docker compose up --build -d ai

# 2. Wait for health (model loading takes ~60-90s)
docker compose logs -f ai  # Watch for "AI Service ready"

# 3. Test health endpoint
curl http://localhost:8000/health

# 4. Test a direct query (bypassing Express API)
curl -X POST http://localhost:8000/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are my rights as a tenant in India?",
    "user_id": "test-user",
    "chat_id": "test-chat",
    "language": "en",
    "persona": "GENERAL"
  }'

# 5. Check logs for errors
docker compose logs ai --tail 50
```

**Expected response:** A JSON with `answer`, `references`, `helplines`, `disclaimer` fields. If you get a 500 error, check the AI container logs for the specific error message (usually authentication or model access issues).

---

## Quick Reference: Provider Comparison

| Feature | OpenRouter *(current)* | OpenAI | Anthropic | Google Gemini | AWS Bedrock | Groq | DeepSeek |
|---------|------------------------|--------|-----------|---------------|-------------|------|----------|
| **SDK** | `openai` (custom base_url) | `openai` | `anthropic` | `google-generativeai` | `boto3` | `openai` (custom base_url) | `openai` (custom base_url) |
| **Async** | Native | Native | Native | Via executor | Via executor | Native | Native |
| **Free tier** | Yes (model-dependent) | No | No | Yes (15 RPM) | No | Yes (6K req/day) | No |
| **Key format** | `sk-or-v1-...` | `sk-proj-...` | `sk-ant-...` | `AIza...` | AWS IAM | `gsk_...` | `sk-...` |
| **System prompt** | Message role | Message role | Top-level param | Model config | Top-level param | Message role | Message role |
| **Best model** | gpt-oss-120b:free | gpt-4o | Claude 3.5 Sonnet | Gemini 2.0 Flash | Claude 3.5 Sonnet | Llama 3.3 70B | deepseek-chat |
| **India latency** | ~200-400ms | ~200-400ms | ~200-400ms | ~150-300ms | ~50-100ms (ap-south-1) | ~200-400ms | ~200-400ms |
| **Cost** | Free models available | ~$5/1M tokens | ~$3/1M tokens | Free tier available | ~$3/1M tokens | Free tier available | ~$0.27/1M tokens |
| **Strength** | Model variety, free tier | Quality, ecosystem | Safety, reasoning | Speed, free tier | Low latency (India) | Fastest inference | Cheapest, reasoning |
