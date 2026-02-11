#!/usr/bin/env python3
"""
Development Environment Verification Script
Verifies that all dependencies and imports are working correctly.
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))


def test_imports():
    """Test all critical imports."""
    print("=" * 70)
    print("VERIFYING DEVELOPMENT ENVIRONMENT")
    print("=" * 70)
    print()

    tests = []

    # Test 1: Core dependencies
    print("📦 Testing core dependencies...")
    try:
        import sqlalchemy
        from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
        from sqlalchemy.orm import DeclarativeBase
        tests.append(("✅", "SQLAlchemy (async)", sqlalchemy.__version__))
    except ImportError as e:
        tests.append(("❌", "SQLAlchemy (async)", str(e)))

    try:
        import fastapi
        tests.append(("✅", "FastAPI", fastapi.__version__))
    except ImportError as e:
        tests.append(("❌", "FastAPI", str(e)))

    try:
        import pydantic
        tests.append(("✅", "Pydantic", pydantic.__version__))
    except ImportError as e:
        tests.append(("❌", "Pydantic", str(e)))

    try:
        import asyncpg
        tests.append(("✅", "AsyncPG", asyncpg.__version__))
    except ImportError as e:
        tests.append(("❌", "AsyncPG", str(e)))

    try:
        import alembic
        tests.append(("✅", "Alembic", alembic.__version__))
    except ImportError as e:
        tests.append(("❌", "Alembic", str(e)))

    # Test 2: Project modules
    print("📂 Testing project modules...")
    try:
        from app.models.base import Base, TimestampMixin, UUIDMixin
        tests.append(("✅", "app.models.base", "OK"))
    except ImportError as e:
        tests.append(("❌", "app.models.base", str(e)))

    try:
        from app.models.project import Platform, ProjectStatus, Project
        tests.append(("✅", "app.models.project", f"Platform={[e.value for e in Platform]}"))
    except ImportError as e:
        tests.append(("❌", "app.models.project", str(e)))

    try:
        from app.schemas.project import ProjectCreate, ProjectUpdate
        tests.append(("✅", "app.schemas.project", "OK"))
    except ImportError as e:
        tests.append(("❌", "app.schemas.project", str(e)))

    # Print results
    print()
    print("=" * 70)
    print("RESULTS")
    print("=" * 70)
    print()

    success_count = 0
    fail_count = 0

    for status, name, version in tests:
        print(f"{status} {name:30} {version}")
        if status == "✅":
            success_count += 1
        else:
            fail_count += 1

    print()
    print("=" * 70)

    if fail_count == 0:
        print("🎉 ALL TESTS PASSED!")
        print(f"✅ {success_count}/{len(tests)} imports successful")
        print()
        print("Your development environment is ready!")
        print("=" * 70)
        return 0
    else:
        print(f"⚠️  SOME TESTS FAILED")
        print(f"✅ {success_count}/{len(tests)} passed")
        print(f"❌ {fail_count}/{len(tests)} failed")
        print()
        print("Please check the errors above and reinstall dependencies:")
        print("  cd backend && ./setup_dev.sh")
        print("=" * 70)
        return 1


if __name__ == "__main__":
    sys.exit(test_imports())
