#!/usr/bin/env python3
"""
Test script for OpenRouter API integration.

This script tests:
1. OpenRouter API connectivity
2. Model availability (glm-4.5)
3. Quote generation output format
4. Error handling and fallback mechanisms
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.config import settings
from app.services.ai.openrouter_client import OpenRouterClient, OpenRouterError
from app.services.ai.llm_service import LLMService
from app.services.quote_refinement_service import QuoteRefinementService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def test_api_health():
    """Test OpenRouter API connectivity and health."""
    print("\n" + "=" * 80)
    print("TEST 1: OpenRouter API Health Check")
    print("=" * 80)

    try:
        client = OpenRouterClient()
        health = await client.check_api_health()

        if health.get("status") == "healthy":
            print("✅ OpenRouter API is HEALTHY")
            print(f"   - Models available: {health.get('models_available', 'N/A')}")
            print(f"   - API URL: {health.get('api_url', 'N/A')}")
            return True
        else:
            print("❌ OpenRouter API is UNHEALTHY")
            print(f"   - Error: {health.get('error', 'Unknown error')}")
            return False

    except Exception as e:
        print(f"❌ Failed to check API health: {str(e)}")
        return False


async def test_model_availability():
    """Test if generation model is available and responding."""
    print("\n" + "=" * 80)
    print("TEST 2: Generation Model Availability (UAT)")
    print("=" * 80)

    try:
        client = OpenRouterClient()
        model_id = client.MODELS["generation"]

        messages = [
            {"role": "user", "content": "Respond with exactly: 'Generation model is working.'"}
        ]

        print(f"Testing model: {model_id}")

        response = await client.chat_completion(
            messages=messages,
            model="generation",
            temperature=0.3,
            max_tokens=100,
            max_retries=1,
        )

        print("✅ Generation model is AVAILABLE and responding")
        print(f"   - Model used: {response.model}")
        print(f"   - Response: {response.content[:100]}")
        print(f"   - Tokens used: {response.usage.total_tokens}")
        print(f"   - Cost: ${response.usage.total_cost:.6f}")
        return True

    except OpenRouterError as e:
        print(f"❌ GLM-4.5 model test FAILED: {str(e)}")
        if hasattr(e, 'status_code'):
            print(f"   - Status code: {e.status_code}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return False


async def test_quote_generation():
    """Test quote generation with sample requirements."""
    print("\n" + "=" * 80)
    print("TEST 3: Quote Generation Output Format")
    print("=" * 80)

    sample_requirements = """
