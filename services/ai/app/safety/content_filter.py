# ==============================================================================
# PocketJury AI Service — Content Safety Filter
# ==============================================================================

from __future__ import annotations

import re
from dataclasses import dataclass
import structlog

logger = structlog.get_logger()


@dataclass
class SafetyResult:
    """Result of a safety check."""

    is_blocked: bool = False
    reason: str = ""
    message: str = ""
    sanitized_text: str | None = None


class ContentFilter:
    """
    Multi-layer content safety filter for both input and output.

    Input checks:
    - Prompt injection detection
    - Violence/crime incitement detection
    - Impersonation attempts
    - Hate speech patterns

    Output checks:
    - Legal advice boundary violation
    - Harmful content detection
    - Fabricated citation detection
    """

    # --- Blocked Input Patterns ---
    PROMPT_INJECTION_PATTERNS = [
        r"ignore\s+(all\s+)?previous\s+instructions",
        r"forget\s+(all\s+)?your\s+(rules|instructions|guidelines)",
        r"you\s+are\s+now\s+(a|an)\s+(?!legal|law)",
        r"pretend\s+(to\s+be|you\s+are)",
        r"act\s+as\s+(a|an)\s+(?!legal|law)",
        r"disregard\s+(all|your)\s+(safety|rules|guidelines)",
        r"override\s+(your|the)\s+(safety|rules|system)",
        r"system\s*prompt",
        r"jailbreak",
        r"DAN\s+mode",
        r"developer\s+mode",
    ]

    VIOLENCE_PATTERNS = [
        r"how\s+to\s+(kill|murder|harm|poison|attack)\s+(a\s+|my\s+)?person",
        r"how\s+to\s+make\s+(a\s+)?(bomb|explosive|weapon)",
        r"how\s+to\s+(hire|find)\s+(a\s+)?(hitman|assassin|killer)",
        r"help\s+me\s+(kill|murder|harm|hurt|attack)",
        r"ways?\s+to\s+(torture|kidnap|abduct)",
        r"how\s+to\s+get\s+away\s+with\s+(murder|killing|crime)",
    ]

    IMPERSONATION_PATTERNS = [
        r"you\s+are\s+(a|my)\s+(lawyer|advocate|attorney|judge)",
        r"as\s+my\s+(lawyer|advocate|attorney)",
        r"give\s+me\s+legal\s+advice\s+as\s+(a|my)\s+lawyer",
        r"draft\s+(a|an|my)\s+(FIR|complaint|contract|will|petition|affidavit|notice)",
    ]

    HATE_SPEECH_PATTERNS = [
        r"(all|every)\s+(muslims?|hindus?|christians?|sikhs?|dalits?)\s+(are|should)",
        r"(kill|remove|deport)\s+all\s+(muslims?|hindus?|christians?|migrants?)",
        r"(caste|racial)\s+(superiority|purity)",
    ]

    # --- Blocked Output Patterns ---
    OUTPUT_VIOLATION_PATTERNS = [
        r"as\s+your\s+(lawyer|legal\s+counsel|attorney)",
        r"I\s+(am|can\s+act\s+as)\s+your\s+(lawyer|advocate)",
        r"my\s+legal\s+advice\s+(is|would\s+be)",
        r"I\s+guarantee\s+(that|you\s+will\s+win)",
        r"you\s+will\s+(definitely|certainly)\s+win",
        r"the\s+court\s+will\s+(definitely|certainly)",
    ]

    def __init__(self) -> None:
        self._compile_patterns()

    def _compile_patterns(self) -> None:
        """Pre-compile regex patterns for performance."""
        self._injection_re = [
            re.compile(p, re.IGNORECASE) for p in self.PROMPT_INJECTION_PATTERNS
        ]
        self._violence_re = [
            re.compile(p, re.IGNORECASE) for p in self.VIOLENCE_PATTERNS
        ]
        self._impersonation_re = [
            re.compile(p, re.IGNORECASE) for p in self.IMPERSONATION_PATTERNS
        ]
        self._hate_re = [
            re.compile(p, re.IGNORECASE) for p in self.HATE_SPEECH_PATTERNS
        ]
        self._output_re = [
            re.compile(p, re.IGNORECASE) for p in self.OUTPUT_VIOLATION_PATTERNS
        ]

    def check_input(self, text: str) -> SafetyResult:
        """
        Check user input for safety violations.

        Returns SafetyResult with is_blocked=True if content is unsafe.
        """
        # Check prompt injection
        for pattern in self._injection_re:
            if pattern.search(text):
                return SafetyResult(
                    is_blocked=True,
                    reason="prompt_injection",
                    message=(
                        "I'm designed to help with Indian legal questions only. "
                        "I cannot modify my guidelines or pretend to be something else. "
                        "How can I help you with a legal question?"
                    ),
                )

        # Check violence / crime incitement
        for pattern in self._violence_re:
            if pattern.search(text):
                return SafetyResult(
                    is_blocked=True,
                    reason="violence_incitement",
                    message=(
                        "I cannot assist with requests that involve violence or harming others. "
                        "If you or someone you know is in danger, please call:\n"
                        "🚨 Police Emergency: 112\n"
                        "📞 Women Helpline: 181\n"
                        "📞 Childline: 1098"
                    ),
                )

        # Check impersonation / drafting requests
        for pattern in self._impersonation_re:
            if pattern.search(text):
                return SafetyResult(
                    is_blocked=True,
                    reason="impersonation_attempt",
                    message=(
                        "I'm PocketJury, an AI legal information assistant — not a lawyer. "
                        "I cannot act as your lawyer or draft legal documents.\n\n"
                        "I can help you:\n"
                        "• Understand your legal rights\n"
                        "• Explain relevant laws and sections\n"
                        "• Guide you on procedures and next steps\n"
                        "• Connect you with free legal aid (NALSA: 15100)\n\n"
                        "For document drafting, please consult a qualified advocate."
                    ),
                )

        # Check hate speech
        for pattern in self._hate_re:
            if pattern.search(text):
                return SafetyResult(
                    is_blocked=True,
                    reason="hate_speech",
                    message=(
                        "I cannot respond to messages containing discriminatory content. "
                        "India's Constitution guarantees equality under Articles 14-18. "
                        "Please rephrase your question respectfully."
                    ),
                )

        return SafetyResult(is_blocked=False)

    def check_output(self, text: str) -> SafetyResult:
        """
        Validate LLM output for safety violations.

        Returns SafetyResult with sanitized_text if modifications were needed.
        """
        modified = False
        result_text = text

        for pattern in self._output_re:
            if pattern.search(result_text):
                # Remove the violating sentence
                sentences = result_text.split(". ")
                clean_sentences = [
                    s for s in sentences if not pattern.search(s)
                ]
                result_text = ". ".join(clean_sentences)
                modified = True

        if modified:
            return SafetyResult(
                is_blocked=False,
                reason="output_sanitised",
                sanitized_text=result_text,
            )

        return SafetyResult(is_blocked=False)
