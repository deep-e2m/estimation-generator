# LLM Integration Architecture

**Document Version**: 1.0
**Last Updated**: 2026-01-21
**Status**: Specification
**Classification**: Internal

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Multi-Model Architecture Strategy](#3-multi-model-architecture-strategy)
4. [OpenRouter Integration](#4-openrouter-integration)
5. [Intelligent Model Selection](#5-intelligent-model-selection)
6. [Implementation Specifications](#6-implementation-specifications)
7. [Cost Optimization](#7-cost-optimization)
8. [Error Handling and Fallback](#8-error-handling-and-fallback)

---

## 1. Executive Summary

### 1.1 Current State

**Finding**: The application does NOT currently have any LLM integration implemented.

**Evidence**:
- No LLM API calls in backend codebase
- No OpenRouter, OpenAI, or Anthropic configuration in environment variables
- LangGraph is listed in requirements.txt but not implemented
- No AI service layer exists in `/backend/app/services/`

### 1.2 Recommended Architecture

This specification proposes a multi-model architecture using **OpenRouter** as the unified API gateway, enabling:

1. **Dynamic model selection** based on task requirements
2. **Cost optimization** through intelligent model routing
3. **Fallback redundancy** for high availability
4. **Usage tracking** and cost monitoring

### 1.3 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API Gateway | OpenRouter | Single API for multiple providers, cost tracking, fallback |
| Main Generation Models | Gemini 2.0 Flash Thinking + GPT-4o | Latest capabilities, strong reasoning |
| Research Models | Gemini 2.0 Flash Thinking + Perplexity | Web search integration, recent data |
| Vision Processing | GPT-4o + Claude 3.5 Sonnet | Best multimodal understanding |
| Fast Tasks | Gemini 1.5 Flash | Cost-effective for simple operations |

---

## 2. Current State Analysis

### 2.1 What Exists

**Infrastructure**:
- FastAPI backend with async support
- PostgreSQL with pgvector extension (for future RAG)
- Redis for caching
- File storage abstraction layer

**Dependencies Installed**:
```python
# From requirements.txt
langgraph>=0.2.0          # Not yet configured
langchain-core>=0.2.0     # Not yet configured
pgvector>=0.2.0           # Not yet configured
httpx>=0.27.0             # Available for API calls
```

### 2.2 What's Missing

**Critical Components Not Implemented**:
1. LLM API integration layer
2. OpenRouter client configuration
3. Model selection logic
4. Prompt management system
5. Response streaming handlers
6. Token usage tracking
7. RAG pipeline (embeddings, vector search)
8. LangGraph workflow orchestration

### 2.3 Knowledge Base Status

**Existing Knowledge Base Structure**:
```
/knowledge-based/
├── formatting/          # 3 sample quote documents (DOCX)
├── requirements/        # 1 example requirement
└── guidelines/          # 1 estimation guideline
```

**Status**: Only 3 sample quotes - needs 30-50 for production-ready RAG system.

---

## 3. Multi-Model Architecture Strategy

### 3.1 Model Selection Framework

```
┌─────────────────────────────────────────────────────────────┐
│                  TASK CLASSIFICATION                         │
│                                                              │
│  Input: User request + file attachments + context           │
│                        │                                     │
│                        v                                     │
│            ┌───────────────────────┐                         │
│            │  Task Classifier      │                         │
│            │  (Rule-based + LLM)   │                         │
│            └───────────┬───────────┘                         │
│                        │                                     │
│        ┌───────────────┼───────────────┐                     │
│        │               │               │                     │
│        v               v               v                     │
│   ┌────────┐    ┌──────────┐    ┌──────────┐               │
│   │ Vision │    │ Research │    │ Generation│               │
│   │  Task  │    │   Task   │    │   Task    │               │
│   └────┬───┘    └────┬─────┘    └────┬─────┘               │
│        │             │               │                       │
│        v             v               v                       │
│   ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│   │ GPT-4o or  │ │ Gemini     │ │ Gemini 2.0 │             │
│   │ Claude 3.5 │ │ 2.0 Flash  │ │ Flash or   │             │
│   │ Sonnet     │ │ Thinking + │ │ GPT-4o     │             │
│   │            │ │ Perplexity │ │            │             │
│   └────────────┘ └────────────┘ └────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Task-to-Model Mapping

#### 3.2.1 Quote Generation Tasks

| Task | Model | Input Tokens | Output Tokens | Cost/1K | Use Case |
|------|-------|--------------|---------------|---------|----------|
| **Main Quote Generation** | Gemini 2.0 Flash Thinking | 10K-30K | 2K-5K | $0.0001/$0.0004 | Primary quote generation with reasoning |
| **Fallback Generation** | GPT-4o | 10K-30K | 2K-5K | $0.0025/$0.010 | When Gemini unavailable |
| **Complex Estimation** | GPT-4o | 15K-40K | 3K-8K | $0.0025/$0.010 | Multi-platform, high complexity projects |

#### 3.2.2 Research & Web Search Tasks

| Task | Model | Provider | Use Case |
|------|-------|----------|----------|
| **Web Research** | Gemini 2.0 Flash Thinking | Google | Plugin documentation research |
| **Article Fetching** | Perplexity Online | Perplexity | PM reference links, best practices |
| **Technical Docs** | Gemini 2.0 Flash Thinking | Google | API documentation parsing |

#### 3.2.3 Vision & Document Analysis

| Task | Model | Provider | Use Case |
|------|-------|----------|----------|
| **Screenshot Analysis** | GPT-4o | OpenAI | UI mockup analysis |
| **Design File Review** | Claude 3.5 Sonnet | Anthropic | Complex design interpretation |
| **Document OCR** | GPT-4o | OpenAI | PDF/Image text extraction |

#### 3.2.4 Support Tasks

| Task | Model | Cost/1K | Use Case |
|------|-------|---------|----------|
| **Requirement Extraction** | Gemini 1.5 Flash | $0.000075/$0.0003 | Parse user input |
| **Clarification Questions** | Gemini 1.5 Flash | $0.000075/$0.0003 | Generate follow-up questions |
| **Summary Generation** | Gemini 1.5 Flash | $0.000075/$0.0003 | Project summaries |
| **Formatting** | Gemini 1.5 Flash | $0.000075/$0.0003 | Output formatting |

### 3.3 Model Characteristics

#### Gemini 2.0 Flash Thinking (Experimental)
- **Strengths**: Reasoning, cost-effective, fast, 1M token context
- **Best For**: Main quote generation, research tasks
- **Limitations**: Experimental (may change), no vision yet
- **Cost**: $0.0001 input / $0.0004 output per 1K tokens

#### GPT-4o
- **Strengths**: Multimodal (vision), reliable, well-tested
- **Best For**: Vision tasks, complex reasoning, fallback
- **Limitations**: More expensive than Gemini
- **Cost**: $0.0025 input / $0.010 output per 1K tokens

#### Claude 3.5 Sonnet
- **Strengths**: Excellent instruction following, vision
- **Best For**: Design analysis, structured output
- **Limitations**: Most expensive option
- **Cost**: $0.003 input / $0.015 output per 1K tokens

#### Perplexity Online
- **Strengths**: Live web search, citations, recent data
- **Best For**: PM reference links, current documentation
- **Limitations**: Slower, web-dependent
- **Cost**: $0.001 input / $0.001 output per 1K tokens

#### Gemini 1.5 Flash
- **Strengths**: Extremely fast, very cheap, 1M token context
- **Best For**: Simple parsing, formatting, fast tasks
- **Limitations**: Less capable reasoning
- **Cost**: $0.000075 input / $0.0003 output per 1K tokens

---

## 4. OpenRouter Integration

### 4.1 Why OpenRouter?

**Advantages**:
1. **Single API** for multiple providers (OpenAI, Anthropic, Google, Perplexity)
2. **Automatic fallback** when models are unavailable
3. **Cost tracking** built-in with detailed analytics
4. **Model aliasing** (e.g., use "latest GPT-4" without hardcoding versions)
5. **No rate limit surprises** - handles provider limits gracefully
6. **Usage credits** - user already has API key

**vs. Direct Provider APIs**:
```
Direct APIs:
- Manage 4+ API keys
- Handle different authentication schemes
- Implement custom fallback logic
- Build cost tracking from scratch
- Monitor rate limits per provider

OpenRouter:
- Single API key
- Unified authentication
- Built-in fallback
- Automatic cost tracking
- Consolidated rate limiting
```

### 4.2 OpenRouter Configuration

#### Environment Variables
```bash
# .env
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_APP_NAME="Estimate AI Quote Generator"
OPENROUTER_APP_URL=https://your-domain.com
OPENROUTER_HTTP_REFERER=https://your-domain.com
```

#### Model Identifiers

```python
# OpenRouter model IDs
MODELS = {
    # Generation Models
    "gemini-2-flash-thinking": "google/gemini-2.0-flash-thinking-exp:free",
    "gpt-4o": "openai/gpt-4o",

    # Research Models
    "gemini-2-flash-thinking": "google/gemini-2.0-flash-thinking-exp:free",
    "perplexity-online": "perplexity/llama-3.1-sonar-large-128k-online",

    # Vision Models
    "gpt-4o-vision": "openai/gpt-4o",
    "claude-sonnet-vision": "anthropic/claude-3-5-sonnet",

    # Fast Models
    "gemini-flash": "google/gemini-1.5-flash-8b",
}
```

### 4.3 OpenRouter Request Format

```python
import httpx
from typing import Dict, List, Optional

async def call_openrouter(
    messages: List[Dict[str, str]],
    model: str,
    temperature: float = 0.3,
    max_tokens: int = 4096,
    stream: bool = False
) -> Dict:
    """
    Make OpenRouter API call.

    Args:
        messages: Chat messages in OpenAI format
        model: OpenRouter model ID
        temperature: Sampling temperature (0-2)
        max_tokens: Maximum tokens to generate
        stream: Enable streaming response

    Returns:
        API response or streamed chunks
    """

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": OPENROUTER_HTTP_REFERER,
        "X-Title": OPENROUTER_APP_NAME,
        "Content-Type": "application/json"
    }

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": stream
    }

    async with httpx.AsyncClient() as client:
        if stream:
            async with client.stream(
                "POST",
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=120.0
            ) as response:
                async for chunk in response.aiter_lines():
                    if chunk.startswith("data: "):
                        yield chunk[6:]
        else:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=120.0
            )
            response.raise_for_status()
            return response.json()
```

---

## 5. Intelligent Model Selection

### 5.1 Task Classification Logic

```python
from typing import Literal, Dict, List
from pydantic import BaseModel

class TaskClassification(BaseModel):
    task_type: Literal[
        "quote_generation",
        "web_research",
        "vision_analysis",
        "document_parsing",
        "requirement_extraction",
        "clarification",
        "formatting"
    ]
    complexity: Literal["simple", "medium", "complex"]
    requires_vision: bool
    requires_web_search: bool
    estimated_input_tokens: int
    estimated_output_tokens: int

async def classify_task(
    user_message: str,
    attachments: List[Dict],
    context: Dict
) -> TaskClassification:
    """
    Classify task to determine optimal model selection.

    Args:
        user_message: User's input message
        attachments: List of uploaded files
        context: Project and chat context

    Returns:
        TaskClassification with task details
    """

    # Rule-based classification
    has_images = any(
        att["content_type"].startswith("image/")
        for att in attachments
    )

    has_documents = any(
        att["content_type"] == "application/pdf" or
        att["content_type"].endswith("wordprocessingml.document")
        for att in attachments
    )

    # Detect web research needs
    research_keywords = [
        "latest", "current", "best practice", "recent",
        "documentation", "article", "reference", "research"
    ]
    needs_web_search = any(
        keyword in user_message.lower()
        for keyword in research_keywords
    )

    # Estimate complexity
    message_length = len(user_message.split())
    attachment_count = len(attachments)

    if message_length > 200 or attachment_count > 3:
        complexity = "complex"
    elif message_length > 50 or attachment_count > 0:
        complexity = "medium"
    else:
        complexity = "simple"

    # Determine task type
    if has_images or has_documents:
        task_type = "vision_analysis" if has_images else "document_parsing"
    elif needs_web_search:
        task_type = "web_research"
    elif "quote" in user_message.lower() or "estimate" in user_message.lower():
        task_type = "quote_generation"
    else:
        task_type = "requirement_extraction"

    return TaskClassification(
        task_type=task_type,
        complexity=complexity,
        requires_vision=has_images,
        requires_web_search=needs_web_search,
        estimated_input_tokens=estimate_tokens(user_message, attachments),
        estimated_output_tokens=2000
    )

def estimate_tokens(message: str, attachments: List[Dict]) -> int:
    """Rough token estimation: 1 token ≈ 4 characters"""
    text_tokens = len(message) // 4

    # Vision tokens (rough estimate)
    image_tokens = sum(
        1000 for att in attachments
        if att["content_type"].startswith("image/")
    )

    return text_tokens + image_tokens
```

### 5.2 Model Selection Strategy

```python
class ModelSelector:
    """
    Intelligent model selector based on task requirements.
    """

    MODEL_STRATEGY = {
        "quote_generation": {
            "simple": "gemini-flash",
            "medium": "gemini-2-flash-thinking",
            "complex": "gpt-4o"
        },
        "web_research": {
            "simple": "gemini-2-flash-thinking",
            "medium": "gemini-2-flash-thinking",
            "complex": "perplexity-online"
        },
        "vision_analysis": {
            "simple": "gpt-4o-vision",
            "medium": "gpt-4o-vision",
            "complex": "claude-sonnet-vision"
        },
        "document_parsing": {
            "simple": "gemini-flash",
            "medium": "gpt-4o-vision",
            "complex": "gpt-4o-vision"
        },
        "requirement_extraction": {
            "simple": "gemini-flash",
            "medium": "gemini-flash",
            "complex": "gemini-2-flash-thinking"
        },
        "clarification": {
            "simple": "gemini-flash",
            "medium": "gemini-flash",
            "complex": "gemini-flash"
        },
        "formatting": {
            "simple": "gemini-flash",
            "medium": "gemini-flash",
            "complex": "gemini-flash"
        }
    }

    FALLBACK_CHAIN = {
        "gemini-2-flash-thinking": ["gpt-4o", "claude-sonnet"],
        "gpt-4o": ["gemini-2-flash-thinking", "claude-sonnet"],
        "claude-sonnet": ["gpt-4o", "gemini-2-flash-thinking"],
        "perplexity-online": ["gemini-2-flash-thinking", "gpt-4o"],
        "gemini-flash": ["gemini-2-flash-thinking", "gpt-4o"]
    }

    def select_model(self, task: TaskClassification) -> str:
        """
        Select optimal model for task.

        Args:
            task: Classified task with requirements

        Returns:
            OpenRouter model ID
        """

        # Override for specific requirements
        if task.requires_vision:
            return "gpt-4o-vision"

        if task.requires_web_search:
            return "perplexity-online"

        # Use strategy matrix
        return self.MODEL_STRATEGY[task.task_type][task.complexity]

    def get_fallback_models(self, primary_model: str) -> List[str]:
        """Get fallback models if primary fails."""
        return self.FALLBACK_CHAIN.get(primary_model, ["gpt-4o"])
```

---

## 6. Implementation Specifications

### 6.1 Service Layer Architecture

```
/backend/app/services/ai/
├── __init__.py
├── openrouter_client.py      # OpenRouter API wrapper
├── model_selector.py          # Task classification & model selection
├── prompt_manager.py          # Prompt templates
├── llm_service.py             # High-level LLM service
└── streaming_handler.py       # SSE streaming for real-time responses
```

### 6.2 OpenRouter Client Implementation

```python
# /backend/app/services/ai/openrouter_client.py

import httpx
import json
from typing import Dict, List, Optional, AsyncIterator
from pydantic import BaseModel
from app.config import settings

class OpenRouterUsage(BaseModel):
    """Token usage tracking"""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    total_cost: float

class OpenRouterResponse(BaseModel):
    """Standardized LLM response"""
    content: str
    model: str
    finish_reason: str
    usage: OpenRouterUsage

class OpenRouterClient:
    """
    OpenRouter API client with automatic fallback and error handling.
    """

    BASE_URL = "https://openrouter.ai/api/v1"

    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.app_name = settings.OPENROUTER_APP_NAME
        self.http_referer = settings.OPENROUTER_HTTP_REFERER

        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY not configured")

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": self.http_referer,
            "X-Title": self.app_name,
            "Content-Type": "application/json"
        }

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        fallback_models: Optional[List[str]] = None
    ) -> OpenRouterResponse:
        """
        Send chat completion request with automatic fallback.

        Args:
            messages: Chat messages in OpenAI format
            model: Primary model to use
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            fallback_models: List of fallback models if primary fails

        Returns:
            OpenRouterResponse with content and usage

        Raises:
            Exception: If all models fail
        """

        models_to_try = [model] + (fallback_models or [])
        last_error = None

        for attempt_model in models_to_try:
            try:
                payload = {
                    "model": attempt_model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens
                }

                async with httpx.AsyncClient(timeout=120.0) as client:
                    response = await client.post(
                        f"{self.BASE_URL}/chat/completions",
                        headers=self._get_headers(),
                        json=payload
                    )
                    response.raise_for_status()
                    data = response.json()

                # Parse response
                choice = data["choices"][0]
                usage = data.get("usage", {})

                return OpenRouterResponse(
                    content=choice["message"]["content"],
                    model=data["model"],
                    finish_reason=choice["finish_reason"],
                    usage=OpenRouterUsage(
                        prompt_tokens=usage.get("prompt_tokens", 0),
                        completion_tokens=usage.get("completion_tokens", 0),
                        total_tokens=usage.get("total_tokens", 0),
                        total_cost=usage.get("total_cost", 0.0)
                    )
                )

            except httpx.HTTPStatusError as e:
                last_error = e
                # Log and try next model
                print(f"Model {attempt_model} failed: {e}")
                continue
            except Exception as e:
                last_error = e
                print(f"Unexpected error with {attempt_model}: {e}")
                continue

        # All models failed
        raise Exception(f"All models failed. Last error: {last_error}")

    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.3,
        max_tokens: int = 4096
    ) -> AsyncIterator[str]:
        """
        Stream chat completion response.

        Args:
            messages: Chat messages
            model: Model to use
            temperature: Sampling temperature
            max_tokens: Maximum tokens

        Yields:
            Content chunks as they arrive
        """

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.BASE_URL}/chat/completions",
                headers=self._get_headers(),
                json=payload
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]

                        if data_str == "[DONE]":
                            break

                        try:
                            data = json.loads(data_str)
                            delta = data["choices"][0]["delta"]

                            if "content" in delta:
                                yield delta["content"]
                        except json.JSONDecodeError:
                            continue
