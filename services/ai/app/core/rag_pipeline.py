# ==============================================================================
# PocketJury AI Service — 13-Stage RAG Pipeline
# ==============================================================================

from __future__ import annotations

import re
import time
import html
import structlog
import sqlalchemy as sa

from app.config import get_settings
import app.constants as constants
from app.core.embedder import EmbedderService
from app.core.retriever import RetrieverService, RetrievedChunk
from app.core.llm_client import LLMClient
from app.core.translator import TranslatorService
from app.core.language_detector import LanguageDetector
from app.core.prompt_templates import (
    SYSTEM_PROMPT,
    QUERY_PROMPT,
    IPC_BNS_NOTE,
)
from app.safety.content_filter import ContentFilter
from app.safety.helpline_detector import HelplineDetector
from app.models.schemas import (
    QueryRequest,
    QueryResponse,
    LegalReference,
    HelplineInfo,
    SafetyFlag,
    SupportedLanguage,
)
from app.db.database import get_session_factory

logger = structlog.get_logger()
settings = get_settings()

# Disclaimers per language
DISCLAIMERS = {
    "en": "⚠️ This information is for educational purposes only and does not constitute legal advice. Please consult a qualified advocate for your specific situation.",
    "hi": "⚠️ यह जानकारी केवल शैक्षिक उद्देश्यों के लिए है और यह कानूनी सलाह नहीं है। कृपया अपनी विशिष्ट स्थिति के लिए एक योग्य अधिवक्ता से परामर्श करें।",
    "ta": "⚠️ இந்தத் தகவல் கல்வி நோக்கங்களுக்காக மட்டுமே, இது சட்ட ஆலோசனை அல்ல. உங்கள் குறிப்பிட்ட சூழ்நிலைக்கு தகுதியான வழக்கறிஞரை அணுகவும்.",
    "bn": "⚠️ এই তথ্য শুধুমাত্র শিক্ষামূলক উদ্দেশ্যে এবং এটি আইনি পরামর্শ নয়। আপনার নির্দিষ্ট পরিস্থিতির জন্য একজন যোগ্য আইনজীবীর সাথে পরামর্শ করুন।",
}


