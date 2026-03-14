# ==============================================================================
# PocketJury AI Service — Translation Service
# ==============================================================================

from __future__ import annotations

import structlog
from app.core.llm_client import LLMClient
from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "ta": "Tamil",
    "bn": "Bengali",
}


class TranslatorService:
    """
    Translation service using Claude for high-quality legal translation.
    Handles en↔hi, en↔ta, en↔bn translations.
    """

    def __init__(self, llm_client: LLMClient) -> None:
        self._llm = llm_client

    async def translate(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
    ) -> str:
        """
        Translate text between supported languages.

        Args:
            text: Text to translate
            source_lang: Source language code (en/hi/ta/bn)
            target_lang: Target language code (en/hi/ta/bn)

        Returns:
            Translated text
        """
        if source_lang == target_lang:
            return text

        if not text.strip():
            return text

        source_name = LANGUAGE_NAMES.get(source_lang, source_lang)
        target_name = LANGUAGE_NAMES.get(target_lang, target_lang)

        prompt = f"""Translate the following text from {source_name} to {target_name}.

Rules:
- Preserve legal terminology accuracy — use the standard {target_name} legal terms
- Keep section numbers, article numbers, and case citations unchanged
- Keep phone numbers, URLs, and email addresses unchanged
- Maintain the original formatting (bullet points, numbering, paragraphs)
- If a legal term has no direct equivalent, keep the English term and add the {target_name} explanation in parentheses
- Do NOT add any explanations, commentary, or notes — only output the translation
- Preserve any disclaimers or warnings exactly as they are

Text to translate:
{text}

Translation:"""

        system_prompt = (
            f"You are a professional legal translator specializing in Indian law. "
            f"Translate accurately from {source_name} to {target_name}. "
            f"Output ONLY the translated text, nothing else."
        )

        translated = await self._llm.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.1,
            max_tokens=min(len(text) * 32, settings.LLM_MAX_TOKENS),  # High multiplier for non-Latin unicode tokenization
        )

        return translated.strip()

    async def translate_to_english(self, text: str, source_lang: str) -> str:
        """Convenience method to translate any supported language to English."""
        if source_lang == "en":
            return text
        return await self.translate(text, source_lang, "en")

    async def translate_from_english(self, text: str, target_lang: str) -> str:
        """Convenience method to translate English to any supported language."""
        if target_lang == "en":
            return text
        return await self.translate(text, "en", target_lang)