```

### 6.3 High-Level LLM Service

```python
# /backend/app/services/ai/llm_service.py

from typing import Dict, List, Optional
from app.services.ai.openrouter_client import OpenRouterClient, OpenRouterResponse
from app.services.ai.model_selector import ModelSelector, TaskClassification
from app.services.ai.prompt_manager import PromptManager

class LLMService:
    """
    High-level LLM service for quote generation application.
    """

    def __init__(self):
        self.client = OpenRouterClient()
        self.selector = ModelSelector()
        self.prompts = PromptManager()

    async def generate_quote(
        self,
        requirements: str,
        attachments: List[Dict],
        context: Dict,
        rag_context: Optional[str] = None
    ) -> Dict:
        """
        Generate quote using intelligent model selection.

        Args:
            requirements: User requirements text
            attachments: Uploaded files
            context: Project and chat context
            rag_context: Retrieved knowledge base context

        Returns:
            Generated quote with metadata
        """

        # Classify task
        task = await self.selector.classify_task(
            requirements, attachments, context
        )

        # Select model
        model = self.selector.select_model(task)
        fallback_models = self.selector.get_fallback_models(model)

        # Build messages
        messages = self.prompts.build_quote_generation_prompt(
            requirements=requirements,
            rag_context=rag_context,
            context=context
        )

        # Call LLM
        response = await self.client.chat_completion(
            messages=messages,
            model=model,
            temperature=0.3,
            max_tokens=4096,
            fallback_models=fallback_models
        )

        return {
            "quote": response.content,
            "model_used": response.model,
            "usage": response.usage.dict(),
            "task_classification": task.dict()
        }

    async def research_web(
        self,
        query: str,
        context: str
    ) -> Dict:
        """
        Perform web research using Perplexity or Gemini.

        Args:
            query: Research query
            context: Additional context

        Returns:
            Research results with sources
        """

        messages = self.prompts.build_research_prompt(query, context)

        response = await self.client.chat_completion(
            messages=messages,
            model="perplexity-online",
            temperature=0.2,
            max_tokens=2048,
            fallback_models=["gemini-2-flash-thinking"]
        )

        return {
            "research": response.content,
            "model_used": response.model,
            "usage": response.usage.dict()
        }

    async def analyze_vision(
        self,
        image_data: str,
        prompt: str
    ) -> Dict:
        """
        Analyze images using GPT-4o or Claude.

        Args:
            image_data: Base64 encoded image
            prompt: Analysis prompt

        Returns:
            Vision analysis results
        """

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}
                    }
                ]
            }
        ]

        response = await self.client.chat_completion(
            messages=messages,
            model="gpt-4o-vision",
            temperature=0.2,
            max_tokens=2048,
            fallback_models=["claude-sonnet-vision"]
        )

        return {
            "analysis": response.content,
            "model_used": response.model,
            "usage": response.usage.dict()
        }
