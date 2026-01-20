"""
API package.

This module exports API routers and dependencies.
"""

from app.api import dependencies, v1

__all__ = ["v1", "dependencies"]