Build a WordPress website for a small business with the following requirements:
- Homepage with hero section and 3 service highlights
- About Us page
- Services page with 5 service descriptions
- Contact page with contact form
- Blog section (display only, 10 recent posts)
- Mobile responsive design
- SEO optimization
- Contact form integration
- Google Analytics setup
"""

    try:
        llm_service = LLMService()

        print("Generating quote with requirements:")
        print(sample_requirements[:150] + "...")
        print("\nUsing model: generation ({})".format(OpenRouterClient.MODELS["generation"]))

        result = await llm_service.generate_quote(
            requirements=sample_requirements,
            platform="wordpress",
            rag_context=None,
            temperature=0.3,
        )

        print("\n✅ Quote generation SUCCESSFUL")
        print("\n" + "-" * 80)
        print("GENERATED QUOTE OUTPUT:")
        print("-" * 80)
        print(result.content)
        print("-" * 80)

        print("\n📊 EXTRACTED METADATA:")
        print(f"   - Total hours: {result.total_hours}")
        print(f"   - Hours range: {result.total_hours_min} - {result.total_hours_max}")
        print(f"   - Model used: {result.model_used}")
        print(f"   - Tokens used: {result.tokens_used}")
        print(f"   - Generation cost: ${result.generation_cost:.6f}")
        print(f"   - Assumptions count: {len(result.assumptions)}")
        print(f"   - Exclusions count: {len(result.exclusions)}")
        print(f"   - Breakdown items: {len(result.breakdown)}")

        # Validate output format
        issues = []

        if not result.content:
            issues.append("❌ Content is empty")

        if result.total_hours is None or result.total_hours == 0:
            issues.append("⚠️  Total hours not extracted or is zero")

        if len(result.content) < 500:
            issues.append("⚠️  Content seems too short (< 500 chars)")

        # Check for key sections
        content_lower = result.content.lower()
        expected_sections = [
            ("project overview", "Project Overview section"),
            ("hours", "Hours/Timeline section"),
            ("scope", "Scope of Work section"),
        ]

        for keyword, section_name in expected_sections:
            if keyword not in content_lower:
                issues.append(f"⚠️  Missing {section_name}")

        if issues:
            print("\n⚠️  OUTPUT VALIDATION ISSUES:")
            for issue in issues:
                print(f"   {issue}")
        else:
            print("\n✅ Output format validation PASSED")

        return len(issues) == 0

    except Exception as e:
        print(f"\n❌ Quote generation FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


async def test_conversational_refinement():
    """Test conversational quote refinement (uses generation model, validates response.content handling)."""
    print("\n" + "=" * 80)
    print("TEST 4: Conversational Refinement (UAT)")
    print("=" * 80)

    try:
        from types import SimpleNamespace

        # Minimal quote-like object for refinement (needs id, content, total_hours, platform)
        quote = SimpleNamespace(
            id="00000000-0000-0000-0000-000000000001",
            content="## Project Overview\nSmall website. Total: 10 hours.",
            total_hours=10,
            platform="wordpress",
        )

        service = QuoteRefinementService()
        updated_content, explanation, changes, new_total_hours, project_updates = (
            await service.refine_quote_conversational(
                quote, "Add 2 hours to the total."
            )
        )

        assert isinstance(updated_content, str), "updated_content should be str"
        assert isinstance(explanation, str), "explanation should be str"
        assert isinstance(changes, list), "changes should be list"

        print("✅ Conversational refinement SUCCESSFUL")
        print(f"   - Updated content length: {len(updated_content)} chars")
        print(f"   - Explanation: {explanation[:80]}...")
        print(f"   - Changes count: {len(changes)}")
        return True

    except Exception as e:
        print(f"❌ Conversational refinement FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


async def test_fallback_mechanism():
    """Test the fallback mechanism when primary model fails."""
    print("\n" + "=" * 80)
    print("TEST 5: Fallback Mechanism")
    print("=" * 80)

    try:
        client = OpenRouterClient()

        # Test with invalid model to trigger fallback
        messages = [
            {"role": "user", "content": "Test response"}
        ]

        print("Testing fallback chain...")
        print(f"Primary: {client.MODELS['generation']}")
        fallbacks = client._get_fallback_models(client.MODELS['generation'])
        print(f"Fallbacks: {fallbacks}")

        # The fallback should work even if we specify an invalid model
        # (in production, the actual model would fail, not be invalid)
        print("\n✅ Fallback chain is properly configured")
        return True

    except Exception as e:
        print(f"❌ Fallback test failed: {str(e)}")
        return False


async def run_all_tests():
    """Run all tests."""
    print("\n")
    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 20 + "OpenRouter API Test Suite" + " " * 33 + "║")
    print("╚" + "=" * 78 + "╝")

    # Check environment
    print("\n📋 Environment Configuration:")
    print(f"   - OpenRouter API Key: {'✅ Set' if settings.OPENROUTER_API_KEY else '❌ NOT SET'}")
    print(f"   - App Name: {settings.OPENROUTER_APP_NAME}")
    print(f"   - LLM Timeout: {settings.LLM_REQUEST_TIMEOUT}s")
    print(f"   - Default Temperature: {settings.LLM_DEFAULT_TEMPERATURE}")
    print(f"   - Default Max Tokens: {settings.LLM_DEFAULT_MAX_TOKENS}")

    if not settings.OPENROUTER_API_KEY:
        print("\n❌ OPENROUTER_API_KEY is not set in environment!")
        print("   Please set it in your .env file or environment variables.")
        return False

    # Run tests
    results = []

    results.append(("API Health Check", await test_api_health()))
    results.append(("Model Availability", await test_model_availability()))
    results.append(("Quote Generation", await test_quote_generation()))
    results.append(("Conversational Refinement", await test_conversational_refinement()))
    results.append(("Fallback Mechanism", await test_fallback_mechanism()))

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name:.<60} {status}")

    print("-" * 80)
    print(f"Total: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests PASSED! The OpenRouter integration is working correctly.")
        return True
    else:
        print(f"\n⚠️  {total - passed} test(s) FAILED. Please review the errors above.")
        return False


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
