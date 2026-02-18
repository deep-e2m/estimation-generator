"""
Quote refinement service for conversational quote updates.

This service handles natural language requests to modify quotes,
parsing user intent and applying structural changes. Can also update
total hours and project name/description when the user requests it.
"""

import json
import logging
from typing import Any, Optional

from app.models.quote import ContentFormat, Quote
from app.schemas.quote import ChangeDescription
from app.services.ai.llm_service import LLMService, get_llm_service

logger = logging.getLogger(__name__)


def _parse_number(value: Any) -> Optional[float]:
    """Parse a number from LLM output; return None if invalid."""
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            v = float(value)
            return v if v >= 0 else None
        except (TypeError, ValueError):
            return None
    if isinstance(value, str):
        try:
            v = float(value.strip())
            return v if v >= 0 else None
        except ValueError:
            return None
    return None


class QuoteRefinementService:
    """Service for refining quotes through natural language conversation."""

    def __init__(self, llm_service: Optional[LLMService] = None):
        """Initialize the refinement service."""
        self.llm_service = llm_service or get_llm_service()

    async def refine_quote_conversational(
        self,
        quote: Quote,
        user_message: str,
        project_name: Optional[str] = None,
        project_description: Optional[str] = None,
        project_context: Optional[dict[str, Any]] = None,
    ) -> tuple[
        str,
        str,
        list[ChangeDescription],
        Optional[float],
        Optional[dict[str, Optional[str]]],
        Optional[float],
        bool,
    ]:
        """
        Process a natural language request to modify a quote (and optionally project).

        Args:
            quote: The quote to modify.
            user_message: Natural language request from the user.
            project_name: Current project name (so LLM can return project_updates if user asks).
            project_description: Current project description (same).

        Returns:
            Tuple of (updated_content, ai_explanation, changes_list, new_total_hours, project_updates).
            new_total_hours: set when user asks to change total hours (e.g. increase by 20).
            project_updates: optional dict with keys "name" and/or "description" (only if user asked to change them).
        """
        logger.info("Processing quote refinement request: quote_id=%s", quote.id)

        # Detect when the quote content is HTML so we can keep the refinement
        # operation surgical (only adjust numeric hours) and avoid disturbing
        # the carefully formatted layout produced by the inline editor.
        is_html = getattr(quote, "content_format", None) == ContentFormat.HTML

        system_prompt = self._build_system_prompt(is_html=is_html)
        user_prompt = self._build_user_prompt(
            quote,
            user_message,
            project_name=project_name,
            project_description=project_description,
            is_html=is_html,
            project_context=project_context,
        )

        try:
            response = await self.llm_service.client.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
            )

            result = json.loads(response.content)

            updated_content = result.get("updated_content", quote.content)
            ai_message = result.get("explanation", "Quote updated successfully.")
            changes_raw = result.get("changes", [])

            changes = [
                ChangeDescription(
                    section=change.get("section", "unknown"),
                    change_type=change.get("change_type", "updated"),
                    description=change.get("description", ""),
                    field_path=change.get("field_path"),
                )
                for change in changes_raw
            ]

            new_total_hours = _parse_number(result.get("new_total_hours"))
            proposed_new_total_hours = _parse_number(result.get("proposed_new_total_hours"))
            needs_hour_confirmation_raw = result.get("needs_hour_confirmation")
            needs_hour_confirmation = bool(needs_hour_confirmation_raw) if isinstance(
                needs_hour_confirmation_raw, (bool, int, float, str)
            ) else False
            project_updates_raw = result.get("project_updates")
            project_updates: Optional[dict[str, Optional[str]]] = None
            if isinstance(project_updates_raw, dict) and project_updates_raw:
                project_updates = {}
                if "name" in project_updates_raw and project_updates_raw["name"] is not None:
                    project_updates["name"] = str(project_updates_raw["name"]).strip() or None
                if "description" in project_updates_raw:
                    project_updates["description"] = (
                        str(project_updates_raw["description"]).strip()
                        if project_updates_raw["description"] is not None
                        else None
                    )
                if not project_updates:
                    project_updates = None

            logger.info(
                "Quote refinement completed: quote_id=%s, changes=%d, new_total_hours=%s, "
                "proposed_new_total_hours=%s, needs_hour_confirmation=%s, project_updates=%s",
                quote.id,
                len(changes),
                new_total_hours,
                proposed_new_total_hours,
                needs_hour_confirmation,
                bool(project_updates),
            )

            return (
                updated_content,
                ai_message,
                changes,
                new_total_hours,
                project_updates,
                proposed_new_total_hours,
                needs_hour_confirmation,
            )

        except Exception as e:
            logger.error("Quote refinement failed: %s", str(e))
            raise Exception(f"Failed to process refinement request: {str(e)}") from e

    def _build_system_prompt(self, *, is_html: bool) -> str:
        """Build the system prompt for quote refinement.

        When is_html=True, the assistant MUST treat the content as literal HTML
        and only adjust numeric hour values, preserving headings/structure.
        """
        if is_html:
            return """You are a careful assistant that edits HTML project estimates based on natural language requests.

The quote content you receive is FULL HTML produced by a rich-text editor.

Your task:
1. Understand the user's request (e.g. change specific hour values, add/remove small items).
2. Apply ONLY the requested numeric hour changes within the existing HTML.
3. Return the COMPLETE updated HTML as "updated_content" while preserving:
   - All headings and section order
   - All tags and attributes
   - All non‑numeric text

STRICT RULES FOR HTML MODE:
- TREAT THE INPUT AS LITERAL HTML CODE.
- DO NOT add or remove sections, headings, paragraphs, lists, or <hr> elements.
- DO NOT reformat, pretty‑print, or normalize the HTML.
- DO NOT change any wording except where a numeric hour value must change to satisfy the request.
- The output HTML should be byte‑for‑byte identical to the input except for the specific numbers you were asked to adjust.

When the user asks to change total hours (e.g. "increase estimation by 20 hrs" or "set total to 150"), you MUST:
- Update the relevant numeric values inside the HTML, AND
- Set "new_total_hours" in your JSON to the new numeric total.

If the user explicitly asks to change the PROJECT name or PROJECT description (e.g. "rename the project to X"), you may also include "project_updates" as described below, but DO NOT attempt to change any HTML structure for that.

Respond with JSON in this format:
{
  "updated_content": "<the complete updated HTML>",
  "explanation": "A brief explanation of what you changed",
  "changes": [
    {
      "section": "deliverables|hours|content|etc",
      "change_type": "added|updated|removed",
      "description": "Human-readable description",
      "field_path": "optional.json.path"
    }
  ],
  "new_total_hours": 155,
  "project_updates": { "name": "New Project Name", "description": "New description or null" }
}

Rules:
- Omit "new_total_hours" if the user did not ask to change total/estimation hours; include it (as a number) whenever you changed the total in the document.
- Omit "project_updates" entirely if the user did not ask to change project name or description; include only "name" and/or "description" keys that the user asked to change."""

        # Markdown / plain-text mode (tightened for minimal, targeted edits)
        return """You are a careful assistant that modifies project estimates/quotes based on natural language requests.

Your task is to:
1. Understand the user's request (modify hours, add/remove deliverables, update text, change project name/description, etc.)
2. Apply ONLY the minimal changes needed to satisfy the request to the quote content (and optionally report project or total-hours updates)
3. Return the updated content with an explanation

The quote content is in markdown format with sections like:
- Executive Summary
- Deliverables
- Hours Breakdown
- Assumptions
- Exclusions

STRICT RULES FOR EDITING:
- Treat the existing document as the source of truth.
- DO NOT add new sections, headings, or boilerplate unless the user explicitly asks for them.
- DO NOT reorder sections or rewrite large parts of the document when the user only requested a small change.
- DO NOT copy or include any of the "PROJECT CONTEXT" helper text that appears AFTER the document (it is for reasoning only).

When modifying hours:
- Look for tables or lists showing hours estimates
- Update the specific item requested
- Recalculate totals in the document text
- If the user asks to change total hours (e.g. "increase estimation by 20 hrs" or "set total to 150"), you MUST also set "new_total_hours" in your JSON to the new numeric total so the system can update the stored total.

When adding deliverables:
- Add them in the appropriate section
- Include estimated hours if you can infer them

When modifying text:
- Make the smallest possible changes while maintaining the overall structure and tone

When the user asks to change the PROJECT name or PROJECT description (e.g. "rename the project to X", "update project description to Y"):
- Include "project_updates" in your JSON with only the keys that changed: "name" and/or "description". Use the new value the user requested. Omit project_updates entirely if the user did not ask to change project name or description.

When your changes clearly imply that the overall total hours SHOULD change (for example, the user adds a substantial new feature or asks for “roughly 20 more hours” but does NOT explicitly say to update the stored total hours):
- Propose a new total using:
  - "proposed_new_total_hours": <number>
  - "needs_hour_confirmation": true
- and LEAVE "new_total_hours" unset/null so the system can ask the user to confirm before applying it.

When the user explicitly instructs you to set the total hours (e.g. "set total to 150 hours", "increase total hours by 20 and apply it now"):
- Set "new_total_hours" to that number and you MAY omit "proposed_new_total_hours" and "needs_hour_confirmation".

The input you receive includes:
- The full quote content (between --- markers)
- The numeric Total Hours and Platform
- An OPTIONAL "PROJECT CONTEXT" block that is ONLY for reasoning and MUST NOT be copied into the updated_content.

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
  ],
  "new_total_hours": 155,
  "proposed_new_total_hours": 160,
  "needs_hour_confirmation": true,
  "project_updates": { "name": "New Project Name", "description": "New description or null" }
}

Rules:
- Omit "new_total_hours" if the user did not clearly ask you to update the stored total hours; include it (as a number) ONLY when the user explicitly requested to change the total.
- When you believe hours should change but the user did not explicitly say to update the stored total, set "proposed_new_total_hours" and "needs_hour_confirmation": true instead, and leave "new_total_hours" unset/null.
- If no change to total hours is needed, omit both "new_total_hours" and "proposed_new_total_hours", and set "needs_hour_confirmation": false or omit it.
- Omit "project_updates" entirely if the user did not ask to change project name or description; include only "name" and/or "description" keys that the user asked to change.
- NEVER include the PROJECT CONTEXT helper block (or any of its lines) inside "updated_content". It is for reasoning only."""

    def _build_user_prompt(
        self,
        quote: Quote,
        user_message: str,
        project_name: Optional[str] = None,
        project_description: Optional[str] = None,
        is_html: bool = False,
        project_context: Optional[dict[str, Any]] = None,
    ) -> str:
        """Build the user prompt with quote and project context."""
        content = self._flatten_quote_content(quote.content)
        header_lines: list[str] = []
        if is_html:
            header_lines.append(
                "The quote content below is FULL HTML from a rich-text editor. "
                "Treat it as literal HTML code. Only adjust numeric hour values requested by the user; "
                "do not change headings, tags, or overall structure."
            )
        else:
            header_lines.append("Here is the current quote content (markdown/text):")

        lines = [
            *header_lines,
            "---",
            content,
            "---",
            "",
            f"Total Hours: {quote.total_hours}",
            f"Platform: {quote.platform}",
            "",
        ]
        if project_name is not None or project_description is not None:
            lines.append("PROJECT CONTEXT (FOR REASONING ONLY - DO NOT COPY INTO updated_content):")
            if project_name is not None:
                lines.append(f"Project name: {project_name}")
            if project_description is not None:
                lines.append(f"Project description: {project_description or '(none)'}")
            lines.append("")
        # Optional WordPress stack context (locked + recommended tools with URLs)
        if project_context:
            wordpress_stack = project_context.get("wordpress_stack")
            if wordpress_stack:
                locked = wordpress_stack.get("locked") or {}
                recommended = wordpress_stack.get("recommended") or {}
                locked_plugins = locked.get("plugins") or []
                locked_themes = locked.get("themes") or []
                locked_builders = locked.get("page_builders") or []
                recommended_plugins = recommended.get("plugins") or []
                recommended_themes = recommended.get("themes") or []

                lines.append(
                    "WORDPRESS STACK (LOCKED-IN CLIENT TOOLS + RESEARCHED RECOMMENDATIONS) "
                    "[FOR REASONING AND URL ACCURACY ONLY – DO NOT COPY THIS ENTIRE BLOCK VERBATIM]"
                )
                lines.append("")
                lines.append(
                    "Locked-in tools from the client (you MUST NOT replace these; keep them in the estimate):"
                )
                lines.append("- Plugins (client-specified):")
                for p in locked_plugins:
                    name = (p.get("name") or "").strip()
                    url = (p.get("url") or "").strip()
                    if not name:
                        continue
                    line = f"  - {name}"
                    if url:
                        line += f" (URL: {url})"
                    lines.append(line)

                lines.append("- Themes (client-specified):")
                for t in locked_themes:
                    name = (t.get("name") or "").strip()
                    url = (t.get("url") or "").strip()
                    if not name:
                        continue
                    line = f"  - {name}"
                    if url:
                        line += f" (URL: {url})"
                    lines.append(line)

                lines.append("- Page builders (client-specified):")
                for b in locked_builders:
                    name = (b.get("name") or "").strip()
                    url = (b.get("url") or "").strip()
                    if not name:
                        continue
                    line = f"  - {name}"
                    if url:
                        line += f" (URL: {url})"
                    lines.append(line)

                lines.append("")
                lines.append(
                    "Recommended tools for missing capabilities (you MAY add these where they make sense):"
                )
                lines.append("- Plugins:")
                for p in recommended_plugins:
                    name = (p.get("name") or "").strip()
                    url = (p.get("url") or "").strip()
                    purpose = (p.get("purpose") or "").strip()
                    price = (p.get("price") or "").strip()
                    if not name:
                        continue
                    line = f"  - {name}"
                    details: list[str] = []
                    if url:
                        details.append(f"URL: {url}")
                    if purpose:
                        details.append(purpose)
                    if price:
                        details.append(price)
                    if details:
                        line += " – " + "; ".join(details)
                    lines.append(line)

                lines.append("- Themes:")
                for t in recommended_themes:
                    name = (t.get("name") or "").strip()
                    url = (t.get("url") or "").strip()
                    notes = (t.get("notes") or "").strip()
                    if not name:
                        continue
                    line = f"  - {name}"
                    details = []
                    if url:
                        details.append(f"URL: {url}")
                    if notes:
                        details.append(notes)
                    if details:
                        line += " – " + "; ".join(details)
                    lines.append(line)

                lines.append("")
                lines.append(
                    "When you mention ANY plugin, theme, or page builder in updated_content, "
                    "always include its official URL inline using the pattern "
                    '"Name (URL: https://example.com)". Respect locked-in tools and do not '
                    "replace them; you may add recommended ones where appropriate."
                )
                lines.append("")
        lines.append(f"User request: {user_message}")
        lines.append("")
        lines.append("Apply the change to the quote and return the updated content. If they asked to change total hours or project name/description, include new_total_hours and/or project_updates in your JSON as described.")
        return "\n".join(lines)

    def _flatten_quote_content(self, content: str) -> str:
        """
        Flatten quote content for use in LLM prompts.

        Quote content may be stored as:
        - BlockNote JSON (array of blocks)
        - markdown/plain text
        - HTML (from the editor)
        - legacy flat dict (key-value sections)

        For flat dict we output "key: value" per section.
        For BlockNote/other JSON we extract human-readable text segments.
        """
        if not content:
            return content

        try:
            parsed = json.loads(content)
        except (TypeError, ValueError):
            return content

        if isinstance(parsed, dict) and parsed and all(
            isinstance(v, str) for v in parsed.values()
        ):
            parts = [f"{k}:\n{v.strip()}" for k, v in parsed.items() if (v or "").strip()]
            if parts:
                return "\n\n".join(parts)

        texts: list[str] = []

        def _walk(node: Any) -> None:
            if isinstance(node, dict):
                for key, value in node.items():
                    if isinstance(value, str) and key in {"text", "content", "title"}:
                        stripped = value.strip()
                        if stripped:
                            texts.append(stripped)
                    else:
                        _walk(value)
            elif isinstance(node, list):
                for item in node:
                    _walk(item)

        _walk(parsed)
        if texts:
            return "\n\n".join(texts)
        return content


# Singleton instance
_refinement_service: Optional[QuoteRefinementService] = None


def get_refinement_service() -> QuoteRefinementService:
    """Get the singleton refinement service instance."""
    global _refinement_service
    if _refinement_service is None:
        _refinement_service = QuoteRefinementService()
    return _refinement_service
