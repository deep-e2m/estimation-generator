"""
Structured quote service.

Builds a deep JSON representation of an estimate (sections, deliverables,
totals) from the existing quote generation outputs.

This is a first, conservative version that:
- Treats the full generated content as the "executive_summary" section.
- Converts the generation breakdown list (if present) into a simple
  list of deliverables with hours.
"""

from collections.abc import Sequence
from typing import Any, Iterable, Optional

from app.schemas.quote_structured import (
    StructuredDeliverable,
    StructuredQuoteContent,
    StructuredSection,
    StructuredTotals,
)


def _numeric(value: Any) -> float:
    """Best-effort conversion to a non-negative float."""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value) if value >= 0 else 0.0
    try:
        num = float(str(value).strip())
        return num if num >= 0 else 0.0
    except (TypeError, ValueError):
        return 0.0


def build_structured_content(
    *,
    content: str,
    breakdown: Optional[Iterable[dict[str, Any]]] = None,
    total_hours: Optional[float] = None,
) -> StructuredQuoteContent:
    """
    Build a StructuredQuoteContent object from the raw generation outputs.

    - `content` is the full generated markdown/HTML body.
    - `breakdown` is the optional list of phase/hour items from the LLM.
    - `total_hours` is the aggregate hours from the LLM.
    """
    # Executive summary / main narrative section
    sections: list[StructuredSection] = [
        StructuredSection(
            id="exec-summary",
            type="executive_summary",
            title="Executive Summary & Scope",
            html=str(content or ""),
            deliverables=[],
        )
    ]

    # Convert breakdown into a simple "hours" section, if present
    deliverables: list[StructuredDeliverable] = []
    if breakdown:
        for idx, item in enumerate(breakdown):
            if not isinstance(item, dict):
                continue
            phase = str(item.get("phase") or f"Phase {idx + 1}")
            hours_min = _numeric(item.get("hours_min"))
            hours_max = _numeric(item.get("hours_max"))
            hours = hours_max or hours_min
            deliverables.append(
                StructuredDeliverable(
                    id=f"deliverable-{idx}",
                    label=phase,
                    description=f"{phase} phase",
                    hours=hours,
                )
            )

    if deliverables:
        sections.append(
            StructuredSection(
                id="hours",
                type="hours",
                title="Estimated Effort",
                html=None,
                deliverables=deliverables,
            )
        )

    # Totals: prefer explicit total_hours, fall back to sum of deliverables
    total_from_llm = _numeric(total_hours)
    if total_from_llm <= 0 and deliverables:
        total_from_llm = sum(d.hours for d in deliverables)

    totals = StructuredTotals(total_hours=total_from_llm)

    return StructuredQuoteContent(sections=sections, totals=totals)