```

### 6.4 Configuration Updates

```python
# /backend/app/config.py

class Settings(BaseSettings):
    # ... existing settings ...

    # OpenRouter Configuration
    OPENROUTER_API_KEY: str = Field(
        default="",
        description="OpenRouter API key for multi-model access"
    )
    OPENROUTER_APP_NAME: str = "Estimate AI Quote Generator"
    OPENROUTER_HTTP_REFERER: str = Field(
        default="http://localhost:3000",
        description="HTTP referer for OpenRouter requests"
    )

    # Model Selection Preferences
    PRIMARY_GENERATION_MODEL: str = "google/gemini-2.0-flash-thinking-exp:free"
    PRIMARY_RESEARCH_MODEL: str = "perplexity/llama-3.1-sonar-large-128k-online"
    PRIMARY_VISION_MODEL: str = "openai/gpt-4o"

    # LLM Request Settings
    LLM_DEFAULT_TEMPERATURE: float = Field(default=0.3, ge=0.0, le=2.0)
    LLM_DEFAULT_MAX_TOKENS: int = Field(default=4096, ge=256, le=8192)
    LLM_REQUEST_TIMEOUT: int = Field(default=120, ge=30, le=300)
```

---

## 7. Cost Optimization

### 7.1 Estimated Monthly Costs

**Assumptions**:
- 70 Project Managers
- 50 quotes per PM per month = 3,500 quotes/month
- Average tokens per quote: 12K input, 3K output

**Cost Breakdown**:

```
Main Quote Generation (Gemini 2.0 Flash Thinking):
- 3,500 quotes × 12K input tokens = 42M tokens
- 3,500 quotes × 3K output tokens = 10.5M tokens
- Input cost: 42M × $0.0001/1K = $4.20
- Output cost: 10.5M × $0.0004/1K = $4.20
- Subtotal: $8.40/month

