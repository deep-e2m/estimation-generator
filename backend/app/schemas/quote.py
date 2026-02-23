"""
Quote schemas for request/response validation.

This module defines Pydantic schemas for quote-related endpoints
including generation, CRUD operations, and status management.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.quote import Complexity, ContentFormat, QuoteStatus
from app.schemas.auth import APIResponse
from app.schemas.project import PaginationMeta


# =============================================================================
# Quote Base Schemas
# =============================================================================


class QuoteBase(BaseModel):
    """Base quote schema with common fields."""

    title: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Quote title",
        examples=["WordPress E-commerce Website Development"],
    )
    requirements: str = Field(
        ...,
        min_length=10,
        max_length=50000,
        description="Client requirements for the project",
        examples=["Build a WordPress site with WooCommerce, 10 product pages, shopping cart..."],
    )


class QuoteCreate(QuoteBase):
    """Schema for quote creation request (without LLM generation)."""

    content: str = Field(
        ...,
        min_length=1,
        description="Quote content/document",
    )
    total_hours: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        description="Estimated total hours",
    )
    platform: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Target platform",
    )
    complexity: Complexity = Field(
        default=Complexity.MEDIUM,
        description="Project complexity level",
    )


class QuoteGenerateRequest(BaseModel):
    """Schema for quote generation request with LLM."""

    requirements: str = Field(
        ...,
        min_length=0,
        max_length=50000,
        description="Client requirements for the project (any length; estimation also uses project title and uploaded documents)",
        examples=["Build a WordPress site with WooCommerce, 10 product pages, shopping cart..."],
    )
    title: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional title for the quote. If not provided, one will be generated.",
    )
    hourly_rate: Optional[float] = Field(
        default=None,
        ge=0,
        description="Hourly rate for cost calculation",
        examples=[125.00],
    )
    use_rag: bool = Field(
        default=True,
        description="Whether to use RAG context from knowledge base",
    )
    project_context: Optional[dict[str, Any]] = Field(
        default=None,
        description="Additional project context (client name, industry, etc.)",
    )
    regenerate: bool = Field(
        default=False,
        description="If true, delete existing estimate and create new one. Otherwise fail if estimate exists.",
    )


class QuoteUpdate(BaseModel):
    """Schema for quote update request. All fields are optional."""

    title: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=500,
        description="Quote title",
    )
    content: Optional[str] = Field(
        default=None,
        min_length=1,
        description="Quote content/document (markdown or HTML from Tiptap editor)",
    )
    content_format: Optional[ContentFormat] = Field(
        default=None,
        description="Format of the content field: 'markdown' or 'html'. "
        "If not provided, auto-detected from the content.",
    )
    requirements: Optional[str] = Field(
        default=None,
        min_length=10,
        max_length=50000,
        description="Client requirements",
    )
    total_hours: Optional[Decimal] = Field(
        default=None,
        ge=0,
        description="Estimated total hours",
    )
    complexity: Optional[Complexity] = Field(
        default=None,
        description="Project complexity level",
    )


class QuoteStatusUpdate(BaseModel):
    """Schema for quote status update request."""

    status: QuoteStatus = Field(
        ...,
        description="New status for the quote",
    )

    @field_validator("status")
    @classmethod
    def validate_status_transition(cls, v: QuoteStatus) -> QuoteStatus:
        """Validate status is a valid target status."""
        # All statuses are valid targets; transition validation happens in the endpoint
        return v


class QuoteRegenerateRequest(BaseModel):
    """Schema for quote regeneration request."""

    feedback: Optional[str] = Field(
        default=None,
        max_length=5000,
        description="Feedback or refinement instructions for the regeneration",
    )
    use_rag: bool = Field(
        default=True,
        description="Whether to use RAG context from knowledge base",
    )


class RefineQuoteRequest(BaseModel):
    """Schema for conversational quote refinement request."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Natural language request to modify the quote",
        examples=[
            "Increase the hours for login feature to 20",
            "Add a new deliverable for password reset",
            "Update the executive summary to mention mobile responsiveness",
        ],
    )


