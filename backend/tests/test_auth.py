"""
Tests for authentication endpoints.

This module contains tests for user registration, login, logout,
token refresh, and profile retrieval.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.main import app
from app.models.base import Base
from app.core.database import get_db_session
from app.config import settings


# Test database URL (use SQLite for testing)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def async_engine():
    """Create async engine for testing."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def async_session(async_engine):
    """Create async session for testing."""
    async_session_factory = async_sessionmaker(
        bind=async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    async with async_session_factory() as session:
        yield session


@pytest.fixture
async def client(async_session):
    """Create test client with overridden dependencies."""

    async def override_get_db():
        yield async_session

    app.dependency_overrides[get_db_session] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client

    app.dependency_overrides.clear()


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    @pytest.mark.asyncio
    async def test_health_check(self, client: AsyncClient):
        """Test health check returns healthy status."""
        response = await client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data


class TestRootEndpoint:
    """Tests for root endpoint."""

    @pytest.mark.asyncio
    async def test_root_endpoint(self, client: AsyncClient):
        """Test root endpoint returns API information."""
        response = await client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert "message" in data


class TestRegisterEndpoint:
    """Tests for user registration endpoint."""

    @pytest.mark.asyncio
    async def test_register_success(self, client: AsyncClient):
        """Test successful user registration."""
        user_data = {
            "email": "test@example.com",
            "password": "SecureP@ss123",
            "full_name": "Test User",
            "company_name": "Test Company"
        }

        response = await client.post(
            "/api/v1/auth/register",
            json=user_data
        )

        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["data"]["user"]["email"] == "test@example.com"
        assert "message" in data["data"]

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient):
        """Test registration fails with duplicate email."""
        user_data = {
            "email": "duplicate@example.com",
            "password": "SecureP@ss123",
            "full_name": "Test User"
        }

        # First registration
        await client.post("/api/v1/auth/register", json=user_data)

        # Second registration with same email
        response = await client.post(
            "/api/v1/auth/register",
            json=user_data
        )

        assert response.status_code == 409
        data = response.json()
        assert "RESOURCE_ALREADY_EXISTS" in str(data)

    @pytest.mark.asyncio
    async def test_register_weak_password(self, client: AsyncClient):
        """Test registration fails with weak password."""
        user_data = {
            "email": "test2@example.com",
            "password": "weak",
            "full_name": "Test User"
        }

        response = await client.post(
            "/api/v1/auth/register",
            json=user_data
        )

        assert response.status_code == 422  # Validation error


class TestLoginEndpoint:
    """Tests for user login endpoint."""

    @pytest.fixture
    async def registered_user(self, client: AsyncClient):
        """Create a registered user for login tests."""
        user_data = {
            "email": "login@example.com",
            "password": "SecureP@ss123",
            "full_name": "Login User"
        }
        await client.post("/api/v1/auth/register", json=user_data)
        return user_data

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, registered_user):
        """Test successful login."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": registered_user["email"],
                "password": registered_user["password"]
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "access_token" in data["data"]["tokens"]
        assert "refresh_token" in data["data"]["tokens"]

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, registered_user):
        """Test login fails with wrong password."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": registered_user["email"],
                "password": "WrongP@ss123"
            }
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client: AsyncClient):
        """Test login fails for non-existent user."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "SecureP@ss123"
            }
        )

        assert response.status_code == 401


class TestMeEndpoint:
    """Tests for /auth/me endpoint."""

    @pytest.fixture
    async def authenticated_client(self, client: AsyncClient):
        """Create an authenticated client."""
        # Register user
        user_data = {
            "email": "me@example.com",
            "password": "SecureP@ss123",
            "full_name": "Me User"
        }
        await client.post("/api/v1/auth/register", json=user_data)

        # Login
        login_response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": user_data["email"],
                "password": user_data["password"]
            }
        )

        tokens = login_response.json()["data"]["tokens"]
        access_token = tokens["access_token"]

        # Return client with auth header
        client.headers["Authorization"] = f"Bearer {access_token}"
        return client

    @pytest.mark.asyncio
    async def test_me_authenticated(self, authenticated_client: AsyncClient):
        """Test /auth/me returns user profile when authenticated."""
        response = await authenticated_client.get("/api/v1/auth/me")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["email"] == "me@example.com"

    @pytest.mark.asyncio
    async def test_me_unauthenticated(self, client: AsyncClient):
        """Test /auth/me fails when not authenticated."""
        response = await client.get("/api/v1/auth/me")

        assert response.status_code == 401
