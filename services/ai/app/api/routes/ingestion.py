# ==============================================================================
# PocketJury AI Service — Document Ingestion Route
# ==============================================================================

from __future__ import annotations

import structlog
from fastapi import APIRouter, Request, HTTPException
from app.models.schemas import IngestRequest, IngestResponse
from app.ingestion.pipeline import IngestionPipeline

logger = structlog.get_logger()
router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(request: Request, body: IngestRequest) -> IngestResponse:
    """
    Ingest a legal document into the vector store.

    Steps:
    1. Validate document metadata
    2. Chunk text with legal-aware splitter
    3. Generate embeddings (InLegalBERT for legal corpus)
    4. Store document + embeddings in PostgreSQL/pgvector
    5. Update full-text search index
    """
    embedder = request.app.state.embedder

    pipeline = IngestionPipeline(embedder=embedder)

    try:
        result = await pipeline.ingest(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Ingestion failed", error=str(e), title=body.title, exc_info=True)
        raise HTTPException(status_code=500, detail="Document ingestion failed")

    logger.info(
        "Document ingested",
        document_id=result.document_id,
        title=body.title,
        chunks=result.chunks_created,
    )

    return result