class ChangeDescription(BaseModel):
    """Description of a change applied to the quote."""

    section: str = Field(..., description="Section that was modified (e.g., 'deliverables', 'hours', 'content')")
    change_type: str = Field(
        ..., description="Type of change (e.g., 'added', 'updated', 'removed')"
    )
    description: str = Field(..., description="Human-readable description of what changed")
    field_path: Optional[str] = Field(
        None, description="JSON path to the changed field (if applicable)"
    )


# =============================================================================
# Quote Response Schemas
# =============================================================================


class QuoteResponse(BaseModel):
    """Schema for quote data in responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Unique quote identifier")
    quote_number: str = Field(default="", description="Human-readable quote number")
    project_id: UUID = Field(..., description="ID of the parent project")
    title: str = Field(..., description="Quote title")
    content: str = Field(..., description="Quote content/document")
    content_format: ContentFormat = Field(
        default=ContentFormat.MARKDOWN,
        description="Format of the content: 'markdown' or 'html'",
    )
    requirements: str = Field(..., description="Client requirements")
    total_hours: Decimal = Field(..., description="Estimated total hours")
    platform: str = Field(..., description="Target platform")
    complexity: Complexity = Field(..., description="Project complexity")
    status: QuoteStatus = Field(..., description="Current quote status")
    created_by: UUID = Field(..., description="ID of user who created the quote")
    approved_by: Optional[UUID] = Field(None, description="ID of user who approved the quote")
    approved_at: Optional[datetime] = Field(None, description="Approval timestamp")
    metadata: Optional[dict[str, Any]] = Field(None, description="Additional metadata")
    prepared_by: Optional[str] = Field(
        None,
        description="Name shown as 'Prepared by' (default E2M Solutions; editable by user)",
    )
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    @field_validator("quote_number", mode="before")
    @classmethod
    def generate_quote_number(cls, v, info):
        """Generate quote_number from UUID if not provided."""
        if v:
            return v
        # Get the id from values if available
        id_val = info.data.get("id") if info.data else None
        if id_val:
            return f"QT-{str(id_val)[:8].upper()}"
        return ""


class QuoteSummaryResponse(BaseModel):
    """Shortened quote response for listings."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Unique quote identifier")
    quote_number: str = Field(default="", description="Human-readable quote number")
    project_id: UUID = Field(..., description="ID of the parent project")
    project_name: Optional[str] = Field(None, description="Name of the parent project")
    title: str = Field(..., description="Quote title")
    total_hours: Decimal = Field(..., description="Estimated total hours")
    platform: str = Field(..., description="Target platform")
    complexity: Complexity = Field(..., description="Project complexity")
    status: QuoteStatus = Field(..., description="Current quote status")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    @field_validator("quote_number", mode="before")
    @classmethod
    def generate_quote_number(cls, v, info):
        """Generate quote_number from UUID if not provided."""
        if v:
            return v
        id_val = info.data.get("id") if info.data else None
        if id_val:
            return f"QT-{str(id_val)[:8].upper()}"
        return ""


class QuoteDetailResponse(QuoteResponse):
    """Extended quote response with additional information."""

    project_name: Optional[str] = Field(None, description="Name of the parent project")
    creator_name: Optional[str] = Field(None, description="Name of the quote creator")
    approver_name: Optional[str] = Field(None, description="Name of the approver (if approved)")


class RefinedProjectUpdate(BaseModel):
    """Project fields updated by refine (e.g. name/description from chat)."""

    name: Optional[str] = Field(None, description="Updated project name if changed")
    description: Optional[str] = Field(None, description="Updated project description if changed")


