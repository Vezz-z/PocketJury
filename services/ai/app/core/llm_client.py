# ==============================================================================
# PocketJury AI Service — LLM Client (OpenRouter API — OpenAI-compatible)
# ==============================================================================

from __future__ import annotations

from typing import AsyncIterator

import structlog
from openai import AsyncOpenAI, RateLimitError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

RATE_LIMIT_MESSAGE = (
    "⚠️ **Service Notice**: The daily free request limit for the AI model has been "
    "reached. Please try again tomorrow or add credits to your OpenRouter account "
    "to restore service."
)


class LLMClient:
    """Client for OpenRouter API (OpenAI-compatible endpoint).

    Uses the model configured via ``LLM_MODEL_ID`` (default: gpt-oss-120b:free).
    Supports both standard (blocking) and streaming generation.
    """

    def __init__(self) -> None:
        api_key = settings.OPENROUTER_API_KEY
        if not api_key:
            logger.warning("OPENROUTER_API_KEY not set — LLM calls will fail")

        self._client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key or "missing",
            default_headers={
                "HTTP-Referer": "https://pocketjury.app",
                "X-Title": "PocketJury",
            },
        )
        self._model_id = settings.LLM_MODEL_ID
        logger.info("LLM client initialized (OpenRouter)", model=self._model_id)

    # ------------------------------------------------------------------
    # Standard (blocking) generation
    # ------------------------------------------------------------------

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
        """Generate a complete response from OpenRouter (non-streaming).

        Used for translation, simplification, and other auxiliary LLM tasks
        where streaming is not needed.
        """
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            response = await self._client.chat.completions.create(
                model=self._model_id,
                messages=messages,
                max_tokens=max_tokens or settings.LLM_MAX_TOKENS,
                temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
                stop=stop_sequences or None,
                extra_body={
                    "provider": {"data_collection": "allow"},
                },
            )

            generated_text = response.choices[0].message.content or ""

            usage = response.usage
            logger.debug(
                "LLM response generated",
                model=self._model_id,
                input_tokens=usage.prompt_tokens if usage else 0,
                output_tokens=usage.completion_tokens if usage else 0,
            )

            return generated_text

        except RateLimitError as e:
            logger.warning("LLM rate limit reached (429)", error=str(e), model=self._model_id)
            return RATE_LIMIT_MESSAGE
        except Exception as e:
            logger.error("LLM generation failed", error=str(e), model=self._model_id)
            raise

    # ------------------------------------------------------------------
    # Streaming generation (SSE)
    # ------------------------------------------------------------------

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
        stop_sequences: list[str] | None = None,
    ) -> AsyncIterator[str]:
        """Stream tokens from OpenRouter as they are generated.

        Yields individual text chunks (deltas) as they arrive from the API.
        Used for the main legal RAG generation to reduce time-to-first-token.
        """
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            stream = await self._client.chat.completions.create(
                model=self._model_id,
                messages=messages,
                max_tokens=max_tokens or settings.LLM_MAX_TOKENS,
                temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
                stop=stop_sequences or None,
                stream=True,
                extra_body={
                    "provider": {"data_collection": "allow"},
                },
            )

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except RateLimitError as e:
            logger.warning("LLM stream rate limit reached (429)", error=str(e), model=self._model_id)
            yield RATE_LIMIT_MESSAGE
        except Exception as e:
            logger.error("LLM streaming failed", error=str(e), model=self._model_id)
            raise
