"""
OpenRouter API Client.

Provides unified access to multiple LLM providers (OpenAI, Anthropic, Google, Perplexity)
through the OpenRouter API gateway with automatic fallback and error handling.
"""

import asyncio
import json
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)


class OpenRouterUsage(BaseModel):
    """Token usage tracking for LLM requests."""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    total_cost: float = 0.0


class OpenRouterResponse(BaseModel):
    """Standardized response from OpenRouter API."""

    content: str
    model: str
    finish_reason: str
    usage: OpenRouterUsage


class OpenRouterError(Exception):
    """Base exception for OpenRouter client errors."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        model: Optional[str] = None,
        retry_after: Optional[int] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.model = model
        self.retry_after = retry_after


class RateLimitError(OpenRouterError):
    """Raised when API rate limit is exceeded."""
    pass


class ModelUnavailableError(OpenRouterError):
    """Raised when the requested model is unavailable."""
    pass


class AuthenticationError(OpenRouterError):
    """Raised when API authentication fails."""
    pass


class ContentFilterError(OpenRouterError):
    """Raised when content is filtered by the model."""
    pass


class OpenRouterClient:
    """
    Unified client for OpenRouter API.

    Handles all LLM calls with automatic fallback, retry logic,
    and comprehensive error handling.

    Attributes:
        BASE_URL: OpenRouter API base URL
        MODELS: Available model configurations with OpenRouter model IDs
    """

    BASE_URL = "https://openrouter.ai/api/v1"

    # Model configurations with OpenRouter identifiers (UAT)
    MODELS: Dict[str, str] = {
        # Primary quote generation, refinement (new + regenerate, feedback, conversational)
        "generation": "deepseek/deepseek-chat",
        # Fallback when generation fails
        "generation_fallback": "openai/gpt-4o-mini",
        # Second fallback for generation/refinement
        "generation_fallback_2": "openai/gpt-4o",
        # Research with web search
        "research": "perplexity/llama-3.1-sonar-large-128k-online",
        # Image / UI analysis
        "vision": "openai/gpt-4o",
        # Document parsing (PDF pages, images): vision model for text/figures extraction
        "document_vision": "google/gemini-2.5-flash",
        # Chat, clarification questions, requirements analysis
        "fast": "google/gemini-2.5-flash-lite",
        # RAG embeddings
        "embedding": "openai/text-embedding-3-small",
        # Last-resort fallback
        "claude": "anthropic/claude-3-5-sonnet",
    }

    # Fallback chain for automatic model switching
    FALLBACK_CHAINS: Dict[str, List[str]] = {
        "generation": ["generation_fallback", "generation_fallback_2", "claude"],
        "generation_fallback": ["generation_fallback_2", "claude", "generation"],
        "generation_fallback_2": ["generation_fallback", "claude"],
        "research": ["generation_fallback", "generation_fallback_2"],
        "vision": ["claude"],
        "document_vision": ["vision", "claude"],
        "fast": ["generation_fallback", "generation"],
    }

    def __init__(
        self,
        api_key: Optional[str] = None,
        app_name: Optional[str] = None,
        http_referer: Optional[str] = None,
        timeout: Optional[int] = None,
    ):
        """
        Initialize the OpenRouter client.

        Args:
            api_key: OpenRouter API key. Defaults to settings.OPENROUTER_API_KEY.
            app_name: Application name for tracking. Defaults to settings.OPENROUTER_APP_NAME.
            http_referer: HTTP referer for requests. Defaults to settings.OPENROUTER_HTTP_REFERER.
            timeout: Request timeout in seconds. Defaults to settings.LLM_REQUEST_TIMEOUT.

        Raises:
            ValueError: If API key is not configured.
        """
        self.api_key = api_key or settings.OPENROUTER_API_KEY
        self.app_name = app_name or settings.OPENROUTER_APP_NAME
        self.http_referer = http_referer or settings.OPENROUTER_HTTP_REFERER
        self.timeout = timeout or settings.LLM_REQUEST_TIMEOUT

        if not self.api_key:
            raise ValueError(
                "OPENROUTER_API_KEY not configured. "
                "Please set the OPENROUTER_API_KEY environment variable."
            )

    def _get_headers(self) -> Dict[str, str]:
        """
        Get HTTP headers for OpenRouter API requests.

        Returns:
            Dict of HTTP headers including authentication and metadata.
        """
        return {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": self.http_referer,
            "X-Title": self.app_name,
            "Content-Type": "application/json",
        }

    def _resolve_model(self, model: Optional[str]) -> str:
        """
        Resolve model alias to OpenRouter model ID.

        Args:
            model: Model alias (e.g., 'generation') or full OpenRouter ID.

        Returns:
            Full OpenRouter model ID.
        """
        if model is None:
            return self.MODELS["generation"]

        # Check if it's an alias
        if model in self.MODELS:
            return self.MODELS[model]

        # Assume it's already a full model ID
        return model

    def _get_fallback_models(self, model: str) -> List[str]:
        """
        Get fallback model chain for a given model.

        Args:
            model: Primary model alias or ID.

        Returns:
            List of fallback model IDs.
        """
        # Find the alias for this model
        model_alias = None
        for alias, model_id in self.MODELS.items():
            if model_id == model or alias == model:
                model_alias = alias
                break

        if model_alias and model_alias in self.FALLBACK_CHAINS:
            return [self.MODELS[m] for m in self.FALLBACK_CHAINS[model_alias]]

        # Default fallback
        return [self.MODELS["generation_fallback"]]

    async def _handle_error_response(
        self,
        response: httpx.Response,
        model: str,
    ) -> None:
        """
        Handle error responses from the API.

        Args:
            response: HTTP response object.
            model: Model that was used for the request.

        Raises:
            AuthenticationError: For 401 responses.
            RateLimitError: For 429 responses.
            ModelUnavailableError: For 503 responses.
            OpenRouterError: For other error responses.
        """
        status_code = response.status_code

        try:
            error_data = response.json()
            error_message = error_data.get("error", {}).get("message", response.text)
        except (json.JSONDecodeError, KeyError):
            error_message = response.text

        if status_code == 401:
            raise AuthenticationError(
                f"Authentication failed: {error_message}",
                status_code=status_code,
                model=model,
            )

        if status_code == 429:
            retry_after = response.headers.get("Retry-After")
            raise RateLimitError(
                f"Rate limit exceeded for model {model}: {error_message}",
                status_code=status_code,
                model=model,
                retry_after=int(retry_after) if retry_after else None,
            )

        if status_code in (503, 502, 504):
            raise ModelUnavailableError(
                f"Model {model} is unavailable: {error_message}",
                status_code=status_code,
                model=model,
            )

        raise OpenRouterError(
            f"API error ({status_code}): {error_message}",
            status_code=status_code,
            model=model,
        )

    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stream: bool = False,
        fallback_models: Optional[List[str]] = None,
        max_retries: int = 3,
        **kwargs: Any,
    ) -> OpenRouterResponse:
        """
        Send chat completion request to OpenRouter.

        Implements automatic retry with exponential backoff and
        model fallback on failure.

        Args:
            messages: List of chat messages in OpenAI format.
                Example: [{"role": "user", "content": "Hello"}]
            model: Model alias or full OpenRouter model ID.
                Defaults to 'generation' (Gemini 2.0 Flash Thinking).
            temperature: Sampling temperature (0.0 to 2.0).
                Defaults to settings.LLM_DEFAULT_TEMPERATURE.
            max_tokens: Maximum tokens to generate.
                Defaults to settings.LLM_DEFAULT_MAX_TOKENS.
            stream: If True, use streaming endpoint (not implemented here).
                Use chat_completion_stream() for streaming.
            fallback_models: Optional list of fallback model IDs.
                If not provided, uses default fallback chain.
            max_retries: Maximum retry attempts per model.
            **kwargs: Additional parameters passed to the API.

        Returns:
            OpenRouterResponse with content, model used, and usage stats.

        Raises:
            AuthenticationError: If API key is invalid.
            OpenRouterError: If all models and retries fail.

        Example:
            >>> client = OpenRouterClient()
            >>> response = await client.chat_completion(
            ...     messages=[{"role": "user", "content": "Generate a quote"}],
            ...     model="generation",
            ...     temperature=0.3,
            ... )
            >>> print(response.content)
        """
        resolved_model = self._resolve_model(model)
        temperature = temperature if temperature is not None else settings.LLM_DEFAULT_TEMPERATURE
        max_tokens = max_tokens if max_tokens is not None else settings.LLM_DEFAULT_MAX_TOKENS

        # Build model chain: primary + fallbacks
        if fallback_models is None:
            fallback_models = self._get_fallback_models(resolved_model)

        models_to_try = [resolved_model] + [
            self._resolve_model(m) for m in fallback_models
        ]

        last_error: Optional[Exception] = None

        for attempt_model in models_to_try:
            for retry in range(max_retries):
                try:
                    payload = {
                        "model": attempt_model,
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                        **kwargs,
                    }

                    logger.info(
                        "OpenRouter request: model=%s, retry=%d/%d, max_tokens=%d, temp=%.2f",
                        attempt_model,
                        retry + 1,
                        max_retries,
                        max_tokens,
                        temperature,
                    )

                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await client.post(
                            f"{self.BASE_URL}/chat/completions",
                            headers=self._get_headers(),
                            json=payload,
                        )

                    if response.status_code != 200:
                        logger.error(
                            "OpenRouter API error: status=%d, model=%s, response=%s",
                            response.status_code,
                            attempt_model,
                            response.text[:500] if response.text else "No response body",
                        )
                        await self._handle_error_response(response, attempt_model)

                    data = response.json()

                    # Validate response structure
                    if "choices" not in data or not data["choices"]:
                        logger.error("Invalid OpenRouter response: missing 'choices' field. Response: %s", str(data)[:500])
                        raise OpenRouterError(
                            f"Invalid response from model {attempt_model}: missing choices",
                            model=attempt_model,
                        )

                    # Parse response
                    choice = data["choices"][0]
                    if "message" not in choice or "content" not in choice["message"]:
                        logger.error("Invalid choice structure: %s", str(choice))
                        raise OpenRouterError(
                            f"Invalid response from model {attempt_model}: missing message content",
                            model=attempt_model,
                        )

                    content = choice["message"]["content"]
                    if not content or not isinstance(content, str):
                        logger.error("Empty or invalid content from model %s: %s", attempt_model, content)
                        raise OpenRouterError(
                            f"Model {attempt_model} returned empty or invalid content",
                            model=attempt_model,
                        )

                    usage_data = data.get("usage", {})

                    # Check for content filter
                    if choice.get("finish_reason") == "content_filter":
                        raise ContentFilterError(
                            "Response was filtered due to content policy",
                            model=attempt_model,
                        )

                    result = OpenRouterResponse(
                        content=content,
                        model=data.get("model", attempt_model),
                        finish_reason=choice.get("finish_reason", "stop"),
                        usage=OpenRouterUsage(
                            prompt_tokens=usage_data.get("prompt_tokens", 0),
                            completion_tokens=usage_data.get("completion_tokens", 0),
                            total_tokens=usage_data.get("total_tokens", 0),
                            total_cost=usage_data.get("total_cost", 0.0),
                        ),
                    )

                    logger.info(
                        "OpenRouter success: model=%s, tokens=%d, cost=$%.6f",
                        result.model,
                        result.usage.total_tokens,
                        result.usage.total_cost,
                    )

                    return result

                except AuthenticationError:
                    # Don't retry auth errors
                    raise

                except RateLimitError as e:
                    logger.warning(
                        "Rate limit on %s, switching to fallback",
                        attempt_model,
                    )
                    last_error = e
                    break  # Try next model

                except ModelUnavailableError as e:
                    logger.warning(
                        "Model %s unavailable, switching to fallback",
                        attempt_model,
                    )
                    last_error = e
                    break  # Try next model

                except ContentFilterError as e:
                    logger.warning(
                        "Content filtered on %s, trying different model",
                        attempt_model,
                    )
                    last_error = e
                    break  # Try next model

                except httpx.TimeoutException as e:
                    logger.warning(
                        "Timeout on %s (retry %d/%d)",
                        attempt_model,
                        retry + 1,
                        max_retries,
                    )
                    last_error = e
                    # Exponential backoff
                    await asyncio.sleep(2 ** retry)
                    continue

                except (httpx.HTTPError, OpenRouterError) as e:
                    logger.warning(
                        "Error on %s (retry %d/%d): %s",
                        attempt_model,
                        retry + 1,
                        max_retries,
                        str(e),
                    )
                    last_error = e
                    await asyncio.sleep(2 ** retry)
                    continue

        # All models failed
        error_msg = f"All models failed after retries. Last error: {last_error}"
        logger.error(error_msg)
        raise OpenRouterError(error_msg)

    async def chat_completion_stream(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat completion for real-time responses.

        Yields content chunks as they arrive from the API,
        enabling real-time display of generated text.

        Args:
            messages: List of chat messages in OpenAI format.
            model: Model alias or full OpenRouter model ID.
            temperature: Sampling temperature (0.0 to 2.0).
            max_tokens: Maximum tokens to generate.
            **kwargs: Additional parameters passed to the API.

        Yields:
            Content chunks as strings.

        Raises:
            OpenRouterError: If the streaming request fails.

        Example:
            >>> client = OpenRouterClient()
            >>> async for chunk in client.chat_completion_stream(
            ...     messages=[{"role": "user", "content": "Tell me a story"}],
            ... ):
            ...     print(chunk, end="", flush=True)
        """
        resolved_model = self._resolve_model(model)
        temperature = temperature if temperature is not None else settings.LLM_DEFAULT_TEMPERATURE
        max_tokens = max_tokens if max_tokens is not None else settings.LLM_DEFAULT_MAX_TOKENS

        payload = {
            "model": resolved_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
            **kwargs,
        }

        logger.debug(
            "OpenRouter stream request: model=%s, tokens=%d",
            resolved_model,
            max_tokens,
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.BASE_URL}/chat/completions",
                    headers=self._get_headers(),
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        # Read full response for error details
                        await response.aread()
                        await self._handle_error_response(response, resolved_model)

                    async for line in response.aiter_lines():
                        if not line:
                            continue

                        if line.startswith("data: "):
                            data_str = line[6:]

                            if data_str == "[DONE]":
                                logger.debug("Stream completed for model %s", resolved_model)
                                break

                            try:
                                data = json.loads(data_str)
                                choices = data.get("choices", [])

                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content = delta.get("content")

                                    if content:
                                        yield content
                            except json.JSONDecodeError:
                                logger.debug("Skipping invalid JSON chunk: %s", data_str[:100])
                                continue

        except httpx.HTTPError as e:
            logger.error("Stream error: %s", str(e))
            raise OpenRouterError(f"Streaming failed: {str(e)}")

    async def generate_embedding(
        self,
        text: str,
        model: Optional[str] = None,
    ) -> List[float]:
        """
        Generate embedding vector for text.

        Args:
            text: Text to generate embedding for.
            model: Embedding model to use. Defaults to 'embedding'
                (OpenAI text-embedding-3-small).

        Returns:
            List of floats representing the embedding vector.

        Raises:
            OpenRouterError: If embedding generation fails.

        Example:
            >>> client = OpenRouterClient()
            >>> embedding = await client.generate_embedding("Hello world")
            >>> print(len(embedding))  # 1536 dimensions
        """
        resolved_model = model or self.MODELS["embedding"]

        payload = {
            "model": resolved_model,
            "input": text,
        }

        logger.debug(
            "Generating embedding: model=%s, text_length=%d",
            resolved_model,
            len(text),
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.BASE_URL}/embeddings",
                    headers=self._get_headers(),
                    json=payload,
                )

            if response.status_code != 200:
                await self._handle_error_response(response, resolved_model)

            data = response.json()
            embedding = data["data"][0]["embedding"]

            logger.debug(
                "Embedding generated: dimensions=%d",
                len(embedding),
            )

            return embedding

        except httpx.HTTPError as e:
            logger.error("Embedding error: %s", str(e))
            raise OpenRouterError(f"Embedding generation failed: {str(e)}")

    async def generate_embeddings_batch(
        self,
        texts: List[str],
        model: Optional[str] = None,
        batch_size: int = 20,
    ) -> List[List[float]]:
        """
        Generate embeddings for multiple texts.

        Processes texts in batches for efficiency.

        Args:
            texts: List of texts to generate embeddings for.
            model: Embedding model to use.
            batch_size: Number of texts to process per API call.

        Returns:
            List of embedding vectors, one per input text.

        Raises:
            OpenRouterError: If embedding generation fails.

        Example:
            >>> client = OpenRouterClient()
            >>> texts = ["Hello", "World", "Test"]
            >>> embeddings = await client.generate_embeddings_batch(texts)
            >>> print(len(embeddings))  # 3
        """
        resolved_model = model or self.MODELS["embedding"]
        all_embeddings: List[List[float]] = []

        logger.info(
            "Generating batch embeddings: count=%d, batch_size=%d",
            len(texts),
            batch_size,
        )

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]

            payload = {
                "model": resolved_model,
                "input": batch,
            }

            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        f"{self.BASE_URL}/embeddings",
                        headers=self._get_headers(),
                        json=payload,
                    )

                if response.status_code != 200:
                    await self._handle_error_response(response, resolved_model)

                data = response.json()

                # Sort by index to maintain order
                sorted_data = sorted(data["data"], key=lambda x: x["index"])
                batch_embeddings = [item["embedding"] for item in sorted_data]
                all_embeddings.extend(batch_embeddings)

                logger.debug(
                    "Batch %d/%d completed: %d embeddings",
                    i // batch_size + 1,
                    (len(texts) + batch_size - 1) // batch_size,
                    len(batch_embeddings),
                )

            except httpx.HTTPError as e:
                logger.error("Batch embedding error at batch %d: %s", i // batch_size, str(e))
                raise OpenRouterError(f"Batch embedding failed: {str(e)}")

        logger.info("Batch embeddings completed: total=%d", len(all_embeddings))
        return all_embeddings

    async def check_api_health(self) -> Dict[str, Any]:
        """
        Check API connectivity and key validity.

        Returns:
            Dict with status, models available, and credits remaining.

        Example:
            >>> client = OpenRouterClient()
            >>> health = await client.check_api_health()
            >>> print(health["status"])  # "healthy"
        """
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                # Check API key by fetching available models
                response = await client.get(
                    f"{self.BASE_URL}/models",
                    headers=self._get_headers(),
                )

                if response.status_code == 401:
                    return {
                        "status": "unhealthy",
                        "error": "Invalid API key",
                    }

                if response.status_code != 200:
                    return {
                        "status": "unhealthy",
                        "error": f"API returned status {response.status_code}",
                    }

                data = response.json()
                models_count = len(data.get("data", []))

                return {
                    "status": "healthy",
                    "models_available": models_count,
                    "api_url": self.BASE_URL,
                }

        except httpx.HTTPError as e:
            return {
                "status": "unhealthy",
                "error": str(e),
            }
