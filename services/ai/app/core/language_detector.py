# ==============================================================================
# PocketJury AI Service — Language Detection
# ==============================================================================

from __future__ import annotations

import re
import structlog
from langdetect import detect_langs, LangDetectException

logger = structlog.get_logger()

# Unicode ranges for Indian scripts
DEVANAGARI_RANGE = re.compile(r"[\u0900-\u097F]")  # Hindi, Marathi, Sanskrit
TAMIL_RANGE = re.compile(r"[\u0B80-\u0BFF]")
BENGALI_RANGE = re.compile(r"[\u0980-\u09FF]")

SUPPORTED_LANGS = {"en", "hi", "ta", "bn"}
SCRIPT_TO_LANG = {
    "devanagari": "hi",
    "tamil": "ta",
    "bengali": "bn",
}


class LanguageDetector:
    """Detects language of input text with fallback to script analysis."""

    def detect(self, text: str) -> tuple[str, float]:
        """
        Detect language of text. Returns (ISO 639-1 code, confidence).
        Priority: script analysis > langdetect > default (en).
        """
        if not text or len(text.strip()) < 2:
            return "en", 1.0

        # Stage 1: Script-based detection (highest accuracy for Indian languages)
        script_lang = self._detect_by_script(text)
        if script_lang:
            return script_lang, 0.95

        # Stage 2: Statistical detection via langdetect
        try:
            results = detect_langs(text)
            lang_map = {"bh": "hi", "ne": "hi"}  # Bhojpuri/Nepali → Hindi fallback
            for result in results:
                lang_code = str(result.lang)
                if lang_code in SUPPORTED_LANGS:
                    return lang_code, round(result.prob, 3)
                if lang_code in lang_map:
                    return lang_map[lang_code], round(result.prob, 3)
        except LangDetectException:
            pass

        # Stage 3: Default to English
        return "en", 0.5

    def detect_with_confidence(self, text: str) -> tuple[str, float]:
        """Detect language with confidence score. Delegates to detect()."""
        return self.detect(text)

    def _detect_by_script(self, text: str) -> str | None:
        """Detect language by Unicode script presence."""
        tamil_count = len(TAMIL_RANGE.findall(text))
        bengali_count = len(BENGALI_RANGE.findall(text))
        devanagari_count = len(DEVANAGARI_RANGE.findall(text))

        total_chars = len(text.replace(" ", ""))
        if total_chars == 0:
            return None

        threshold = 0.3  # 30% of characters must be in script

        if tamil_count / total_chars > threshold:
            return "ta"
        if bengali_count / total_chars > threshold:
            return "bn"
        if devanagari_count / total_chars > threshold:
            return "hi"

        return None
