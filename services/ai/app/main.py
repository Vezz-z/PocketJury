# ==============================================================================
# PocketJury AI Service — FastAPI Application Entry Point
# ==============================================================================

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import sentry_sdk
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app

from app.config import get_settings
import app.constants as constants
from app.api.routes import query, health, ingestion
from app.core.embedder import EmbedderService
from app.core.retriever import RetrieverService
from app.core.llm_client import LLMClient
from app.core.translator import TranslatorService
from app.core.language_detector import LanguageDetector
from app.safety.content_filter import ContentFilter
from app.safety.helpline_detector import HelplineDetector
from app.db.database import init_db, close_db

settings = get_settings()

# --- Structured Logging ---
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer() if settings.DEBUG else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.getLevelName(settings.LOG_LEVEL)
    ),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# --- Sentry ---
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        environment="production" if not settings.DEBUG else "development",
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifecycle: startup and shutdown."""
    logger.info("Starting PocketJury AI Service", version=settings.SERVICE_VERSION)

    # Initialize database pool
    await init_db()
    logger.info("Database pool initialized")

    # Initialize embedding models (load into memory)
    embedder = EmbedderService()
    await embedder.load_models()
    app.state.embedder = embedder
    logger.info("Embedding models loaded")

    # Initialize retriever
    retriever = RetrieverService(embedder=embedder)
    app.state.retriever = retriever
    logger.info("Retriever initialized")

    # Initialize LLM client
    llm_client = LLMClient()
    app.state.llm_client = llm_client
    logger.info("LLM client initialized")

    # Initialize translator
    translator = TranslatorService(llm_client=llm_client)
    app.state.translator = translator

    # Initialize language detector
    app.state.language_detector = LanguageDetector()

    # Initialize safety components
    app.state.content_filter = ContentFilter()
    app.state.helpline_detector = HelplineDetector()
    logger.info("Safety components initialized")

    logger.info("AI Service ready", port=8000)
    yield

    # --- Shutdown ---
    logger.info("Shutting down AI Service")
    await close_db()
    logger.info("Cleanup complete")


# --- FastAPI App ---
app = FastAPI(
    title="PocketJury AI Service",
    description="RAG-powered legal assistance for Indian citizens",
    version=settings.SERVICE_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=constants.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Prometheus metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Routes
app.include_router(health.router, tags=["Health"])
app.include_router(query.router, prefix="/api/v1", tags=["Query"])
app.include_router(ingestion.router, prefix="/api/v1/ingestion", tags=["Ingestion"])
