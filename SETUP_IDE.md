# IDE Setup Guide

This guide helps you configure your IDE to work with the estimation-generator project and resolve import errors.

## ✅ Quick Fix Summary

We've set up a local Python virtual environment at `backend/.venv` with all dependencies installed. Your IDE should now be able to find all imports!

---

## VS Code Setup

### Step 1: Select Python Interpreter

1. Open VS Code in the project directory
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type "Python: Select Interpreter"
4. Choose: `./backend/.venv/bin/python`

### Step 2: Reload Window

1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "Developer: Reload Window"
3. All import errors should now be resolved!

### Step 3: Verify Settings

The `.vscode/settings.json` file has been created with:
- Python interpreter path pointing to `backend/.venv/bin/python`
- Python analysis extra paths including `backend/`
- Auto-formatting with Black
- Pytest configuration

---

## PyCharm Setup

### Step 1: Configure Python Interpreter

1. Open **Settings/Preferences** (`Cmd+,` on Mac, `Ctrl+Alt+S` on Windows/Linux)
2. Navigate to **Project** > **Python Interpreter**
3. Click the gear icon ⚙️ > **Add Interpreter** > **Existing**
4. Browse to: `/Users/rominmistry/Documents/Projects/estimation-generator/backend/.venv/bin/python`
5. Click **OK**

### Step 2: Mark Backend as Sources Root

1. Right-click on the `backend` folder in the Project view
2. Select **Mark Directory as** > **Sources Root**

### Step 3: Restart PyCharm

Close and reopen PyCharm for changes to take effect.

---

## Cursor / Other IDEs

### For Cursor (VS Code fork):
- Follow the same steps as VS Code above
- Ensure Cursor's Python extension is installed

### For Other IDEs:
1. Set Python interpreter to: `backend/.venv/bin/python`
2. Add `backend/` to the Python path
3. Restart the IDE

---

## Verification

To verify everything works, open any Python file (e.g., `backend/app/models/project.py`) and check:

✅ No red squiggly lines under imports
✅ Auto-complete works
✅ Go-to-definition works (Cmd+Click on imports)

---

## Running the Application

### Option 1: Using Docker (Production-like)

```bash
# Start all services (backend, frontend, database)
docker-compose up -d

# View logs
docker-compose logs -f backend

# Run migrations
docker-compose exec backend alembic upgrade head

# Stop services
docker-compose down
```

### Option 2: Using Local Virtual Environment (Development)

```bash
# Activate virtual environment
cd backend
source .venv/bin/activate

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your settings

# Run migrations
alembic upgrade head

# Start the development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## Troubleshooting

### Import errors still showing?

1. **Restart your IDE completely** (don't just reload)
2. Clear Python cache:
   ```bash
   cd backend
   find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
   find . -type f -name "*.pyc" -delete
   ```
3. Reinstall dependencies:
   ```bash
   cd backend
   rm -rf .venv
   ./setup_dev.sh
   ```

### Can't activate virtual environment?

**Mac/Linux:**
```bash
source backend/.venv/bin/activate
```

**Windows (PowerShell):**
```powershell
backend\.venv\Scripts\Activate.ps1
```

**Windows (CMD):**
```cmd
backend\.venv\Scripts\activate.bat
```

### SQLAlchemy/AsyncPG not found?

Make sure you're using the correct Python interpreter:
```bash
# Should show: backend/.venv/bin/python
which python

# Should list sqlalchemy, asyncpg, etc.
pip list | grep -E "sqlalchemy|asyncpg"
```

---

## Dependencies Installed

All dependencies from `backend/requirements.txt` are installed:

- ✅ FastAPI + Uvicorn (web framework)
- ✅ SQLAlchemy 2.0+ (async ORM)
- ✅ Alembic (database migrations)
- ✅ AsyncPG (PostgreSQL async driver)
- ✅ Pydantic (data validation)
- ✅ Redis (caching)
- ✅ Celery (background tasks)
- ✅ Boto3 (AWS S3)
- ✅ Pytest (testing)
- ✅ And more...

---

## Need Help?

If you're still experiencing issues:

1. Check that Python 3.10+ is installed: `python3 --version`
2. Verify virtual environment is activated: `which python`
3. Check dependencies are installed: `pip list`
4. Restart your IDE completely
5. Check the IDE's Python output panel for errors

---

## Summary

✅ Virtual environment created at `backend/.venv`
✅ All dependencies installed
✅ VS Code configuration created
✅ All imports verified working
✅ Platform enum updated to WordPress only

**You're all set! Happy coding! 🚀**
