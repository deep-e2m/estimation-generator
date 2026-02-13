# UAT OpenRouter Model Test Results

**Date:** February 13, 2026  
**Purpose:** Verify UAT model configuration (generation, fallbacks, refinement) with dummy project requirements.  
**Environment:** Backend test suite (`backend/test_openrouter.py`), `OPENROUTER_API_KEY` set via `.env`.

---

## Configuration Verified

| Alias | OpenRouter Model ID | Use Case |
|-------|---------------------|----------|
| **generation** | `deepseek/deepseek-chat` | Quote generation, regeneration, feedback & conversational refinement |
| **generation_fallback** | `openai/gpt-4o-mini` | First fallback |
| **generation_fallback_2** | `openai/gpt-4o` | Second fallback |
| **claude** | `anthropic/claude-3-5-sonnet` | Last-resort fallback |
| **fast** | `google/gemini-2.5-flash-lite` | Chat, clarification, requirements analysis |
| **vision** | `openai/gpt-4o` | Image/UI analysis |
| **research** | `perplexity/llama-3.1-sonar-large-128k-online` | Web research |
| **embedding** | `openai/text-embedding-3-small` | RAG embeddings |

**Fallback chain (generation):** `deepseek/deepseek-chat` → `openai/gpt-4o-mini` → `openai/gpt-4o` → `anthropic/claude-3-5-sonnet`

---

## Test Summary

| # | Test | Result |
|---|------|--------|
| 1 | OpenRouter API Health Check | ✅ PASSED |
| 2 | Generation Model Availability (UAT) | ✅ PASSED |
| 3 | Quote Generation (dummy requirements) | ✅ PASSED |
| 4 | Conversational Refinement | ✅ PASSED |
| 5 | Fallback Mechanism | ✅ PASSED |

**Total: 5/5 tests passed**

---

## Environment at Run Time

- **OpenRouter API Key:** Set  
- **App Name:** Estimate AI  
- **LLM Timeout:** 120s  
- **Default Temperature:** 0.3  
- **Default Max Tokens:** 4096  

---

## Evidence from Logs

- **API health:** OpenRouter returned 200, 342 models available.
- **Generation model:** Requests and success logs show `model=deepseek/deepseek-chat` for both quote generation and refinement.
- **Quote generation:** Sample WordPress requirements produced a full quote; metadata extracted (total hours, model used, tokens).
- **Conversational refinement:** Request “Add 2 hours to the total” on a minimal quote returned updated content, explanation, and 1 change; no errors on `response.content` handling.
- **Fallback chain:** Resolved to `['openai/gpt-4o-mini', 'openai/gpt-4o', 'anthropic/claude-3-5-sonnet']` for generation.

---

## Conclusion

UAT model configuration is working as intended. Single-point config in `backend/app/services/ai/openrouter_client.py` (MODELS + FALLBACK_CHAINS) is in effect; quote generation and conversational refinement use the generation model and respond correctly.
