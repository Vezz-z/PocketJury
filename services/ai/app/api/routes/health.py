# ==============================================================================
# PocketJury AI Service — Health Check Route
# ==============================================================================

from fastapi import APIRouter, Request
from app.config import get_settings
from app.models.schemas import HealthResponse

router = APIRouter()
settings = get_settings()


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request) -> HealthResponse:
    """Service health check endpoint."""
    models_loaded = (
        hasattr(request.app.state, "embedder")
        and request.app.state.embedder is not None
    )
    db_connected = True
    try:
        from app.db.database import engine
        async with engine.begin() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
    except Exception:
        db_connected = False

    return HealthResponse(
        status="healthy" if (models_loaded and db_connected) else "degraded",
        service=settings.SERVICE_NAME,
        version=settings.SERVICE_VERSION,
        models_loaded=models_loaded,
        database_connected=db_connected,
    )
