"""
LLM Service for Quote Generation.

High-level service for interacting with LLMs through OpenRouter.
Handles prompt construction, response parsing, and quote generation workflows.
"""

import json
import logging
import re
from typing import Any, AsyncGenerator, Dict, List, Optional

from app.services.ai.openrouter_client import (
    OpenRouterClient,
    OpenRouterError,
    OpenRouterResponse,
)
from app.services.ai.prompts import (
    build_chat_response_prompt,
    build_clarification_prompt,
    build_content_quality_prompt,
    build_quote_generation_prompt,
    build_quote_generation_prompt_json,
    build_quote_refinement_prompt,
    build_requirement_analysis_prompt,
    build_vision_analysis_prompt,
    build_wordpress_stack_research_prompt,
    format_rag_context,
)
from app.services.ai.stack_enforcement import ensure_one_theme_in_text, normalize_stack_in_text
from app.services.ai.static_knowledge import (
    COMPANY_STACK_STRUCTURED,
    get_company_stack_structured,
)
from app.services.blocknote import outcomes_dict_to_blocknote_json

logger = logging.getLogger(__name__)

# Names we check for in quote content (company stack + common alternatives). Spec Step 6.
_STACK_CHECK_NAMES = set()
for category in ("plugins", "themes", "page_builders"):
    for item in COMPANY_STACK_STRUCTURED.get(category, []):
        name = item.get("name") or ""
        if name:
            _STACK_CHECK_NAMES.add(name)
# Common alternatives that would indicate quote drifted from company stack
_STACK_CHECK_NAMES.update([
    "Ninja Forms", "WPForms", "Formidable", "Divi Builder", "Bricks Builder",
    "Gutenberg", "Breakdance", "Oxygen", "WPBakery", "Themify",
])


