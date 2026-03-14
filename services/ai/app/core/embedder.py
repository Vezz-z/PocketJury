# ==============================================================================
# PocketJury AI Service — Embedding Service
# ==============================================================================

from __future__ import annotations

import structlog
from sentence_transformers import SentenceTransformer

from app.config import get_settings
from app.constants import QUERY_EMBEDDING_MODEL, EMBEDDING_DEVICE

logger = structlog.get_logger()
settings = get_settings()


class EmbedderService:
    """
    Single-model embedding strategy using multilingual-e5-large.
    Supports en/hi/ta/bn and outputs 1024-dim vectors natively.
    """

    def __init__(self) -> None:
        self._model: SentenceTransformer | None = None
        self._models_loaded = False

    async def load_models(self) -> None:
        """Load embedding model into memory (called at startup)."""
        logger.info(
            "Loading embedding model",
            model=QUERY_EMBEDDING_MODEL,
            device=EMBEDDING_DEVICE,
        )

        self._model = SentenceTransformer(
            QUERY_EMBEDDING_MODEL,
            device=EMBEDDING_DEVICE,
        )

        self._models_loaded = True
        logger.info("Embedding model loaded successfully")

    @property
    def is_loaded(self) -> bool:
        return self._models_loaded

    def embed_legal_text(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        """
        Generate embeddings for legal corpus text.
        Used during document ingestion. Prepends "passage: " prefix.
        """
        if not self._model:
            raise RuntimeError("Embedding model not loaded")

        prefixed = [f"passage: {t}" for t in texts]
        embeddings = self._model.encode(
            prefixed,
            batch_size=batch_size,
            show_progress_bar=False,
            normalize_embeddings=True,
        )

        return embeddings.tolist()

    def embed_query(self, query: str) -> list[float]:
        """
        Generate embedding for a user query.
        Prepends "query: " prefix as required by the e5 model.
        """
        if not self._model:
            raise RuntimeError("Embedding model not loaded")

        prefixed = f"query: {query}"
        embedding = self._model.encode(
            prefixed,
            normalize_embeddings=True,
        )

        return embedding.tolist()

    def embed_passage(self, passage: str) -> list[float]:
        """
        Generate embedding for a passage.
        Prepends "passage: " prefix as required by the e5 model.
        """
        if not self._model:
            raise RuntimeError("Embedding model not loaded")

        prefixed = f"passage: {passage}"
        embedding = self._model.encode(
            prefixed,
            normalize_embeddings=True,
        )

        return embedding.tolist()
