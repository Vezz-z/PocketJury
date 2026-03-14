# ==============================================================================
# PocketJury AI Service — Database Connection (asyncpg + SQLAlchemy)
# ==============================================================================

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import get_settings
import structlog

logger = structlog.get_logger()

engine = None
async_session = None


def _get_engine():
    global engine, async_session
    if engine is None:
        settings = get_settings()
        _db_url = settings.DATABASE_URL
        if not _db_url.startswith("postgresql+asyncpg://"):
            _db_url = _db_url.replace("postgresql://", "postgresql+asyncpg://")

        engine = create_async_engine(
            _db_url,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_pre_ping=True,
            echo=settings.DEBUG,
        )
        async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return engine


async def init_db() -> None:
    """Initialize engine and verify database connectivity on startup."""
    eng = _get_engine()
    async with eng.begin() as conn:
        await conn.execute(
            __import__("sqlalchemy").text("SELECT 1")
        )
    logger.info("Database connection verified")


async def close_db() -> None:
    """Close database engine on shutdown."""
    global engine
    if engine:
        await engine.dispose()
        logger.info("Database engine disposed")


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the async session factory, initializing if needed."""
    global async_session
    if async_session is None:
        _get_engine()
    return async_session


async def get_db() -> AsyncSession:  # type: ignore[misc]
    """FastAPI dependency for database sessions."""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
        finally:
            await session.close()
