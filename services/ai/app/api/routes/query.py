# ==============================================================================
# PocketJury AI Service — Query Route (RAG Pipeline Endpoint)
# ==============================================================================

from __future__ import annotations

import time
import structlog
from fastapi import APIRouter, Request, HTTPException
from prometheus_client import Counter, Histogram

from app.models.schemas import (
    QueryRequest,
    QueryResponse,
    SimplifyRequest,
    SimplifyResponse,
    SafetyFlag,
)
from app.core.rag_pipeline import RAGPipeline
from app.core.prompt_templates import SIMPLIFY_PROMPT

logger = structlog.get_logger()
router = APIRouter()

# --- Prometheus Metrics ---
QUERY_COUNT = Counter("pocketjury_queries_total", "Total queries processed", ["language", "persona", "safety_flag"])
QUERY_LATENCY = Histogram("pocketjury_query_latency_seconds", "Query processing latency", buckets=[0.5, 1, 2, 3, 5, 8, 13, 21, 30])
SIMPLIFY_COUNT = Counter("pocketjury_simplify_total", "Total simplification requests")


@router.post("/query", response_model=QueryResponse)
async def process_query(request: Request, body: QueryRequest) -> QueryResponse:
    """
    Process a legal query through the full 13-stage RAG pipeline.

    Stages:
    1. Input sanitisation & length validation
    2. Language detection
    3. Translation to English (if needed)
    4. Content safety pre-check
    5. Helpline/crisis detection
    6. Query expansion & persona context
    7. Hybrid retrieval (vector + full-text + RRF)
    8. Re-ranking & deduplication
    9. Prompt assembly with persona adaptation
    10. LLM generation (Claude 3.5 Sonnet via Bedrock)
    11. Output safety validation
    12. IPC→BNS cross-reference
    13. Translation back to user language & response formatting
    """
    start = time.perf_counter()

    # Get services from app state
    pipeline = RAGPipeline(
        embedder=request.app.state.embedder,
        retriever=request.app.state.retriever,
        llm_client=request.app.state.llm_client,
        translator=request.app.state.translator,
        language_detector=request.app.state.language_detector,
        content_filter=request.app.state.content_filter,
        helpline_detector=request.app.state.helpline_detector,
    )

    try:
        response = await pipeline.process(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("RAG pipeline error", error=str(e), user_id=body.user_id, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process query")

    elapsed_ms = (time.perf_counter() - start) * 1000
    response.processing_time_ms = round(elapsed_ms, 2)

    # Record metrics
    QUERY_COUNT.labels(
        language=body.language.value,
        persona=body.persona.value,
        safety_flag=response.safety_flag.value,
    ).inc()
    QUERY_LATENCY.observe(elapsed_ms / 1000)

    logger.info(
        "Query processed",
        user_id=body.user_id,
        chat_id=body.chat_id,
        language=body.language.value,
        persona=body.persona.value,
        safety_flag=response.safety_flag.value,
        references_count=len(response.references),
        latency_ms=response.processing_time_ms,
    )

    return response


@router.post("/simplify", response_model=SimplifyResponse)
async def simplify_text(request: Request, body: SimplifyRequest) -> SimplifyResponse:
    """Simplify a legal response into plain language."""
    SIMPLIFY_COUNT.inc()

    llm_client = request.app.state.llm_client
    translator = request.app.state.translator

    persona_map = {
        "STUDENT": "a 16-year-old student",
        "SENIOR_CITIZEN": "an elderly person with basic education",
        "RURAL_USER": "a person from a rural village with limited formal education",
        "GENERAL": "a common person without legal training",
        "PROFESSIONAL": "a working professional unfamiliar with law",
    }
    audience = persona_map.get(body.persona.value, "a common person")

    prompt = SIMPLIFY_PROMPT.format(audience=audience, text=body.text)

    simplified = await llm_client.generate(prompt, max_tokens=2048)

    # Translate back if not English
    if body.language != "en":
        simplified = await translator.translate(
            text=simplified,
            source_lang="en",
            target_lang=body.language.value,
        )

    return SimplifyResponse(simplified_text=simplified, language=body.language)
