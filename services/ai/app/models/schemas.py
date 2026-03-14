# ==============================================================================
# PocketJury AI Service — Pydantic Schemas
# ==============================================================================

from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class PersonaMode(str, Enum):
    STUDENT = "STUDENT"
    PROFESSIONAL = "PROFESSIONAL"
    SENIOR_CITIZEN = "SENIOR_CITIZEN"
    RURAL_USER = "RURAL_USER"
    GENERAL = "GENERAL"


class SupportedLanguage(str, Enum):
    EN = "en"
    HI = "hi"
    TA = "ta"
    BN = "bn"


class SafetyFlag(str, Enum):
    SAFE = "safe"
    BLOCKED = "blocked"
    HELPLINE_TRIGGERED = "helpline_triggered"
    ESCALATION_SUGGESTED = "escalation_suggested"


# ---------- Request Schemas ----------


class MessageContext(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class QueryRequest(BaseModel):
    """Incoming query from the API gateway."""

    query: str = Field(..., min_length=1, max_length=2000, description="User's legal question")
    chat_id: str = Field(..., description="Chat session ID")
    user_id: str = Field(..., description="User ID")
    language: SupportedLanguage = Field(default=SupportedLanguage.EN)
    persona: PersonaMode = Field(default=PersonaMode.GENERAL)
    state: Optional[str] = Field(default=None, description="User's Indian state for jurisdiction")
    profession: Optional[str] = Field(default=None)
    education: Optional[str] = Field(default=None)
    message_history: list[MessageContext] = Field(
        default_factory=list, description="Recent conversation history (last 5 turns)"
    )


class SimplifyRequest(BaseModel):
    """Request to simplify a legal response."""

    text: str = Field(..., min_length=1, max_length=10000)
    language: SupportedLanguage = Field(default=SupportedLanguage.EN)
    persona: PersonaMode = Field(default=PersonaMode.GENERAL)


class IngestRequest(BaseModel):
    """Request to ingest a legal document."""

    title: str
    document_type: str
    source_url: str
    content: str = Field(..., min_length=10)
    jurisdiction: str = Field(default="Central")
    year_enacted: Optional[int] = None
    metadata: dict = Field(default_factory=dict)


# ---------- Response Schemas ----------


class LegalReference(BaseModel):
    """A reference to a source legal document."""

    document_id: str
    title: str
    document_type: str
    section: Optional[str] = None
    relevance_score: float
    excerpt: str = Field(default="", description="Relevant excerpt from the source")


class HelplineInfo(BaseModel):
    """Helpline contact information."""

    name: str
    phone: str
    description: str
    category: str


class QueryResponse(BaseModel):
    """Response from the RAG pipeline."""

    answer: str = Field(..., description="The generated legal guidance")
    answer_translated: Optional[str] = Field(
        default=None, description="Answer translated to user's language"
    )
    references: list[LegalReference] = Field(default_factory=list)
    helplines: list[HelplineInfo] = Field(default_factory=list)
    safety_flag: SafetyFlag = Field(default=SafetyFlag.SAFE)
    safety_message: Optional[str] = None
    disclaimer: str = Field(
        default="This information is for educational purposes only and does not constitute legal advice. Please consult a qualified lawyer for your specific situation."
    )
    persona_used: PersonaMode
    language_detected: SupportedLanguage
    confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)
    ipc_bns_note: Optional[str] = Field(
        default=None,
        description="Note about IPC to BNS transition if applicable",
    )
    processing_time_ms: float = 0.0


class SimplifyResponse(BaseModel):
    """Simplified version of a legal response."""

    simplified_text: str
    language: SupportedLanguage


class IngestResponse(BaseModel):
    """Response after document ingestion."""

    document_id: str
    chunks_created: int
    status: str


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    models_loaded: bool
    database_connected: bool