class RAGPipeline:
    """
    13-Stage Retrieval-Augmented Generation Pipeline for Indian Legal Assistance.

    Stages:
    1.  Input sanitisation & length validation
    2.  Language detection
    3.  Translation to English (if needed)
    4.  Content safety pre-check
    5.  Helpline / crisis detection
    6.  Query expansion & persona context injection
    7.  Hybrid retrieval (vector + full-text + RRF)
    8.  Re-ranking & deduplication
    9.  Prompt assembly with persona adaptation
    10. LLM generation (Claude 3.5 Sonnet via Bedrock)
    11. Output safety validation
    12. IPC→BNS cross-reference injection
    13. Translation back to user language & response formatting
    """

    def __init__(
        self,
        embedder: EmbedderService,
        retriever: RetrieverService,
        llm_client: LLMClient,
        translator: TranslatorService,
        language_detector: LanguageDetector,
        content_filter: ContentFilter,
        helpline_detector: HelplineDetector,
    ) -> None:
        self._embedder = embedder
        self._retriever = retriever
        self._llm = llm_client
        self._translator = translator
        self._lang_detector = language_detector
        self._content_filter = content_filter
        self._helpline_detector = helpline_detector

    async def process(self, request: QueryRequest) -> QueryResponse:
        """Execute the full 13-stage pipeline."""
        start = time.perf_counter()

        # ================================================================
        # STAGE 1: Input Sanitisation & Length Validation
        # ================================================================
        query = self._sanitize_input(request.query)
        if len(query) < 3:
            raise ValueError("Query too short. Please provide more detail.")
        if len(query) > constants.MAX_QUERY_LENGTH:
            raise ValueError(f"Query exceeds {constants.MAX_QUERY_LENGTH} characters.")

        logger.info("Stage 1: Input sanitised", query_length=len(query))

        # ================================================================
        # STAGE 2: Language Detection
        # ================================================================
        detected_lang, confidence = self._lang_detector.detect_with_confidence(query)
        # Prefer user-specified language if confidence is low
        if confidence < 0.7 and request.language.value != "en":
            detected_lang = request.language.value
        language = SupportedLanguage(detected_lang)

        logger.info("Stage 2: Language detected", lang=detected_lang, confidence=confidence)

        # ================================================================
        # STAGE 3: Translation to English (if needed)
        # ================================================================
        query_en = query
        if detected_lang != "en":
            query_en = await self._translator.translate_to_english(query, detected_lang)
            logger.info("Stage 3: Translated to English", original_lang=detected_lang)
        else:
            logger.info("Stage 3: Already English, skipping translation")

        # ================================================================
        # STAGE 4: Content Safety Pre-Check
        # ================================================================
        safety_result = self._content_filter.check_input(query_en)
        if safety_result.is_blocked:
            logger.warning("Stage 4: Query blocked", reason=safety_result.reason)
            return QueryResponse(
                answer=safety_result.message,
                safety_flag=SafetyFlag.BLOCKED,
                safety_message=safety_result.reason,
                disclaimer=DISCLAIMERS.get(detected_lang, DISCLAIMERS["en"]),
                persona_used=request.persona,
                language_detected=language,
                confidence_score=0.0,
            )

        logger.info("Stage 4: Content safety passed")

        # ================================================================
        # STAGE 5: Helpline / Crisis Detection
        # ================================================================
        helpline_result = self._helpline_detector.detect(query_en)
        helplines: list[HelplineInfo] = []

        if helpline_result.triggered:
            helplines = [
                HelplineInfo(
                    name=h.name,
                    phone=h.phone,
                    description=h.description,
                    category=h.category,
                )
                for h in helpline_result.helplines
            ]
            logger.info(
                "Stage 5: Helplines triggered",
                categories=helpline_result.categories,
                count=len(helplines),
            )
        else:
            logger.info("Stage 5: No helplines triggered")

        # ================================================================
        # STAGE 6: Query Expansion & Persona Context
        # ================================================================
        expanded_query = self._expand_query(query_en, request)
        logger.info("Stage 6: Query expanded", expanded_length=len(expanded_query))

        # ================================================================
        # STAGE 7: Hybrid Retrieval (Vector + Full-Text + RRF)
        # ================================================================
        chunks = await self._retriever.retrieve(
            query=expanded_query,
            jurisdiction=request.state,
        )
        logger.info("Stage 7: Retrieval complete", chunks=len(chunks))

        # ================================================================
        # STAGE 8: Re-ranking & Deduplication
        # ================================================================
        chunks = self._rerank_and_dedup(chunks)
        logger.info("Stage 8: Re-ranked", final_chunks=len(chunks))

        # ================================================================
        # STAGE 9: Prompt Assembly with Persona Adaptation
        # ================================================================
        context_text = self._build_context(chunks)
        history_text = self._build_history(request.message_history)
        ipc_bns_notes = await self._get_ipc_bns_notes(query_en)

        prompt = QUERY_PROMPT.format(
            persona=request.persona.value,
            state=request.state or "Not specified",
            profession=request.profession or "Not specified",
            education=request.education or "Not specified",
            language=detected_lang,
            history=history_text,
            context=context_text,
            ipc_bns_notes=ipc_bns_notes or "None applicable",
            query=query_en,
        )

        logger.info("Stage 9: Prompt assembled", prompt_length=len(prompt))

        # ================================================================
        # STAGE 10: LLM Generation
        # ================================================================
        answer_en = await self._llm.generate(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            max_tokens=settings.LLM_MAX_TOKENS,
            temperature=settings.LLM_TEMPERATURE,
        )
        logger.info("Stage 10: LLM response generated", answer_length=len(answer_en))

        # ================================================================
        # STAGE 11: Output Safety Validation
        # ================================================================
        output_safety = self._content_filter.check_output(answer_en)
        if output_safety.is_blocked or output_safety.sanitized_text:
            answer_en = output_safety.sanitized_text or (
                "I apologize, but I cannot provide a response to this query. "
                "Please consult a qualified advocate for assistance."
            )
            logger.warning("Stage 11: Output sanitised", reason=output_safety.reason)

        logger.info("Stage 11: Output safety passed")

        # ================================================================
        # STAGE 12: IPC→BNS Cross-Reference
        # ================================================================
        ipc_bns_note = ipc_bns_notes if ipc_bns_notes else None
        logger.info("Stage 12: IPC-BNS cross-reference", has_notes=bool(ipc_bns_note))

        # ================================================================
        # STAGE 13: Translation & Response Formatting
        # ================================================================
        answer_translated = None
        if detected_lang != "en":
            answer_translated = await self._translator.translate_from_english(
                answer_en, detected_lang
            )
            logger.info("Stage 13: Response translated", target_lang=detected_lang)

        # Build references
        references = [
            LegalReference(
                document_id=c.document_id,
                title=c.document_title,
                document_type=c.document_type,
                section=c.section_ref,
                relevance_score=round(c.score, 4),
                excerpt=c.content[:300] + "..." if len(c.content) > 300 else c.content,
            )
            for c in chunks
        ]

        # Confidence score based on retrieval quality
        confidence = self._calculate_confidence(chunks)

        # Safety flag
        safety_flag = SafetyFlag.SAFE
        if helpline_result.triggered:
            safety_flag = SafetyFlag.HELPLINE_TRIGGERED
        if not chunks:
            safety_flag = SafetyFlag.ESCALATION_SUGGESTED

        elapsed = (time.perf_counter() - start) * 1000

        return QueryResponse(
            answer=answer_en,
            answer_translated=answer_translated,
            references=references,
            helplines=helplines,
            safety_flag=safety_flag,
            disclaimer=DISCLAIMERS.get(detected_lang, DISCLAIMERS["en"]),
            persona_used=request.persona,
            language_detected=language,
            confidence_score=round(confidence, 3),
            ipc_bns_note=ipc_bns_note,
            processing_time_ms=round(elapsed, 2),
        )

    # ---- Helper Methods ----

    def _sanitize_input(self, text: str) -> str:
        """Stage 1: Sanitize input text."""
        text = html.unescape(text)
        text = re.sub(r"<[^>]+>", "", text)  # Strip HTML
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)  # Control chars
        text = re.sub(r"\s+", " ", text).strip()  # Normalize whitespace
        return text

    def _expand_query(self, query: str, request: QueryRequest) -> str:
        """Stage 6: Expand query with persona and jurisdiction context."""
        expansions = [query]

        # Add jurisdiction context
        if request.state:
            expansions.append(f"jurisdiction: {request.state}")

        # Add persona-specific terms
        persona_context = {
            "STUDENT": "educational institution student rights",
            "SENIOR_CITIZEN": "senior citizen elderly rights Maintenance and Welfare of Parents and Senior Citizens Act",
            "RURAL_USER": "village panchayat gram nyayalaya rural rights",
            "PROFESSIONAL": "employment workplace labour law",
            "GENERAL": "",
        }
        ctx = persona_context.get(request.persona.value, "")
        if ctx:
            expansions.append(ctx)

        return " ".join(expansions)

    def _rerank_and_dedup(self, chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
        """Stage 8: Deduplicate and re-rank chunks."""
        seen_content = set()
        deduped = []

        for chunk in chunks:
            # Simple content-based deduplication
            content_key = chunk.content[:200].lower().strip()
            if content_key not in seen_content:
                seen_content.add(content_key)
                deduped.append(chunk)

        # Filter by minimum relevance
        filtered = [c for c in deduped if c.score >= constants.MIN_RELEVANCE_SCORE]

        # If filtering removed too many, keep at least top 3
        if len(filtered) < 3 and len(deduped) >= 3:
            filtered = deduped[:3]

        return filtered[:constants.RAG_TOP_K_FINAL]

    def _build_context(self, chunks: list[RetrievedChunk]) -> str:
        """Stage 9: Build context string from retrieved chunks."""
        if not chunks:
            return "No relevant legal documents found in the knowledge base."

        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            section = f" — {chunk.section_ref}" if chunk.section_ref else ""
            context_parts.append(
                f"[Source {i}] {chunk.document_title}{section} "
                f"(Relevance: {chunk.score:.3f})\n{chunk.content}"
            )

        return "\n\n---\n\n".join(context_parts)

    def _build_history(self, messages: list) -> str:
        """Build conversation history string."""
        if not messages:
            return "No prior conversation."

        parts = []
        for msg in messages[-5:]:  # Last 5 turns
            role = msg.role if hasattr(msg, "role") else msg.get("role", "user")
            content = msg.content if hasattr(msg, "content") else msg.get("content", "")
            parts.append(f"{role.upper()}: {content[:500]}")

        return "\n".join(parts)

    async def _get_ipc_bns_notes(self, query: str) -> str:
        """Stage 12: Look up IPC-BNS cross-references for mentioned sections."""
        # Extract section numbers from query
        ipc_pattern = re.compile(
            r"(?:section|sec\.?|s\.?)\s*(\d+[A-Z]?)",
            re.IGNORECASE,
        )
        matches = ipc_pattern.findall(query)

        if not matches:
            return ""

        notes = []
        async with get_session_factory()() as session:
            for section in matches[:5]:  # Limit to 5 lookups
                result = await session.execute(
                    sa.text("""
                        SELECT ipc_section, bns_section, description, mapping_type
                        FROM ipc_bns_mapping
                        WHERE ipc_section = :section OR bns_section = :section
                        LIMIT 1
                    """),
                    {"section": section},
                )
                row = result.fetchone()
                if row:
                    notes.append(
                        IPC_BNS_NOTE.format(
                            ipc_section=row[0],
                            bns_section=row[1],
                            description=row[2] or "",
                            mapping_type=row[3] or "DIRECT",
                        )
                    )

        return "\n\n".join(notes)

    def _calculate_confidence(self, chunks: list[RetrievedChunk]) -> float:
        """Calculate confidence score based on retrieval quality."""
        if not chunks:
            return 0.2  # Low confidence when no sources found

        scores = [c.score for c in chunks]
        avg_score = sum(scores) / len(scores)
        top_score = max(scores)

        # Weighted: 60% top score, 30% average, 10% coverage
        coverage = min(len(chunks) / constants.RAG_TOP_K_FINAL, 1.0)
        confidence = 0.6 * top_score + 0.3 * avg_score + 0.1 * coverage

        return min(max(confidence, 0.1), 0.95)  # Clamp to [0.1, 0.95]
