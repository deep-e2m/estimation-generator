"""
API v1 package.

This module exports all v1 API routers.
"""

from app.api.v1 import (
    approvals,
    audit_logs,
    auth,
    chat,
    clients,
    dashboard,
    documents,
    files,
    knowledge,
    project_shares,
    projects,
    quotes,
    users,
)

__all__ = [
    "approvals",
    "audit_logs",
    "auth",
    "chat",
    "clients",
    "dashboard",
    "documents",
    "files",
    "knowledge",
    "project_shares",
    "projects",
    "quotes",
    "users",
]