Web Research (20% of quotes = 700 research tasks):
- 700 tasks × 5K input = 3.5M tokens
- 700 tasks × 2K output = 1.4M tokens
- Perplexity cost: (3.5M + 1.4M) × $0.001/1K = $4.90
- Subtotal: $4.90/month

Vision Analysis (15% of quotes = 525 vision tasks):
- 525 tasks × 8K input (including image tokens) = 4.2M tokens
- 525 tasks × 1K output = 525K tokens
- GPT-4o cost: 4.2M × $0.0025/1K + 525K × $0.010/1K = $10.50 + $5.25
- Subtotal: $15.75/month

Support Tasks (parsing, formatting, clarification):
- Est. 10,500 tasks/month (3× quotes)
- Gemini 1.5 Flash: 52.5M tokens × $0.000075/1K = $3.94
- Subtotal: $3.94/month

TOTAL ESTIMATED: $32.99/month
Add 50% buffer: ~$50/month
```

### 7.2 Cost Saving Strategies

1. **Aggressive caching**:
   ```python
   # Cache responses for identical requests
   cache_key = hash(prompt + model + temperature)
   if cached := redis.get(cache_key):
       return cached
   ```

2. **Use free Gemini 2.0 Flash Thinking tier**:
   - OpenRouter offers free tier: `google/gemini-2.0-flash-thinking-exp:free`
   - Limited rate limits but significant cost savings

3. **Batch processing**:
   ```python
   # Process multiple requirements in single request when possible
   # Instead of: 5 requests × 1K tokens each
   # Do: 1 request × 5K tokens (cheaper)
   ```

4. **Smart token management**:
   ```python
   # Truncate context intelligently
   def truncate_context(text: str, max_tokens: int) -> str:
       """Keep most recent and most relevant context"""
       pass
   ```

---

## 8. Error Handling and Fallback

### 8.1 Failure Scenarios

| Failure Type | Detection | Fallback Action |
|--------------|-----------|-----------------|
| API Key Invalid | 401 response | Alert admin, disable service |
| Rate Limit Hit | 429 response | Switch to fallback model |
| Model Unavailable | 503 response | Use fallback chain |
| Timeout | No response in 120s | Retry with shorter context |
| Invalid Response | Malformed JSON | Regenerate with different model |
| Content Filter | Finish reason = "content_filter" | Retry with modified prompt |

### 8.2 Fallback Implementation

```python
async def robust_llm_call(
    messages: List[Dict],
    model: str,
    fallback_chain: List[str],
    max_retries: int = 3
) -> OpenRouterResponse:
    """
    LLM call with automatic retry and fallback.

    Args:
        messages: Chat messages
        model: Primary model
        fallback_chain: Ordered list of fallback models
        max_retries: Max retries per model

    Returns:
        Successful response

    Raises:
        Exception: If all attempts fail
    """

    models_to_try = [model] + fallback_chain

    for attempt_model in models_to_try:
        for retry in range(max_retries):
            try:
                response = await openrouter_client.chat_completion(
                    messages=messages,
                    model=attempt_model
                )

                # Success
                logger.info(f"LLM call succeeded with {attempt_model}")
                return response

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    # Rate limit - try next model immediately
                    logger.warning(f"Rate limit on {attempt_model}, trying next model")
                    break
                elif e.response.status_code in [500, 502, 503, 504]:
                    # Server error - retry same model
                    logger.warning(f"Server error on {attempt_model}, retry {retry+1}/{max_retries}")
                    await asyncio.sleep(2 ** retry)  # Exponential backoff
                    continue
                else:
                    # Other error - try next model
                    logger.error(f"Error with {attempt_model}: {e}")
                    break

            except asyncio.TimeoutError:
                logger.warning(f"Timeout on {attempt_model}, retry {retry+1}/{max_retries}")
                continue

    raise Exception("All LLM models failed after retries")
