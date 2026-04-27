# ==============================================================================
# PocketJury AI Service — Document Ingestion Pipeline
# ==============================================================================

from __future__ import annotations

import json
import re
import uuid
import structlog
import sqlalchemy as sa

from app.config import get_settings
from app.core.embedder import EmbedderService
from app.models.schemas import IngestRequest, IngestResponse
from app.db.database import get_session_factory

logger = structlog.get_logger()
settings = get_settings()


class LegalTextChunker:
    """
    Legal-aware text chunker that respects:
    - Section boundaries
    - Proviso boundaries ("Provided that...")
    - Explanation blocks
    - Sub-section numbering
    """

    SECTION_PATTERN = re.compile(
        r"(?:^|\n)\s*(?:Section|SECTION|Sec\.?)\s+(\d+[A-Z]?)\b",
        re.MULTILINE,
    )
    PROVISO_PATTERN = re.compile(
        r"(?:^|\n)\s*(?:Provided\s+that|Explanation|Exception|Illustration)",
        re.MULTILINE | re.IGNORECASE,
    )
    SUBSECTION_PATTERN = re.compile(
        r"(?:^|\n)\s*\((\d+|[a-z]|[ivxlc]+)\)\s",
        re.MULTILINE,
    )

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 64,
    ) -> None:
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk(self, text: str, document_title: str = "") -> list[dict]:
        """
        Split legal text into semantically meaningful chunks.

        Returns list of dicts with keys: content, section_ref, chunk_index, metadata
        """
        # First try to split by sections
        sections = self._split_by_sections(text)

        if len(sections) <= 1:
            # No sections found — use paragraph-based chunking
            return self._chunk_by_paragraphs(text, document_title)

        chunks = []
        chunk_index = 0

        for section_ref, section_text in sections:
            # If section is small enough, keep as single chunk
            if len(section_text.split()) <= self.chunk_size:
                chunks.append({
                    "content": section_text.strip(),
                    "section_ref": section_ref,
                    "chunk_index": chunk_index,
                    "metadata": {"document_title": document_title},
                })
                chunk_index += 1
            else:
                # Split large sections by provisos/sub-sections
                sub_chunks = self._split_section(section_text, section_ref)
                for sc in sub_chunks:
                    sc["chunk_index"] = chunk_index
                    sc["metadata"] = {"document_title": document_title}
                    chunks.append(sc)
                    chunk_index += 1

        return chunks

    def _split_by_sections(self, text: str) -> list[tuple[str, str]]:
        """Split text at section boundaries."""
        matches = list(self.SECTION_PATTERN.finditer(text))
        if not matches:
            return [("", text)]

        sections = []
        for i, match in enumerate(matches):
            start = match.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            section_ref = f"Section {match.group(1)}"
            section_text = text[start:end]
            sections.append((section_ref, section_text))

        # Add any text before the first section
        if matches[0].start() > 0:
            preamble = text[: matches[0].start()]
            if preamble.strip():
                sections.insert(0, ("Preamble", preamble))

        return sections

    def _split_section(self, text: str, section_ref: str) -> list[dict]:
        """Split a large section into smaller chunks."""
        # Try splitting at provisos first
        proviso_splits = self.PROVISO_PATTERN.split(text)
        if len(proviso_splits) > 1:
            chunks = []
            for i, part in enumerate(proviso_splits):
                if part.strip():
                    chunks.append({
                        "content": part.strip(),
                        "section_ref": f"{section_ref} (part {i + 1})",
                    })
            return chunks

        # Fall back to word-count based chunking with overlap
        return self._word_count_chunk(text, section_ref)

    def _word_count_chunk(self, text: str, section_ref: str) -> list[dict]:
        """Chunk by word count with overlap."""
        words = text.split()
        chunks = []
        start = 0

        while start < len(words):
            end = min(start + self.chunk_size, len(words))
            chunk_words = words[start:end]
            chunk_text = " ".join(chunk_words)

            chunks.append({
                "content": chunk_text,
                "section_ref": section_ref,
            })

            start += self.chunk_size - self.chunk_overlap

        return chunks

    def _chunk_by_paragraphs(self, text: str, document_title: str) -> list[dict]:
        """Fall back: chunk by paragraphs with word-count grouping."""
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        # If the text is one large paragraph exceeding chunk_size, use word-count chunking
        if len(paragraphs) <= 1 and len(text.split()) >= self.chunk_size:
            sub_chunks = self._word_count_chunk(text.strip(), None)
            for i, sc in enumerate(sub_chunks):
                sc["chunk_index"] = i
                sc["metadata"] = {"document_title": document_title}
            return sub_chunks

        chunks = []
        current_chunk = ""
        current_words = 0
        chunk_index = 0

        for para in paragraphs:
            para_words = len(para.split())

            if current_words + para_words > self.chunk_size and current_chunk:
                chunks.append({
                    "content": current_chunk.strip(),
                    "section_ref": None,
                    "chunk_index": chunk_index,
                    "metadata": {"document_title": document_title},
                })
                chunk_index += 1
                # Overlap: keep last sentence
                overlap = current_chunk.split(". ")[-1] if ". " in current_chunk else ""
                current_chunk = overlap + " " + para
                current_words = len(current_chunk.split())
            else:
                current_chunk += "\n\n" + para
                current_words += para_words

        if current_chunk.strip():
            chunks.append({
                "content": current_chunk.strip(),
                "section_ref": None,
                "chunk_index": chunk_index,
                "metadata": {"document_title": document_title},
            })

        return chunks


