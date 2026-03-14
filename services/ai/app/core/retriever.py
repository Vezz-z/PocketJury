# ==============================================================================
# PocketJury AI Service — Hybrid Retriever (Vector + Full-Text + RRF)
# ==============================================================================

from __future__ import annotations

import structlog
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
import app.constants as constants
from app.core.embedder import EmbedderService
from app.db.database import get_session_factory

logger = structlog.get_logger()
settings = get_settings()


class RetrievedChunk:
    """A retrieved document chunk with metadata."""

    def __init__(
        self,
        chunk_id: str,
        document_id: str,
        document_title: str,
        document_type: str,
        content: str,
        section_ref: str | None,
        chunk_index: int,
        score: float,
        retrieval_method: str,
    ):
        self.chunk_id = chunk_id
        self.document_id = document_id
        self.document_title = document_title
        self.document_type = document_type
        self.content = content
        self.section_ref = section_ref
        self.chunk_index = chunk_index
        self.score = score
        self.retrieval_method = retrieval_method


class RetrieverService:
    """
    Hybrid retrieval using:
    1. pgvector cosine similarity (HNSW index)
    2. PostgreSQL full-text search (tsvector)
    3. Reciprocal Rank Fusion (RRF) for merging results
    """

    def __init__(self, embedder: EmbedderService) -> None:
        self._embedder = embedder

    async def retrieve(
        self,
        query: str,
        top_k: int | None = None,
        jurisdiction: str | None = None,
    ) -> list[RetrievedChunk]:
        """
        Perform hybrid retrieval and return top-k fused results.

        Args:
            query: The user's legal question (in English)
            top_k: Number of final results to return
            jurisdiction: Optional state for jurisdiction filtering
        """
        final_k = top_k or constants.RAG_TOP_K_FINAL

        # Generate query embedding
        query_embedding = self._embedder.embed_query(query)

        # Try the stored function first in its own session;
        # fall back to manual RRF in a fresh session if it fails.
        try:
            async with get_session_factory()() as session:
                results = await self._hybrid_search(
                    session, query, query_embedding, final_k, jurisdiction
                )
        except Exception as e:
            logger.warning("Hybrid function failed, falling back to manual RRF", error=str(e))
            async with get_session_factory()() as session:
                results = await self._manual_hybrid_search(
                    session, query, query_embedding, final_k, jurisdiction
                )

        logger.info("Retrieval complete", results_count=len(results), top_k=final_k)
        return results

    async def _hybrid_search(
        self,
        session: AsyncSession,
        query: str,
        query_embedding: list[float],
        top_k: int,
        jurisdiction: str | None,
    ) -> list[RetrievedChunk]:
        """Use the SQL hybrid_legal_search function."""
        embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

        sql = sa.text("""
            SELECT * FROM hybrid_legal_search(
                CAST(:query_embedding AS vector(1024)),
                :ts_query,
                :match_count,
                :rrf_k
            )
        """)

        ts_query = " ".join(query.split()[:10])  # First 10 words for full-text search

        result = await session.execute(
            sql,
            {
                "query_embedding": embedding_str,
                "ts_query": ts_query,
                "match_count": top_k,
                "rrf_k": constants.RRF_K,
            },
        )

        rows = result.fetchall()
        chunks = []
        for row in rows:
            chunks.append(
                RetrievedChunk(
                    chunk_id=str(row[0]),      # document_id (using as chunk_id since hybrid returns merged docs)
                    document_id=str(row[0]),   # document_id
                    document_title=row[6] if len(row) > 6 else "",
                    document_type=row[5] if len(row) > 5 else "",
                    content=row[1],            # chunk_text
                    section_ref=row[4] if len(row) > 4 else None,
                    chunk_index=row[2] if len(row) > 2 else 0,
                    score=float(row[-1]),      # rrf_score
                    retrieval_method="hybrid_rrf",
                )
            )

        # Enrich with document metadata
        if chunks:
            await self._enrich_chunks(session, chunks)

        return chunks

    async def _manual_hybrid_search(
        self,
        session: AsyncSession,
        query: str,
        query_embedding: list[float],
        top_k: int,
        jurisdiction: str | None,
    ) -> list[RetrievedChunk]:
        """Manual implementation of hybrid search with RRF fusion."""

        # --- Vector search ---
        embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

        vector_sql = sa.text("""
            SELECT de.id, de.document_id, de.chunk_text, ld.section_number, de.chunk_index,
                   1 - (de.embedding <=> CAST(:embedding AS vector(1024))) AS similarity
            FROM document_embeddings de
            JOIN legal_documents ld ON de.document_id = ld.id
            WHERE ld.is_repealed = false
              AND de.embedding IS NOT NULL
            ORDER BY de.embedding <=> CAST(:embedding AS vector(1024))
            LIMIT :limit
        """)

        vector_result = await session.execute(
            vector_sql,
            {"embedding": embedding_str, "limit": constants.RAG_TOP_K_VECTOR},
        )
        vector_rows = vector_result.fetchall()

        # --- Full-text search ---
        ts_query = " ".join(word for word in query.split()[:10] if len(word) > 2)
        if not ts_query:
            ts_query = query.split()[0] if query.split() else "law"

        fts_sql = sa.text("""
            SELECT de.id, de.document_id, de.chunk_text, ld.section_number, de.chunk_index,
                   ts_rank_cd(de.search_vector, plainto_tsquery('english', :query)) AS rank
            FROM document_embeddings de
            JOIN legal_documents ld ON de.document_id = ld.id
            WHERE ld.is_repealed = false
              AND de.search_vector IS NOT NULL
              AND de.search_vector @@ plainto_tsquery('english', :query)
            ORDER BY rank DESC
            LIMIT :limit
        """)

        try:
            fts_result = await session.execute(
                fts_sql,
                {"query": ts_query, "limit": constants.RAG_TOP_K_FULLTEXT},
            )
            fts_rows = fts_result.fetchall()
        except Exception:
            fts_rows = []

        # --- RRF Fusion ---
        rrf_scores: dict[str, float] = {}
        chunk_data: dict[str, tuple] = {}
        k = constants.RRF_K

        for rank, row in enumerate(vector_rows):
            chunk_id = str(row[0])
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0) + 1.0 / (k + rank + 1)
            chunk_data[chunk_id] = row

        for rank, row in enumerate(fts_rows):
            chunk_id = str(row[0])
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0) + 1.0 / (k + rank + 1)
            if chunk_id not in chunk_data:
                chunk_data[chunk_id] = row

        # Sort by RRF score and take top_k
        sorted_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)[:top_k]

        chunks = []
        for chunk_id in sorted_ids:
            row = chunk_data[chunk_id]
            chunks.append(
                RetrievedChunk(
                    chunk_id=chunk_id,
                    document_id=str(row[1]),
                    document_title="",
                    document_type="",
                    content=row[2],
                    section_ref=row[3],
                    chunk_index=row[4],
                    score=rrf_scores[chunk_id],
                    retrieval_method="manual_rrf",
                )
            )

        if chunks:
            await self._enrich_chunks(session, chunks)

        return chunks

    async def _enrich_chunks(
        self, session: AsyncSession, chunks: list[RetrievedChunk]
    ) -> None:
        """Enrich chunks with document metadata (title, type)."""
        doc_ids = list({c.document_id for c in chunks})

        sql = sa.text("""
            SELECT id, title, document_type FROM legal_documents
            WHERE id = ANY(:doc_ids)
        """)

        result = await session.execute(sql, {"doc_ids": doc_ids})

        doc_map = {}
        for row in result.fetchall():
            doc_map[str(row[0])] = {"title": row[1], "type": row[2]}

        for chunk in chunks:
            info = doc_map.get(chunk.document_id, {})
            chunk.document_title = info.get("title", "Unknown")
            chunk.document_type = info.get("type", "STATUTE")
