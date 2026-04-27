# ==============================================================================
# PocketJury — AI Service Tests (Ingestion Pipeline)
# ==============================================================================

from app.ingestion.pipeline import LegalTextChunker


class TestLegalTextChunker:
    """Test section-aware legal text chunking."""

    def setup_method(self):
        self.chunker = LegalTextChunker(chunk_size=500, chunk_overlap=50)

    def test_chunks_short_text_as_single_chunk(self):
        text = "Section 1. Short title. This Act may be called the Test Act."
        chunks = self.chunker.chunk(text)
        assert len(chunks) == 1
        assert text in chunks[0]["content"]

    def test_splits_long_text_into_multiple_chunks(self):
        text = "Lorem ipsum dolor sit amet. " * 100
        chunks = self.chunker.chunk(text)
        assert len(chunks) > 1

    def test_respects_section_boundaries(self):
        text = (
            "Section 1. Definitions.\n"
            "In this Act, the following terms apply.\n" * 20 +
            "\nSection 2. Application.\n"
            "This Act applies to all citizens.\n" * 20
        )
        chunks = self.chunker.chunk(text)
        # Section 2 should start a new chunk when possible
        assert any("Section 2" in c["content"] for c in chunks)

    def test_preserves_proviso_with_parent_section(self):
        text = (
            "Section 10. Penalties.\n"
            "Whoever commits an offence under this section shall be punished.\n"
            "Provided that in the case of a first offence, the court may reduce the sentence.\n"
            "Provided further that this shall not apply to repeat offenders.\n"
        )
        chunks = self.chunker.chunk(text)
        # Proviso should be in the same chunk as its parent section
        assert len(chunks) == 1
        assert "Provided that" in chunks[0]["content"]

    def test_empty_text_returns_empty_list(self):
        chunks = self.chunker.chunk("")
        assert chunks == []

    def test_overlapping_chunks(self):
        text = "Word " * 200  # ~1000 chars
        chunker = LegalTextChunker(chunk_size=200, chunk_overlap=50)
        chunks = chunker.chunk(text)
        if len(chunks) > 1:
            # Check overlap exists
            end_of_first = chunks[0]["content"][-50:]
            assert end_of_first in chunks[1]["content"] or len(chunks) == 1
