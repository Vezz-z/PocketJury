# ==============================================================================
# PocketJury AI Service — Dockerfile (Multi-stage, Cache-optimized)
# ==============================================================================

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=300 \
    PIP_RETRIES=3

WORKDIR /app

# System dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc g++ libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies — cached unless requirements.txt changes
# NOTE: pip cache is enabled (no PIP_NO_CACHE_DIR) so that Docker BuildKit
# cache mounts can speed up rebuilds when the layer IS invalidated.
FROM base AS deps
COPY services/ai/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

# Production image — only source code changes trigger this layer
FROM base AS runner
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Copy config files first (rarely change)
COPY services/ai/pyproject.toml services/ai/requirements.txt ./

# Copy application code (changes frequently — keep last)
COPY services/ai/app ./app
COPY services/ai/seed_legal_docs.py ./

# Create non-root user with writable cache for HuggingFace models
RUN addgroup --system --gid 1001 aiservice && \
    adduser --system --uid 1001 --gid 1001 pocketjury && \
    mkdir -p /app/.cache /app/model_cache/hub && \
    chown -R pocketjury:aiservice /app/.cache /app/model_cache

ENV HF_HOME=/app/.cache/huggingface \
    TRANSFORMERS_CACHE=/app/.cache/huggingface/hub

USER pocketjury
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import httpx; r = httpx.get('http://localhost:8000/health'); assert r.status_code == 200"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
