"""
Structured quote content schema.

This schema captures the deep JSON representation of an estimate
that can be used as the single source of truth for sections,
deliverables, and totals. HTML/markdown views are derived from this.
"""

from typing import List, Optional

from pydantic import BaseModel, Field


class StructuredDeliverable(BaseModel):
    """Single line item / phase in the estimate."""

    id: str = Field(..., description="Stable identifier for the deliverable/phase")
    label: str = Field(..., description="Human-readable label (e.g. 'Homepage design')")
    description: Optional[str] = Field(
        default=None,
        description="Optional description or notes for this deliverable",
    )
    hours: float = Field(
        default=0,
        ge=0,
        description="Estimated hours for this deliverable",
    )


class StructuredSection(BaseModel):
    """
    Logical section of the estimate document.

    type: semantic identifier such as 'executive_summary', 'scope',
    'hours', 'assumptions', etc.
    """

    id: str = Field(..., description="Stable identifier for the section")
    type: str = Field(..., description="Section type (executive_summary, hours, etc.)")
    title: Optional[str] = Field(
        default=None,
        description="Optional section heading/title",
    )
    # For narrative sections we keep the HTML/markdown body here
    html: Optional[str] = Field(
        default=None,
        description="Raw HTML/markdown body for this section, when applicable",
    )
    # For structured hours sections we keep deliverables
    deliverables: List[StructuredDeliverable] = Field(
        default_factory=list,
        description="Deliverables / phases within this section (if any)",
    )


class StructuredTotals(BaseModel):
    """Aggregate totals for the entire estimate."""

    total_hours: float = Field(
        default=0,
        ge=0,
        description="Aggregate total hours across all deliverables/sections",
    )


class StructuredQuoteContent(BaseModel):
    """
    Deep JSON representation of a quote.

    This is intended to be the primary source of truth for the estimate.
    The rendered document (HTML/PDF/DOCX) is derived from this structure.
    """

    sections: List[StructuredSection] = Field(
        default_factory=list,
        description="Ordered list of sections in the estimate",
    )
    totals: StructuredTotals = Field(
        default_factory=StructuredTotals,
        description="Aggregate totals for the estimate",
    )