```

---

## 9. Implementation Roadmap

### Phase 1: Basic Integration (Week 1-2)
- [ ] Add OpenRouter configuration to settings
- [ ] Implement OpenRouterClient basic functionality
- [ ] Create simple LLMService wrapper
- [ ] Add health check endpoint for LLM connectivity
- [ ] Test with single model (Gemini 2.0 Flash Thinking)

### Phase 2: Model Selection (Week 3)
- [ ] Implement TaskClassification logic
- [ ] Build ModelSelector with strategy matrix
- [ ] Add fallback chain logic
- [ ] Create prompt templates for each task type
- [ ] Test model switching based on task

### Phase 3: Advanced Features (Week 4)
- [ ] Add streaming support for real-time responses
- [ ] Implement response caching with Redis
- [ ] Add usage tracking and cost monitoring
- [ ] Build admin dashboard for model performance
- [ ] Set up alerting for failures

### Phase 4: Optimization (Week 5-6)
- [ ] Tune model selection thresholds
- [ ] Optimize prompts for better output
- [ ] Implement aggressive caching strategies
- [ ] Add request batching where possible
- [ ] Performance testing and benchmarking

---

## 10. Testing Strategy

### 10.1 Unit Tests

```python
# tests/test_openrouter_client.py

import pytest
from app.services.ai.openrouter_client import OpenRouterClient

