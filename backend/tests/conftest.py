"""
Pytest configuration and shared fixtures.

This module provides common fixtures for all test modules.
"""

import pytest


@pytest.fixture(scope="session")
def anyio_backend():
    """Specify asyncio as the async backend."""
    return "asyncio"
