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
    build_quote_generation_prompt,
    build_quote_refinement_prompt,
    build_requirement_analysis_prompt,
    build_vision_analysis_prompt,
    format_rag_context,
)

logger = logging.getLogger(__name__)


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
        temperature: float = 0.3,
    ) -> QuoteGenerationResult:
        """
        Generate a quote from requirements.

        Args:
            requirements: Client requirements text.
            platform: Target platform (wordpress only).
            rag_context: Pre-built RAG context from similar quotes.
            formatting_template: Optional template for output format.
            project_context: Additional context (client name, industry, etc.).
            hourly_rate: Hourly rate for cost calculation.
            model: LLM model to use. Defaults to 'generation'.
            temperature: Sampling temperature.

        Returns:
            QuoteGenerationResult with content and extracted data.

        Raises:
            OpenRouterError: If quote generation fails.

        Example:
            >>> result = await service.generate_quote(
            ...     requirements="WordPress site with WooCommerce",
            ...     platform="wordpress",
            ...     hourly_rate=100.0,
            ... )
            >>> print(f"Hours: {result.total_hours}")
            >>> print(f"Cost: ${result.total_cost}")
        """
        logger.info(
            "Generating quote: platform=%s, requirements_length=%d",
            platform,
            len(requirements),
        )

        # Build prompt
        messages = build_quote_generation_prompt(
            requirements=requirements,
            platform=platform,
            rag_context=rag_context,
            formatting_template=formatting_template,
            project_context=project_context,
        )

        # Call LLM
        try:
            response = await self.client.chat_completion(
                messages=messages,
                model=model or "generation",
                temperature=temperature,
                max_tokens=4096,
            )
        except OpenRouterError as e:
            logger.error("Quote generation failed: %s", str(e))
            raise

        # Parse response
        content = response.content
        hours_data = self._extract_hours(content)
        assumptions = self._extract_section(content, "assumptions")
        exclusions = self._extract_section(content, ["exclusions", "out of scope"])
        breakdown = self._extract_breakdown(content)

        # Calculate cost if hourly rate provided
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
            temperature=0.3,
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

    # ==================== Private Helper Methods ====================

    def _extract_hours(self, content: str) -> Dict[str, Optional[float]]:
        """
        Extract hours estimate from quote content.

        Handles various formats:
        - "40 hours"
        - "40-60 hours"
        - "40 to 60 hours"
        - "Estimated: 40h"

        Returns:
            Dictionary with 'total', 'min', and 'max' values.
        """
        result: Dict[str, Optional[float]] = {"total": None, "min": None, "max": None}

        # Look for hour ranges (e.g., "40-60 hours", "40 to 60 hours")
        range_patterns = [
            r"(\d+(?:\.\d+)?)\s*[-to]+\s*(\d+(?:\.\d+)?)\s*hours?",
            r"estimated.*?(\d+(?:\.\d+)?)\s*[-to]+\s*(\d+(?:\.\d+)?)\s*hours?",
            r"total.*?(\d+(?:\.\d+)?)\s*[-to]+\s*(\d+(?:\.\d+)?)\s*hours?",
        ]

        for pattern in range_patterns:
            match = re.search(pattern, content.lower())
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
            match = re.search(pattern, content.lower())
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
