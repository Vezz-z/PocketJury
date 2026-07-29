# ==============================================================================
# PocketJury AI Service — Configuration
# ==============================================================================

from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- Service ---
    SERVICE_NAME: str = "pocketjury-ai"
    SERVICE_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # --- Database ---
    DATABASE_URL: str = Field(..., description="PostgreSQL connection string")
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 5

    # --- Redis ---
    REDIS_URL: str = Field(default="redis://localhost:6379/1")

    # --- OpenRouter API (LLM) ---
    OPENROUTER_API_KEY: str = ""
    LLM_MODEL_ID: str = "nvidia/nemotron-3-ultra-550b-a55b:free"
    TITLE_LLM_MODEL_ID: str | None = None
    LLM_TEMPERATURE: float = 0.7
    LLM_MAX_TOKENS: int = 4096

    # --- Embedding Models ---
    # Moved to constants.py

    # --- RAG Pipeline ---
    # Moved to constants.py

    # --- Content Safety ---
    # Moved to constants.py

    # --- Sentry ---
    SENTRY_DSN: str = ""

    # --- CORS ---
    # Moved to constants.py

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
