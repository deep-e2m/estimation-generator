# Quote Generation Assistant - Backend

FastAPI backend for the AI-Based Quote Generation Assistant.

## Tech Stack

- **Framework**: FastAPI with async support
- **Database**: PostgreSQL with asyncpg driver
- **ORM**: SQLAlchemy 2.0 (async)
- **Migrations**: Alembic
- **Authentication**: JWT (python-jose) + bcrypt password hashing
- **Validation**: Pydantic v2

## Project Structure

```
backend/
├── alembic/                    # Database migrations
│   ├── versions/               # Migration files
│   └── env.py                  # Alembic configuration
├── app/
│   ├── api/                    # API routes
│   │   ├── v1/                 # API version 1
│   │   │   └── auth.py         # Authentication endpoints
│   │   └── dependencies.py     # Route dependencies
│   ├── core/                   # Core utilities
│   │   ├── database.py         # Database connection
│   │   └── security.py         # Password & JWT handling
│   ├── models/                 # SQLAlchemy models
│   │   ├── base.py             # Base model and mixins
│   │   └── user.py             # User model
│   ├── schemas/                # Pydantic schemas
│   │   └── auth.py             # Auth request/response schemas
│   ├── services/               # Business logic
│   │   └── storage/            # File storage abstraction
│   ├── config.py               # Application configuration
│   └── main.py                 # FastAPI application
├── tests/                      # Test files
├── .env.example                # Example environment variables
├── alembic.ini                 # Alembic configuration
└── requirements.txt            # Python dependencies
```

## Setup

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Redis (optional, for session/cache)

### Installation

1. Create and activate virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create environment file:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Create database:
```bash
createdb quote_assistant
```

5. Run migrations:
```bash
alembic upgrade head
```

6. Start the server:
```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

## API Documentation

When running in development mode (DEBUG=true), API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register a new user |
| POST | `/api/v1/auth/login` | Authenticate and get tokens |
| POST | `/api/v1/auth/logout` | Logout (invalidate tokens) |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/auth/me` | Get current user profile |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql+asyncpg://...` |
| `SECRET_KEY` | JWT signing key | (required in production) |
| `DEBUG` | Enable debug mode | `false` |
| `ENVIRONMENT` | Environment name | `development` |

See `.env.example` for all available configuration options.

## Running Tests

```bash
pytest
```

With coverage:
```bash
pytest --cov=app --cov-report=html
```

## Development

### Creating Migrations

```bash
# Auto-generate migration from model changes
alembic revision --autogenerate -m "Description of changes"

# Create empty migration
alembic revision -m "Description of changes"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

### Code Quality

```bash
# Format code
black app tests

# Sort imports
isort app tests

# Type checking
mypy app

# Linting
ruff check app tests
```