@pytest.mark.asyncio
async def test_chat_completion_success():
    """Test successful chat completion"""
    client = OpenRouterClient()

    messages = [
        {"role": "user", "content": "Say hello"}
    ]

    response = await client.chat_completion(
        messages=messages,
        model="gemini-flash"
    )

    assert response.content
    assert response.usage.total_tokens > 0

@pytest.mark.asyncio
async def test_fallback_on_error():
    """Test fallback when primary model fails"""
    client = OpenRouterClient()

    messages = [{"role": "user", "content": "Test"}]

    # Use invalid model as primary, valid as fallback
    response = await client.chat_completion(
        messages=messages,
        model="invalid-model",
        fallback_models=["gemini-flash"]
    )

    assert response.model == "gemini-flash"
```

### 10.2 Integration Tests

```python
# tests/test_llm_service.py

import pytest
from app.services.ai.llm_service import LLMService

@pytest.mark.asyncio
async def test_quote_generation_flow():
    """Test end-to-end quote generation"""
    service = LLMService()

    result = await service.generate_quote(
        requirements="Build a WordPress site with WooCommerce",
        attachments=[],
        context={"project_type": "wordpress"}
    )

    assert result["quote"]
    assert result["model_used"]
    assert result["usage"]["total_cost"] > 0

