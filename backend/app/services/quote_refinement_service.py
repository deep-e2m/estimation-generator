"""
Quote refinement service for conversational quote updates.

This service handles natural language requests to modify quotes,
parsing user intent and applying structural changes.
"""

import json
import logging
from decimal import Decimal
from typing import Any, Optional

from app.models.quote import Quote
from app.schemas.quote import ChangeDescription
from app.services.ai.llm_service import LLMService, get_llm_service

logger = logging.getLogger(__name__)


class QuoteRefinementService:
    """Service for refining quotes through natural language conversation."""

    def __init__(self, llm_service: Optional[LLMService] = None):
        """Initialize the refinement service."""
        self.llm_service = llm_service or get_llm_service()

    async def refine_quote_conversational(
        self,
        quote: Quote,
        user_message: str,
    ) -> tuple[str, str, list[ChangeDescription]]:
        """
        Process a natural language request to modify a quote.

        Args:
            quote: The quote to modify.
            user_message: Natural language request from the user.

        Returns:
            Tuple of (updated_content, ai_explanation, changes_list)
        """
        logger.info("Processing quote refinement request: quote_id=%s", quote.id)

        # Build the refinement prompt
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(quote, user_message)

        # Call LLM to parse intent and generate updated content
        try:
            response = await self.llm_service.client.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,  # Lower temperature for more consistent structural changes
                response_format={"type": "json_object"},
            )

            result = json.loads(response.content)

            updated_content = result.get("updated_content", quote.content)
            ai_message = result.get("explanation", "Quote updated successfully.")
            changes_raw = result.get("changes", [])

            # Parse changes
            changes = [
                ChangeDescription(
                    section=change.get("section", "unknown"),
                    change_type=change.get("change_type", "updated"),
                    description=change.get("description", ""),
                    field_path=change.get("field_path"),
                )
                for change in changes_raw
            ]

            logger.info(
                "Quote refinement completed: quote_id=%s, changes=%d",
                quote.id,
                len(changes),
            )

            return updated_content, ai_message, changes

        except Exception as e:
            logger.error("Quote refinement failed: %s", str(e))
            raise Exception(f"Failed to process refinement request: {str(e)}")

    def _build_system_prompt(self) -> str:
        """Build the system prompt for quote refinement."""
        return """You are a helpful assistant that modifies project estimates/quotes based on natural language requests.

Your task is to:
1. Understand the user's request (modify hours, add/remove deliverables, update text, etc.)
2. Apply the changes to the quote content
3. Return the updated content with an explanation

The quote content is in markdown format with sections like:
- Executive Summary
- Deliverables
- Hours Breakdown
- Assumptions
- Exclusions

When modifying hours:
- Look for tables or lists showing hours estimates
- Update the specific item requested
- Recalculate totals if needed

When adding deliverables:
- Add them in the appropriate section
- Include estimated hours if you can infer them

When modifying text:
- Make the changes while maintaining the overall structure and tone

Respond with JSON in this format:
{
  "updated_content": "The complete updated markdown content",
  "explanation": "A brief explanation of what you changed",
  "changes": [
    {
      "section": "deliverables|hours|content|etc",
      "change_type": "added|updated|removed",
      "description": "Human-readable description",
      "field_path": "optional.json.path"
    }
  ]
}"""

    def _build_user_prompt(self, quote: Quote, user_message: str) -> str:
        """Build the user prompt with quote context."""
        return f"""Here is the current quote content:

---
{quote.content}
---

Total Hours: {quote.total_hours}
Platform: {quote.platform}

User request: {user_message}

Please apply this change to the quote and return the updated content."""


# Singleton instance
_refinement_service: Optional[QuoteRefinementService] = None


def get_refinement_service() -> QuoteRefinementService:
    """Get the singleton refinement service instance."""
    global _refinement_service
    if _refinement_service is None:
        _refinement_service = QuoteRefinementService()
    return _refinement_service