class IngestionPipeline:
    """
    Document ingestion pipeline:
    1. Chunk text using legal-aware splitter
    2. Generate embeddings using multilingual-e5-large
    3. Store document + embeddings in PostgreSQL/pgvector
    """

    def __init__(self, embedder: EmbedderService) -> None:
        self._embedder = embedder
        self._chunker = LegalTextChunker(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
        )

    async def ingest(self, request: IngestRequest) -> IngestResponse:
        """Ingest a document and create embeddings."""

        # 1. Chunk the document
        chunks = self._chunker.chunk(request.content, request.title)
        if not chunks:
            raise ValueError("Document produced zero chunks after processing")

        logger.info("Document chunked", title=request.title, chunks=len(chunks))

        # 2. Generate embeddings for all chunks
        texts = [c["content"] for c in chunks]
        embeddings = self._embedder.embed_legal_text(texts)

        logger.info("Embeddings generated", count=len(embeddings))

        # 3. Store in database
        async with get_session_factory()() as session:
            # Insert document
            doc_id = str(uuid.uuid4())
            await session.execute(
                sa.text("""
                    INSERT INTO legal_documents (id, title, document_type, source_url, jurisdiction, year_enacted, is_active, metadata)
                    VALUES (:id, :title, :doc_type, :source_url, :jurisdiction, :year_enacted, true, :metadata::jsonb)
                    ON CONFLICT (source_url) DO UPDATE SET
                        title = EXCLUDED.title,
                        is_active = true,
                        updated_at = NOW()
                    RETURNING id
                """),
                {
                    "id": doc_id,
                    "title": request.title,
                    "doc_type": request.document_type,
                    "source_url": request.source_url,
                    "jurisdiction": request.jurisdiction,
                    "year_enacted": request.year_enacted,
                    "metadata": json.dumps(request.metadata) if request.metadata else "{}",
                },
            )

            # Insert chunks with embeddings
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
                await session.execute(
                    sa.text("""
                        INSERT INTO document_embeddings (id, document_id, content, section_ref, chunk_index, embedding, search_vector)
                        VALUES (:id, :doc_id, :content, :section_ref, :chunk_index, :embedding::vector(1024), to_tsvector('english', :content))
                    """),
                    {
                        "id": str(uuid.uuid4()),
                        "doc_id": doc_id,
                        "content": chunk["content"],
                        "section_ref": chunk.get("section_ref"),
                        "chunk_index": chunk.get("chunk_index", i),
                        "embedding": embedding_str,
                    },
                )

            await session.commit()

        logger.info(
            "Document stored",
            document_id=doc_id,
            chunks=len(chunks),
        )

        return IngestResponse(
            document_id=doc_id,
            chunks_created=len(chunks),
            status="ingested",
        )