@pytest.mark.asyncio
async def test_web_research():
    """Test web research functionality"""
    service = LLMService()

    result = await service.research_web(
        query="Latest WooCommerce best practices",
        context="E-commerce project"
    )

    assert result["research"]
    assert "perplexity" in result["model_used"].lower() or \
           "gemini" in result["model_used"].lower()
```

---

## 11. Monitoring and Observability

### 11.1 Key Metrics to Track

```python
# Track in CloudWatch or custom metrics service

metrics = {
    "llm.requests.total": Counter(),
    "llm.requests.by_model": Counter(labels=["model"]),
    "llm.requests.by_task": Counter(labels=["task_type"]),
    "llm.latency": Histogram(labels=["model"]),
    "llm.tokens.input": Counter(labels=["model"]),
    "llm.tokens.output": Counter(labels=["model"]),
    "llm.cost.total": Counter(),
    "llm.errors.by_type": Counter(labels=["error_type"]),
    "llm.fallback.triggered": Counter(labels=["from_model", "to_model"])
}
```

### 11.2 Cost Alert Thresholds

```python
# Alert if daily costs exceed budget
DAILY_COST_ALERT_THRESHOLD = 5.00  # $5/day = ~$150/month

if daily_llm_cost > DAILY_COST_ALERT_THRESHOLD:
    send_alert(
        title="LLM costs exceeding budget",
        message=f"Daily cost: ${daily_llm_cost}",
        severity="warning"
    )