class RefineQuoteResponse(BaseModel):
    """Response schema for conversational quote refinement."""

    updated_quote: QuoteResponse = Field(..., description="The updated quote after applying changes")
    ai_message: str = Field(..., description="AI explanation of what was changed")
    changes_applied: list[ChangeDescription] = Field(
        ..., description="List of changes that were applied"
    )
    proposed_new_total_hours: Optional[Decimal] = Field(
        None,
        description=(
            "Proposed new total hours based on the latest refinement. "
            "This value is NOT applied automatically; the UI should "
            "ask the user to confirm before updating stored total_hours."
        ),
    )
    needs_hour_confirmation: bool = Field(
        default=False,
        description=(
            "True when the assistant believes total hours should change and "
            "proposed_new_total_hours is set, but the system should confirm "
            "with the user before applying it."
        ),
    )
    updated_project: Optional[RefinedProjectUpdate] = Field(
        None,
        description="Project name/description if updated via chat; absent otherwise",
    )


# =============================================================================
# Quote Generation Response Schemas
# =============================================================================


class AnalysisMetadata(BaseModel):
    """Metadata about the analysis performed during quote generation."""

    requirements_count: int = Field(default=0, description="Number of requirements identified")
    tasks_count: int = Field(default=0, description="Number of tasks/deliverables identified")
    sections_count: int = Field(default=0, description="Number of sections in the quote")
    pages_count: int = Field(default=0, description="Number of pages identified")
    complexity_factors: list[str] = Field(default_factory=list, description="Factors affecting complexity")
    has_multi_language: bool = Field(
        default=False,
        description="True when requirements/quote include multi-language scope",
    )
    has_interactive_tools: bool = Field(
        default=False,
        description="True when requirements/quote include interactive tools/embeds",
    )
    has_seo: bool = Field(
        default=False,
        description="True when requirements/quote include SEO or analytics work",
    )


class QuoteGenerationMetadata(BaseModel):
    """Metadata about the quote generation process."""

    model_used: str = Field(..., description="LLM model used for generation")
    tokens_used: int = Field(..., description="Total tokens consumed")
    generation_cost: float = Field(..., description="Cost of the LLM API call")
    rag_context_used: bool = Field(
        ...,
        description="Whether any RAG reference was used (company stack from KB and/or similar quotes)",
    )
    generation_time_ms: Optional[int] = Field(None, description="Generation time in milliseconds")
    analysis: Optional[AnalysisMetadata] = Field(None, description="Analysis metadata from quote generation")
    validation_warnings: list[str] = Field(
        default_factory=list,
        description="Content or stack validation warnings from generation",
    )
    company_stack_used: bool = Field(
        default=True,
        description="Whether company stack context was applied",
    )
    company_stack_fallback: Optional[str] = Field(
        None,
        description="e.g. 'builtin' when RAG stack was unavailable; null when from RAG",
    )


class QuoteGenerationResponse(BaseModel):
    """Response schema for quote generation."""

    quote: QuoteResponse = Field(..., description="The generated quote")
    generation_metadata: QuoteGenerationMetadata = Field(..., description="Generation metadata")


# =============================================================================
# List Response Schemas
# =============================================================================


class QuoteListData(BaseModel):
    """Data container for quote list response."""

    quotes: list[QuoteSummaryResponse] = Field(..., description="List of quotes")
    pagination: PaginationMeta = Field(..., description="Pagination information")


class QuoteListResponse(APIResponse):
    """Response schema for quote listing endpoint."""

    data: QuoteListData = Field(..., description="Quote list data with pagination")


# =============================================================================
# Single Quote Response Schemas
# =============================================================================


class QuoteDataResponse(APIResponse):
    """Response schema for single quote operations."""

    data: QuoteResponse = Field(..., description="Quote data")


class QuoteDetailDataResponse(APIResponse):
    """Response schema for quote detail view."""

    data: QuoteDetailResponse = Field(..., description="Detailed quote data")


class QuoteGenerateDataResponse(APIResponse):
    """Response schema for quote generation."""

    data: QuoteGenerationResponse = Field(..., description="Generated quote with metadata")


class QuoteDeleteResponse(APIResponse):
    """Response schema for quote deletion."""

    data: dict = Field(
        default={"message": "Quote deleted successfully"},
        description="Deletion confirmation",
    )


class RefineQuoteDataResponse(APIResponse):
    """Response schema for quote refinement."""

    data: RefineQuoteResponse = Field(..., description="Refined quote with changes")
