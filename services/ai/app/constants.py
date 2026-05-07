# ==============================================================================
# PocketJury AI Service — Constants
# ==============================================================================

import os

# --- Embedding Models ---
LEGAL_EMBEDDING_MODEL = os.getenv("LEGAL_EMBEDDING_MODEL", "intfloat/multilingual-e5-large")
QUERY_EMBEDDING_MODEL = os.getenv("QUERY_EMBEDDING_MODEL", "intfloat/multilingual-e5-large")
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "1024"))
EMBEDDING_DEVICE = os.getenv("EMBEDDING_DEVICE", "cpu")

# --- RAG Pipeline ---
RAG_TOP_K_VECTOR = 15
RAG_TOP_K_FULLTEXT = 15
RAG_TOP_K_FINAL = 8
RRF_K = 60  # Reciprocal Rank Fusion parameter
CHUNK_SIZE = 512
CHUNK_OVERLAP = 64
MIN_RELEVANCE_SCORE = 0.55

# --- Content Safety ---
MAX_QUERY_LENGTH = 2000
BLOCKED_CATEGORIES = [
    "violence_incitement",
    "illegal_advice",
    "impersonation",
    "hate_speech",
]

# --- CORS ---
ALLOWED_ORIGINS = ["http://localhost:3000"]