```

---

## Appendix A: OpenRouter Model Pricing (2026-01-21)

| Model | Provider | Input $/1M | Output $/1M | Context | Notes |
|-------|----------|------------|-------------|---------|-------|
| Gemini 2.0 Flash Thinking | Google | $0.10 | $0.40 | 1M tokens | Experimental, reasoning |
| Gemini 1.5 Flash 8B | Google | $0.075 | $0.30 | 1M tokens | Fast, cheap |
| GPT-4o | OpenAI | $2.50 | $10.00 | 128K tokens | Multimodal |
| Claude 3.5 Sonnet | Anthropic | $3.00 | $15.00 | 200K tokens | Best instruction following |
| Perplexity Online | Perplexity | $1.00 | $1.00 | 128K tokens | Live web search |

---

## Appendix B: Sample Environment Configuration

```bash
# .env
OPENROUTER_API_KEY=sk-or-v1-1234567890abcdef
OPENROUTER_APP_NAME="Estimate AI Quote Generator"
OPENROUTER_HTTP_REFERER=https://your-domain.com

PRIMARY_GENERATION_MODEL=google/gemini-2.0-flash-thinking-exp:free
PRIMARY_RESEARCH_MODEL=perplexity/llama-3.1-sonar-large-128k-online
PRIMARY_VISION_MODEL=openai/gpt-4o

LLM_DEFAULT_TEMPERATURE=0.3
LLM_DEFAULT_MAX_TOKENS=4096
LLM_REQUEST_TIMEOUT=120
```