def _resolved_stack_summary(wordpress_stack: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Build a minimal summary of resolved stack (names only) for persistence."""
    if not wordpress_stack:
        return None
    out: Dict[str, Any] = {"locked": {}, "recommended": {}}
    for key in ("locked", "recommended"):
        for cat in ("plugins", "themes", "page_builders"):
            items = (wordpress_stack.get(key) or {}).get(cat) or []
            names = []
            for item in items:
                n = (item.get("name") if isinstance(item, dict) else None) or str(item).strip()
                if n:
                    names.append(n)
            out[key][cat] = names
    return out


def _validate_quote_against_stack(
    content: str,
    wordpress_stack: Optional[Dict[str, Any]] = None,
) -> List[str]:
    """
    Best-effort check: quote content vs resolved stack (locked + company recommended).
    Returns list of warning strings when content mentions tools not in the resolved stack.
    """
    if not content:
        return []
    warnings: List[str] = []
    content_lower = content.lower()
    allowed: set = set()
    stack = wordpress_stack or {}
    for category in ("locked", "recommended"):
        for key in ("plugins", "themes", "page_builders"):
            for item in (stack.get(category) or {}).get(key) or []:
                name = (item.get("name") if isinstance(item, dict) else None) or str(item)
                if name:
                    allowed.add(name.lower().strip())
    for name in _STACK_CHECK_NAMES:
        if not name:
            continue
        name_lower = name.lower()
        if name_lower in allowed:
            continue
        if name_lower in content_lower or name in content:
            warnings.append(
                f"Quote mentions '{name}' which is not in the resolved company/client stack."
            )
    return warnings


def _detect_placeholders(text: str) -> List[str]:
    """
    Detect placeholder patterns in quote text (e.g. [X], [actual count], [TBD]).
    Returns list of warning strings for each placeholder found.
    """
    if not text or not text.strip():
        return []
    warnings: List[str] = []
    # Explicit patterns that indicate placeholders
    explicit = re.compile(
        r"\[(?:X|Y|Z|N|TBD|TODO|actual count|number|hours?|days?)\b[^\]]*\]",
        re.IGNORECASE,
    )
    for m in explicit.finditer(text):
        warnings.append(f"Placeholder detected in quote: '{m.group(0)}'")
    # Short bracketed placeholders like [actual count], [number], [N] (already in explicit)
    # Single-capital or generic [X]/[Y] style
    short_bracket = re.compile(r"\[\s*([A-Za-z]{1,2})\s*\]")
    for m in short_bracket.finditer(text):
        token = m.group(1).lower()
        if token in ("x", "y", "z", "n", "tbd"):
            warnings.append(f"Placeholder detected in quote: '{m.group(0)}'")
    return warnings[:10]  # Cap to avoid noise


def _check_calibration_band(
    total_hours: Optional[float],
    calibration_band: Optional[Dict[str, Any]],
) -> Optional[str]:
    """
    If total_hours is outside the calibration band (min*0.7, max*1.5), return a warning.
    Warn only; do not clamp. calibration_band is {"min_hours", "max_hours", "median_hours"}.
    """
    if total_hours is None or not calibration_band:
        return None
    min_h = calibration_band.get("min_hours")
    max_h = calibration_band.get("max_hours")
    if min_h is None or max_h is None:
        return None
    try:
        min_h, max_h = float(min_h), float(max_h)
    except (TypeError, ValueError):
        return None
    if total_hours < min_h * 0.7:
        return (
            f"Total hours ({total_hours:.0f}) is below typical range for similar projects "
            f"(min {min_h:.0f} hours). Verify estimate is justified by scope."
        )
    if total_hours > max_h * 1.5:
        return (
            f"Total hours ({total_hours:.0f}) is above typical range for similar projects "
            f"(max {max_h:.0f} hours). Verify estimate is justified by scope."
        )
    return None


# Brief keywords that imply scope the quote should mention (signal -> expected phrases in quote)
_SCOPE_SIGNALS: List[tuple] = [
    ("donation", ["donation", "donate", "give", "fundraising"]),
    ("lms", ["learndash", "lms", "course", "e-learning", "training"]),
    ("woocommerce", ["woocommerce", "e-commerce", "shop", "cart", "checkout", "product"]),
    ("multi-language", ["multilingual", "wpml", "polylang", "translation", "language"]),
    ("blog", ["blog", "posts", "news"]),
    ("membership", ["membership", "member", "restrict", "subscription"]),
    ("migration", ["migration", "migrate", "import", "content move"]),
    ("form", ["form", "gravity", "contact form", "submission"]),
]


def _check_scope_signals(brief: str, quote_content: str) -> List[str]:
    """
    If the brief strongly mentions a topic (e.g. donations, LMS), check the quote
    has at least one related phrase. Returns list of warning strings.
    """
    if not brief or not quote_content:
        return []
    brief_lower = brief.lower()
    content_lower = quote_content.lower()
    warnings: List[str] = []
    for keyword, expected_phrases in _SCOPE_SIGNALS:
        if keyword not in brief_lower:
            continue
        if any(phrase in content_lower for phrase in expected_phrases):
            continue
        warnings.append(
            f"Brief mentions '{keyword}'; verify quote covers it (e.g. {expected_phrases[0]})."
        )
    return warnings[:5]  # Cap to avoid noise


class QuoteGenerationResult:
    """
    Structured result from quote generation.

    Attributes:
        content: Full quote content as markdown/text.
        total_hours: Extracted total hours estimate.
        total_hours_min: Minimum hours in range (if range provided).
        total_hours_max: Maximum hours in range (if range provided).
        total_cost: Calculated cost (if hourly rate provided).
        breakdown: List of phase/task breakdowns with hours.
        assumptions: List of assumptions extracted from quote.
        exclusions: List of exclusions/out-of-scope items.
        model_used: The LLM model that generated the quote.
        tokens_used: Total tokens consumed.
        generation_cost: Cost of the LLM call.
    """

    def __init__(
        self,
        content: str,
        total_hours: Optional[float] = None,
        total_hours_min: Optional[float] = None,
        total_hours_max: Optional[float] = None,
        total_cost: Optional[float] = None,
        breakdown: Optional[List[Dict[str, Any]]] = None,
        assumptions: Optional[List[str]] = None,
        exclusions: Optional[List[str]] = None,
        model_used: str = "",
        tokens_used: int = 0,
        generation_cost: float = 0.0,
        validation_warnings: Optional[List[str]] = None,
        resolved_stack: Optional[Dict[str, Any]] = None,
    ):
        self.content = content
        self.total_hours = total_hours
        self.total_hours_min = total_hours_min
        self.total_hours_max = total_hours_max
        self.total_cost = total_cost
        self.breakdown = breakdown or []
        self.assumptions = assumptions or []
        self.exclusions = exclusions or []
        self.model_used = model_used
        self.tokens_used = tokens_used
        self.generation_cost = generation_cost
        self.validation_warnings = validation_warnings or []
        self.resolved_stack = resolved_stack

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "content": self.content,
            "total_hours": self.total_hours,
            "total_hours_min": self.total_hours_min,
            "total_hours_max": self.total_hours_max,
            "total_cost": self.total_cost,
            "breakdown": self.breakdown,
            "assumptions": self.assumptions,
            "exclusions": self.exclusions,
            "model_used": self.model_used,
            "tokens_used": self.tokens_used,
            "generation_cost": self.generation_cost,
            "validation_warnings": self.validation_warnings,
            "resolved_stack": self.resolved_stack,
        }


class LLMService:
    """
    High-level LLM service for quote generation.

    Handles prompt construction, response parsing, and provides
    a clean interface for quote generation workflows.

    Example:
        >>> service = LLMService()
        >>> result = await service.generate_quote(
        ...     requirements="Build a WordPress site with 10 pages",
        ...     platform="wordpress",
        ... )
        >>> print(result.total_hours)
    """

    def __init__(self, client: Optional[OpenRouterClient] = None):
        """
        Initialize the LLM service.

        Args:
            client: Optional OpenRouterClient instance.
                If not provided, creates a new client.
        """
        self._client: Optional[OpenRouterClient] = client
        self._initialized = False

    @property
    def client(self) -> OpenRouterClient:
        """
        Get or create the OpenRouter client.

        Lazy initialization to avoid issues during import.
        """
        if self._client is None:
            self._client = OpenRouterClient()
        return self._client

    async def generate_quote(
        self,
        requirements: str,
        platform: str,
        rag_context: Optional[str] = None,
        formatting_template: Optional[str] = None,
        project_context: Optional[Dict[str, Any]] = None,
        hourly_rate: Optional[float] = None,
        model: Optional[str] = None,
        temperature: float = 0.2,
        project_brief: Optional[str] = None,
        company_stack_context: Optional[str] = None,
        reference_estimates_context: Optional[str] = None,
        company_stack_fallback: bool = False,
        strict_stack: bool = False,
    ) -> QuoteGenerationResult:
        """
        Generate a quote from requirements.

        Args:
            requirements: Client requirements text.
            platform: Target platform (wordpress only).
            rag_context: Pre-built RAG context (legacy; prefer reference_estimates_context).
            formatting_template: Optional template for output format.
            project_context: Additional context (client name, industry, project_brief, etc.).
            hourly_rate: Hourly rate for cost calculation.
            model: LLM model to use. Defaults to 'generation'.
            temperature: Sampling temperature.
            project_brief: Single source of truth brief (name + description + instructions).
            company_stack_context: Company stack and estimation rules (MUST follow).
            reference_estimates_context: Similar quotes for structure/hours only.
            company_stack_fallback: True when company stack came from built-in fallback.
            strict_stack: If True, prompt adds critical line to use only listed tools (for retry after stack violation).

        Returns:
            QuoteGenerationResult with content and extracted data.

        Raises:
            OpenRouterError: If quote generation fails.
        """
        logger.info(
            "Generating quote: platform=%s, requirements_length=%d",
            platform,
            len(requirements),
        )

        # Optionally enrich WordPress projects with a researched stack (plugins/themes + URLs),
        # while strictly respecting any client-specified tools.
        enriched_project_context = dict(project_context or {})
        if platform.lower() == "wordpress":
            try:
                wordpress_stack = await self._build_wordpress_stack(
                    requirements=requirements,
                    project_context=enriched_project_context or None,
                )
                if wordpress_stack:
                    enriched_project_context["wordpress_stack"] = wordpress_stack
                    logger.info(
                        "WordPress stack research completed: locked_plugins=%d, recommended_plugins=%d",
                        len(wordpress_stack.get("locked", {}).get("plugins") or []),
                        len(wordpress_stack.get("recommended", {}).get("plugins") or []),
                    )
                else:
                    # Fallback: ensure prompt always gets a structured stack with URLs for Development Approach.
                    fallback_rec = get_company_stack_structured()
                    fallback_rec["themes"] = (fallback_rec.get("themes") or [])[:1]
                    enriched_project_context["wordpress_stack"] = {
                        "locked": {"plugins": [], "themes": [], "page_builders": []},
                        "recommended": fallback_rec,
                    }
                    logger.info("WordPress stack: using company fallback (no research result)")
            except Exception as e:  # pragma: no cover - best-effort enrichment
                logger.warning("WordPress stack research failed; continuing without it: %s", e)
                fallback_rec = get_company_stack_structured()
                fallback_rec["themes"] = (fallback_rec.get("themes") or [])[:1]
                enriched_project_context["wordpress_stack"] = {
                    "locked": {"plugins": [], "themes": [], "page_builders": []},
                    "recommended": fallback_rec,
                }

        # Build prompt (two-block RAG: company stack + reference estimates; single brief)
        messages = build_quote_generation_prompt_json(
            requirements=requirements,
            platform=platform,
            rag_context=rag_context,
            project_context=enriched_project_context,
            project_brief=project_brief or enriched_project_context.get("project_brief"),
            company_stack_context=company_stack_context,
            reference_estimates_context=reference_estimates_context,
            strict_stack=strict_stack,
        )

        # Call LLM with JSON response format
        try:
            response = await self.client.chat_completion(
                messages=messages,
                model=model or "generation",
                temperature=temperature,
                max_tokens=4096,
                response_format={"type": "json_object"},
            )
        except OpenRouterError as e:
            logger.error("Quote generation failed: %s", str(e))
            raise

        # Parse JSON response (estimation_outcomes + total_hours)
        try:
            parsed = json.loads(response.content)
        except (TypeError, ValueError) as e:
            logger.warning("Quote response was not valid JSON, falling back to text: %s", e)
            content = response.content
            # Post-generation stack normalization (same as JSON path)
            normalized_content, repl = normalize_stack_in_text(
                content, enriched_project_context.get("wordpress_stack")
            )
            if repl:
                content = normalized_content
                logger.info("Stack normalization (fallback): %s", repl)
            content = ensure_one_theme_in_text(
                content, enriched_project_context.get("wordpress_stack")
            )
            hours_data = self._extract_hours(content)
            assumptions = self._extract_section(content, "assumptions")
            exclusions = self._extract_section(content, ["exclusions", "out of scope"])
            breakdown = self._extract_breakdown(content)
            total_cost = None
            if hourly_rate and hours_data.get("total"):
                total_cost = hours_data["total"] * hourly_rate
            result = QuoteGenerationResult(
                content=content,
                total_hours=hours_data.get("total"),
                total_hours_min=hours_data.get("min"),
                total_hours_max=hours_data.get("max"),
                total_cost=total_cost,
                breakdown=breakdown,
                assumptions=assumptions,
                exclusions=exclusions,
                model_used=response.model,
                tokens_used=response.usage.total_tokens,
                generation_cost=response.usage.total_cost,
            )
            result.validation_warnings = _validate_quote_against_stack(
                content, enriched_project_context.get("wordpress_stack")
            )
            result.validation_warnings.extend(_detect_placeholders(content))
            cal_warn = _check_calibration_band(
                result.total_hours, enriched_project_context.get("calibration_band")
            )
            if cal_warn:
                result.validation_warnings.append(cal_warn)
            result.validation_warnings.extend(
                _check_scope_signals(
                    (enriched_project_context.get("project_brief") or "") or requirements,
                    content,
                )
            )
            result.resolved_stack = _resolved_stack_summary(enriched_project_context.get("wordpress_stack"))
            return result

        estimation_outcomes = parsed.get("estimation_outcomes") or {}
        if not isinstance(estimation_outcomes, dict):
            estimation_outcomes = {}
        # Ensure all values are strings
        estimation_outcomes = {k: (v if isinstance(v, str) else str(v)) for k, v in estimation_outcomes.items()}
        # Post-generation stack normalization (canonical names, disallowed->allowed, one-theme)
        wordpress_stack = enriched_project_context.get("wordpress_stack")
        for section in ("development_approach", "project_overview"):
            raw = estimation_outcomes.get(section) or ""
            if raw:
                normalized, repl = normalize_stack_in_text(raw, wordpress_stack)
                if repl:
                    estimation_outcomes[section] = normalized
                    logger.info("Stack normalization in %s: %s", section, repl)
                # One-theme post-check safety net
                estimation_outcomes[section] = ensure_one_theme_in_text(
                    estimation_outcomes[section], wordpress_stack
                )
        content = outcomes_dict_to_blocknote_json(estimation_outcomes)
        total_hours_val = parsed.get("total_hours")
        if total_hours_val is not None and isinstance(total_hours_val, (int, float)):
            total_hours_num = float(total_hours_val)
        else:
            # Fallback: try to extract from estimated_effort_timeline text
            timeline_text = estimation_outcomes.get("estimated_effort_timeline", "") or ""
            hours_data = self._extract_hours(timeline_text)
            total_hours_num = hours_data.get("total")
        assumptions = self._extract_section(
            estimation_outcomes.get("assumptions") or "", "assumptions"
        )
        exclusions = self._extract_section(
            estimation_outcomes.get("exclusions") or "",
            ["exclusions", "out of scope"],
        )
        breakdown = self._extract_breakdown(
            estimation_outcomes.get("estimated_effort_timeline") or ""
        )

        # VALIDATION: Check if project name appears in output (use flattened text)
        validation_text = "\n".join(estimation_outcomes.values())
        project_name = project_context.get("project_name") if project_context else None
        if project_name and project_name.lower() not in validation_text.lower():
            logger.warning(
                "VALIDATION_WARNING: Project name '%s' not found in generated quote. "
                "Content length: %d chars. This may indicate the model generated a generic estimate.",
                project_name,
                len(validation_text),
            )
        elif project_name:
            logger.info(
                "VALIDATION_PASS: Project name '%s' found in generated quote.",
                project_name,
            )

        # VALIDATION: Check requirements overlap
        if requirements and len(requirements) > 50:
            stopwords = {
                'the', 'and', 'for', 'with', 'this', 'that', 'from', 'will', 'are', 'has', 'have',
                'been', 'was', 'were', 'but', 'not', 'can', 'all', 'about', 'into', 'through',
                'our', 'your', 'their', 'which', 'when', 'where', 'who', 'what', 'how', 'should',
                'would', 'could', 'may', 'might', 'must', 'shall', 'need', 'want', 'like', 'also'
            }
            requirements_words = {
                word.lower() for word in requirements.split()
                if len(word) > 3 and word.lower() not in stopwords
            }
            content_words = {
                word.lower() for word in validation_text.split()
                if len(word) > 3 and word.lower() not in stopwords
            }
            if requirements_words:
                common_words = requirements_words & content_words
                overlap_ratio = len(common_words) / len(requirements_words)
                if overlap_ratio < 0.15:
                    logger.warning(
                        "VALIDATION_WARNING: Low overlap between requirements and output. "
                        "Overlap ratio: %.1f%%. This may indicate the model didn't address the requirements. "
                        "Common words: %d / %d",
                        overlap_ratio * 100,
                        len(common_words),
                        len(requirements_words),
                    )
                else:
                    logger.info(
                        "VALIDATION_PASS: Requirements overlap: %.1f%% (%d common words)",
                        overlap_ratio * 100,
                        len(common_words),
                    )

        total_cost = None
        if hourly_rate and total_hours_num:
            total_cost = total_hours_num * hourly_rate

        result = QuoteGenerationResult(
            content=content,
            total_hours=total_hours_num,
            total_hours_min=None,
            total_hours_max=None,
            total_cost=total_cost,
            breakdown=breakdown,
            assumptions=assumptions,
            exclusions=exclusions,
            model_used=response.model,
            tokens_used=response.usage.total_tokens,
            generation_cost=response.usage.total_cost,
        )
        result.validation_warnings = _validate_quote_against_stack(
            result.content, enriched_project_context.get("wordpress_stack")
        )
        result.validation_warnings.extend(_detect_placeholders(result.content))
        cal_warn = _check_calibration_band(
            result.total_hours, enriched_project_context.get("calibration_band")
        )
        if cal_warn:
            result.validation_warnings.append(cal_warn)
        result.validation_warnings.extend(
            _check_scope_signals(
                (enriched_project_context.get("project_brief") or "") or requirements,
                result.content,
            )
        )
        result.resolved_stack = _resolved_stack_summary(enriched_project_context.get("wordpress_stack"))

        logger.info(
            "Quote generated: hours=%s, model=%s, tokens=%d",
            result.total_hours,
            result.model_used,
            result.tokens_used,
        )

        return result

    async def generate_quote_stream(
        self,
        requirements: str,
        platform: str,
        rag_context: Optional[str] = None,
        formatting_template: Optional[str] = None,
        project_context: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream quote generation for real-time display.

        Args:
            requirements: Client requirements text.
            platform: Target platform.
            rag_context: Pre-built RAG context.
            formatting_template: Optional output template.
            project_context: Additional context.
            model: LLM model to use.

        Yields:
            Content chunks as they are generated.

        Example:
            >>> async for chunk in service.generate_quote_stream(
            ...     requirements="Build a website",
            ...     platform="wordpress",
            ... ):
            ...     print(chunk, end="", flush=True)
        """
        logger.info(
            "Starting quote stream: platform=%s",
            platform,
        )

        messages = build_quote_generation_prompt(
            requirements=requirements,
            platform=platform,
            rag_context=rag_context,
            formatting_template=formatting_template,
            project_context=project_context,
        )

        async for chunk in self.client.chat_completion_stream(
            messages=messages,
            model=model or "generation",
        ):
            yield chunk

    async def chat_response(
        self,
        messages: List[Dict[str, str]],
        project_context: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
    ) -> str:
        """
        Generate chat response for PM conversation.

        Args:
            messages: Conversation history.
            project_context: Optional project context.
            model: LLM model to use. Defaults to 'fast'.

        Returns:
            Assistant response text.

        Example:
            >>> response = await service.chat_response(
            ...     messages=[{"role": "user", "content": "How long for a WooCommerce setup?"}],
            ... )
        """
        logger.debug("Generating chat response: messages=%d", len(messages))

        prompt_messages = build_chat_response_prompt(
            messages=messages,
            project_context=project_context,
        )

        response = await self.client.chat_completion(
            messages=prompt_messages,
            model=model or "fast",
            temperature=0.7,
            max_tokens=2048,
        )

        return response.content

    async def chat_response_stream(
        self,
        messages: List[Dict[str, str]],
        project_context: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat response for real-time display.

        Args:
            messages: Conversation history.
            project_context: Optional project context.
            model: LLM model to use.

        Yields:
            Response chunks as they are generated.
        """
        prompt_messages = build_chat_response_prompt(
            messages=messages,
            project_context=project_context,
        )

        async for chunk in self.client.chat_completion_stream(
            messages=prompt_messages,
            model=model or "fast",
        ):
            yield chunk

    async def analyze_requirements(
        self,
        requirements: str,
        platform: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Analyze requirements and extract structured information.

        Args:
            requirements: Raw requirements text.
            platform: Optional target platform.

        Returns:
            Dictionary with analysis results.

        Example:
            >>> analysis = await service.analyze_requirements(
            ...     "Build a WordPress site with blog and shop",
            ...     platform="wordpress",
            ... )
            >>> print(analysis["complexity"])
        """
        logger.info("Analyzing requirements: length=%d", len(requirements))

        messages = build_requirement_analysis_prompt(
            requirements=requirements,
            platform=platform,
        )

        response = await self.client.chat_completion(
            messages=messages,
            model="fast",
            temperature=0.3,
            max_tokens=2048,
        )

        # Parse the response into structured data
        content = response.content

        return {
            "analysis": content,
            "complexity": self._extract_complexity(content),
            "estimated_hours_range": self._extract_hours(content),
            "model_used": response.model,
            "tokens_used": response.usage.total_tokens,
        }

    async def generate_clarification_questions(
        self,
        requirements: str,
        existing_questions: Optional[List[str]] = None,
    ) -> List[str]:
        """
        Generate clarification questions for incomplete requirements.

        Args:
            requirements: Current requirements text.
            existing_questions: Questions already asked.

        Returns:
            List of clarification questions.

        Example:
            >>> questions = await service.generate_clarification_questions(
            ...     "Build a website",
            ... )
            >>> for q in questions:
            ...     print(f"- {q}")
        """
        logger.debug("Generating clarification questions")

        messages = build_clarification_prompt(
            requirements=requirements,
            existing_questions=existing_questions,
        )

        response = await self.client.chat_completion(
            messages=messages,
            model="fast",
            temperature=0.5,
            max_tokens=1024,
        )

        # Extract questions from response
        questions = self._extract_questions(response.content)

        logger.debug("Generated %d clarification questions", len(questions))
        return questions

    async def check_content_quality(
        self,
        project_name: str,
        description: str,
        additional_instructions: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Check if project name, description, and optional additional instructions
        are sufficient for accurate estimation (detect gibberish, too short, vague).

        Args:
            project_name: Project name.
            description: Project description (used as requirements for quote).
            additional_instructions: Optional extra instructions.

        Returns:
            Dict with: overall_sufficient (bool), score (int 0-100), feedback (dict
            with project_name, description, additional_instructions as list[str]),
            suggested_improvements (str).
        """
        logger.debug("Checking content quality: name_len=%d, desc_len=%d", len(project_name or ""), len(description or ""))

        messages = build_content_quality_prompt(
            project_name=project_name or "",
            description=description or "",
            additional_instructions=additional_instructions or None,
        )

        response = await self.client.chat_completion(
            messages=messages,
            model="fast",
            temperature=0.2,
            max_tokens=1024,
            response_format={"type": "json_object"},
        )

        try:
            parsed = json.loads(response.content)
        except (TypeError, ValueError) as e:
            logger.warning("Content quality response was not valid JSON: %s", e)
            return {
                "overall_sufficient": len((description or "").strip()) >= 50,
                "score": 50,
                "feedback": {
                    "project_name": [],
                    "description": ["Unable to verify content quality. Please add a clear description."],
                    "additional_instructions": [],
                },
                "suggested_improvements": "Add a few sentences describing your project goals, pages, or features.",
            }

        overall_sufficient = bool(parsed.get("overall_sufficient", False))
        score = int(parsed.get("score", 0))
        if not (0 <= score <= 100):
            score = max(0, min(100, score))
        feedback = parsed.get("feedback") or {}
        if not isinstance(feedback, dict):
            feedback = {}
        for key in ("project_name", "description", "additional_instructions"):
            if key not in feedback:
                feedback[key] = []
            elif not isinstance(feedback[key], list):
                feedback[key] = [str(feedback[key])] if feedback[key] else []
            else:
                feedback[key] = [str(x) for x in feedback[key]]
        suggested_improvements = str(parsed.get("suggested_improvements") or "").strip()

        return {
            "overall_sufficient": overall_sufficient,
            "score": score,
            "feedback": feedback,
            "suggested_improvements": suggested_improvements,
        }

    async def refine_quote(
        self,
        original_quote: str,
        feedback: str,
        requirements: str,
    ) -> QuoteGenerationResult:
        """
        Refine an existing quote based on feedback.

        Args:
            original_quote: The original quote text.
            feedback: PM or client feedback.
            requirements: Original requirements for context.

        Returns:
            Updated QuoteGenerationResult.

        Example:
            >>> refined = await service.refine_quote(
            ...     original_quote="...",
            ...     feedback="Please add more detail for the WooCommerce section",
            ...     requirements="...",
            ... )
        """
        logger.info("Refining quote based on feedback")

        messages = build_quote_refinement_prompt(
            original_quote=original_quote,
            feedback=feedback,
            requirements=requirements,
        )

        response = await self.client.chat_completion(
            messages=messages,
            model="generation",
            temperature=0.2,
            max_tokens=4096,
        )

        content = response.content
        hours_data = self._extract_hours(content)
        assumptions = self._extract_section(content, "assumptions")
        exclusions = self._extract_section(content, ["exclusions", "out of scope"])

        return QuoteGenerationResult(
            content=content,
            total_hours=hours_data.get("total"),
            total_hours_min=hours_data.get("min"),
            total_hours_max=hours_data.get("max"),
            assumptions=assumptions,
            exclusions=exclusions,
            model_used=response.model,
            tokens_used=response.usage.total_tokens,
            generation_cost=response.usage.total_cost,
        )

    async def analyze_image(
        self,
        image_base64: str,
        context: str,
        analysis_type: str = "ui_mockup",
    ) -> Dict[str, Any]:
        """
        Analyze an image (UI mockup, design file, screenshot).

        Args:
            image_base64: Base64 encoded image data.
            context: Description of what to analyze.
            analysis_type: Type of analysis (ui_mockup, design_file, screenshot).

        Returns:
            Dictionary with analysis results.

        Example:
            >>> analysis = await service.analyze_image(
            ...     image_base64="...",
            ...     context="Homepage design mockup",
            ...     analysis_type="ui_mockup",
            ... )
        """
        logger.info("Analyzing image: type=%s", analysis_type)

        prompt = build_vision_analysis_prompt(
            context=context,
            analysis_type=analysis_type,
        )

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                    },
                ],
            }
        ]

        response = await self.client.chat_completion(
            messages=messages,
            model="vision",
            temperature=0.3,
            max_tokens=2048,
        )

        return {
            "analysis": response.content,
            "model_used": response.model,
            "tokens_used": response.usage.total_tokens,
        }

    async def describe_document_image(
        self,
        image_base64: str,
        *,
        is_standalone_image: bool = False,
    ) -> str:
        """
        Extract text and describe figures from a document page or standalone image.
        Used for requirement documents (PDF pages with images, uploaded PNG/JPG).

        Args:
            image_base64: Base64-encoded image data (no data URL prefix).
            is_standalone_image: If True, use document_image prompt; else document_page.

        Returns:
            Extracted text and descriptions for use in project brief.
        """
        analysis_type = "document_image" if is_standalone_image else "document_page"
        prompt = build_vision_analysis_prompt(context="", analysis_type=analysis_type)
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                    },
                ],
            }
        ]
        response = await self.client.chat_completion(
            messages=messages,
            model="document_vision",
            temperature=0.2,
            max_tokens=4096,
        )
        return (response.content or "").strip()

    async def research_topic(
        self,
        query: str,
        context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Research a topic using web-enabled model.

        Args:
            query: Research query.
            context: Additional context.

        Returns:
            Dictionary with research results.

        Example:
            >>> research = await service.research_topic(
            ...     "Latest WooCommerce best practices 2024",
            ...     context="E-commerce project",
            ... )
        """
        logger.info("Researching topic: %s", query[:50])

        system_content = """You are a research assistant helping with web development project research.
Provide accurate, up-to-date information with sources when possible.
Focus on practical, actionable information relevant to project estimation."""

        messages = [
            {"role": "system", "content": system_content},
            {
                "role": "user",
                "content": f"Research the following topic:\n\n{query}"
                + (f"\n\nContext: {context}" if context else ""),
            },
        ]

        response = await self.client.chat_completion(
            messages=messages,
            model="research",
            temperature=0.3,
            max_tokens=2048,
        )

        return {
            "research": response.content,
            "model_used": response.model,
            "tokens_used": response.usage.total_tokens,
        }

    async def _build_wordpress_stack(
        self,
        requirements: str,
        project_context: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Build a WordPress plugins/themes/page builders stack using the web-enabled
        research model.

        Behavior:
        - Detects client-specified tools (plugins/themes/page builders) from requirements
          and project_context and treats them as locked-in.
        - Fetches official URLs for those tools.
        - Recommends additional tools ONLY where requirements imply missing capabilities.

        Returns:
            Dict with "locked" and "recommended" keys, or None on failure.
        """
        logger.info("Building WordPress stack via research model")

        messages = build_wordpress_stack_research_prompt(
            requirements=requirements,
            project_context=project_context,
        )

        try:
            response = await self.client.chat_completion(
                messages=messages,
                model="research",
                temperature=0.1,
                max_tokens=1500,
            )
        except OpenRouterError as e:
            logger.warning("WordPress stack research call failed: %s", e)
            return None

        raw = response.content or ""
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError) as e:
            logger.warning("WordPress stack research did not return valid JSON: %s", e)
            return None

        if not isinstance(parsed, dict):
            logger.warning("WordPress stack research returned non-object JSON; ignoring")
            return None

        # Locked = client-specified tools from research (with URLs from web). Spec Step 4.
        # Recommended = always from company stack (Phase 3.3: research may omit "recommended";
        # we never read parsed.get("recommended")—backend fills it).
        def _ensure_list(obj: Any) -> list:
            return obj if isinstance(obj, list) else []

        locked = parsed.get("locked") or {}
        locked["plugins"] = _ensure_list(locked.get("plugins"))
        locked["themes"] = _ensure_list(locked.get("themes"))
        locked["page_builders"] = _ensure_list(locked.get("page_builders"))

        recommended = get_company_stack_structured()
        # One-theme rule: prompt must show at most one theme (locked or single recommended).
        if locked["themes"]:
            recommended["themes"] = []
        else:
            recommended["themes"] = (recommended.get("themes") or [])[:1]
        stack = {
            "locked": locked,
            "recommended": recommended,
        }
        return stack

    # ==================== Private Helper Methods ====================

    def _extract_hours(self, content: str) -> Dict[str, Optional[float]]:
        """
        Extract hours estimate from quote content.

        Prefers the "Estimated Total Effort" / Section 7 total when present,
        so phase breakdowns (e.g. "Design: 20-30 hours") do not override the
        true total (e.g. "15-18 hours") in limited-scope quotes.

        Handles various formats:
        - "40 hours"
        - "40-60 hours"
        - "40 to 60 hours"
        - "Estimated: 40h"

        Returns:
            Dictionary with 'total', 'min', and 'max' values.
        """
        result: Dict[str, Optional[float]] = {"total": None, "min": None, "max": None}
        content_lower = content.lower()
        range_re = re.compile(r"(\d+(?:\.\d+)?)\s*[-to]+\s*(\d+(?:\.\d+)?)\s*hours?")

        # Prefer hours in "Estimated Total Effort" or "7. Estimated" section (authoritative total)
        for anchor in ("estimated total effort", "7. estimated"):
            idx = content_lower.find(anchor)
            if idx >= 0:
                block = content[idx : idx + 400]
                match = range_re.search(block)
                if match:
                    result["min"] = float(match.group(1))
                    result["max"] = float(match.group(2))
                    result["total"] = (result["min"] + result["max"]) / 2
                    return result
                # Single value in same section
                single = re.search(
                    r"(?:total|estimated).*?(\d+(?:\.\d+)?)\s*hours?",
                    block,
                    re.IGNORECASE,
                )
                if single:
                    val = float(single.group(1))
                    result["total"] = val
                    return result

        # Look for hour ranges anywhere (e.g., "40-60 hours", "40 to 60 hours")
        range_patterns = [
            r"(\d+(?:\.\d+)?)\s*[-to]+\s*(\d+(?:\.\d+)?)\s*hours?",
            r"estimated.*?(\d+(?:\.\d+)?)\s*[-to]+\s*(\d+(?:\.\d+)?)\s*hours?",
            r"total.*?(\d+(?:\.\d+)?)\s*[-to]+\s*(\d+(?:\.\d+)?)\s*hours?",
        ]

        for pattern in range_patterns:
            match = re.search(pattern, content_lower)
            if match:
                result["min"] = float(match.group(1))
                result["max"] = float(match.group(2))
                result["total"] = (result["min"] + result["max"]) / 2
                return result

        # Look for single hour values
        single_patterns = [
            r"total.*?(\d+(?:\.\d+)?)\s*hours?",
            r"estimated.*?(\d+(?:\.\d+)?)\s*hours?",
            r"(\d+(?:\.\d+)?)\s*hours?\s*(?:total|estimated)",
        ]

        for pattern in single_patterns:
            match = re.search(pattern, content_lower)
            if match:
                result["total"] = float(match.group(1))
                return result

        return result

    def _extract_section(
        self,
        content: str,
        section_names: str | List[str],
    ) -> List[str]:
        """
        Extract bullet points from a named section.

        Args:
            content: Full quote content.
            section_names: Section name(s) to look for.

        Returns:
            List of items from the section.
        """
        if isinstance(section_names, str):
            section_names = [section_names]

        items: List[str] = []

        for section_name in section_names:
            # Find section header
            pattern = rf"(?:#+\s*)?{section_name}[:\s]*\n(.*?)(?=\n#+|\n\n\n|$)"
            match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)

            if match:
                section_content = match.group(1)

                # Extract bullet points
                bullet_pattern = r"[-*]\s*(.+?)(?=\n[-*]|\n\n|$)"
                bullets = re.findall(bullet_pattern, section_content, re.DOTALL)

                items.extend([b.strip() for b in bullets if b.strip()])

        return items

    def _extract_breakdown(self, content: str) -> List[Dict[str, Any]]:
        """
        Extract hours breakdown by phase/area.

        Returns:
            List of dictionaries with 'phase', 'hours_min', 'hours_max'.
        """
        breakdown: List[Dict[str, Any]] = []

        # Look for patterns like "Design: 20-30 hours" or "- Development: 40 hours"
        pattern = r"[-*]?\s*([^:\n]+):\s*(\d+(?:\.\d+)?)\s*(?:[-to]+\s*(\d+(?:\.\d+)?))?\s*hours?"

        matches = re.findall(pattern, content, re.IGNORECASE)

        for match in matches:
            phase = match[0].strip()
            hours_min = float(match[1])
            hours_max = float(match[2]) if match[2] else hours_min

            # Skip if this looks like a total
            if "total" in phase.lower() or "estimated" in phase.lower():
                continue

            breakdown.append({
                "phase": phase,
                "hours_min": hours_min,
                "hours_max": hours_max,
            })

        return breakdown

    def _extract_complexity(self, content: str) -> Optional[str]:
        """
        Extract complexity assessment from analysis.

        Returns:
            Complexity level (simple, medium, complex) or None.
        """
        pattern = r"complexity[:\s]*(simple|medium|complex)"
        match = re.search(pattern, content.lower())

        if match:
            return match.group(1)

        return None

    def _extract_questions(self, content: str) -> List[str]:
        """
        Extract questions from generated content.

        Returns:
            List of question strings.
        """
        questions: List[str] = []

        # Look for numbered questions
        numbered_pattern = r"\d+\.\s*(.+?)(?=\n\d+\.|\n\n|$)"
        numbered_matches = re.findall(numbered_pattern, content, re.DOTALL)

        for match in numbered_matches:
            # Clean up and extract just the question part
            question = match.strip()

            # Remove the "why this matters" part if present
            if " - " in question:
                question = question.split(" - ")[0].strip()

            if question and "?" in question:
                questions.append(question)

        # If no numbered questions found, look for bullet points
        if not questions:
            bullet_pattern = r"[-*]\s*(.+?\?)"
            bullet_matches = re.findall(bullet_pattern, content)
            questions = [q.strip() for q in bullet_matches]

        return questions[:10]  # Limit to 10 questions


# Singleton instance for convenience
_llm_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    """
    Get the singleton LLM service instance.

    Returns:
        LLMService instance.
    """
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
