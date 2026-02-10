# Track 1: Project Storage and Retrieval Bug Fixes

**Priority**: HIGH
**Status**: Not Started
**Est. Effort**: 8-12 hours
**Dependencies**: None (can start immediately)

---

## Executive Summary

Projects are not being stored or fetched correctly in the database. When users click on a project from the dashboard, they encounter errors. This requires investigation of the project API endpoints, database queries, and frontend service integration.

---

## Problem Statement

### Current Behavior
1. Projects may not be saving correctly to the database
2. Clicking on project from dashboard gives error
3. Project detail page fails to load

### Issues Reported
- "Projects not being stored/fetched correctly"
- "Clicking on project from dashboard gives error"
- Need to investigate project service and API

---

## Investigation Areas

### 1. Backend API Investigation

**Files to Investigate**:
- `/Users/deeptrivedi/estimation/backend/app/api/v1/projects.py`
- `/Users/deeptrivedi/estimation/backend/app/models/project.py`
- `/Users/deeptrivedi/estimation/backend/app/schemas/project.py`

**Potential Issues**:

#### A. Project Creation Endpoint
```python
# File: backend/app/api/v1/projects.py
# Line: ~51-98

@router.post("", response_model=ProjectDataResponse, ...)
async def create_project(...):
    # Check:
    # 1. Are all required fields being set?
    # 2. Is the commit succeeding?
    # 3. Are relationships being established correctly?
    # 4. Is created_by being set from current_user.id?
```

**Things to Verify**:
- Database session commit is successful
- No constraint violations
- UUID generation working correctly
- Timestamps being set properly
- Platform enum values matching frontend expectations

#### B. Project Retrieval Endpoint
```python
# File: backend/app/api/v1/projects.py
# Line: ~237-311

@router.get("/{project_id}", response_model=ProjectDetailDataResponse, ...)
async def get_project(project_id: UUID, ...):
    # Check:
    # 1. Is the query finding the project?
    # 2. Are relationships being loaded (selectinload)?
    # 3. Is the response schema correct?
    # 4. Are quote_count and message_count queries working?
```

**Potential Issues**:
- project_id UUID parsing failing
- Relationship not being loaded (creator)
- Access check failing incorrectly
- Count queries returning None instead of 0

#### C. Project List Endpoint
```python
# File: backend/app/api/v1/projects.py
# Line: ~111-222

@router.get("", response_model=ProjectListResponse, ...)
async def list_projects(...):
    # Check:
    # 1. Is pagination working correctly?
    # 2. Are filters being applied properly?
    # 3. Are counts being calculated correctly for each project?
```

**Potential Issues**:
- N+1 query problem (getting counts for each project individually)
- Pagination offset calculation error
- Filter logic bugs

---

### 2. Frontend Service Investigation

**Files to Investigate**:
- `/Users/deeptrivedi/estimation/frontend/src/services/projects.service.ts`
- `/Users/deeptrivedi/estimation/frontend/src/pages/ProjectDetail.tsx`
- `/Users/deeptrivedi/estimation/frontend/src/types/project.ts`

**Potential Issues**:

#### A. API Response Handling
```typescript
// File: frontend/src/services/projects.service.ts
// Line: ~55-60

get: async (projectId: string): Promise<Project> => {
  const response = await apiClient.get<ApiResponse<Project>>(
    `/api/v1/projects/${projectId}`
  );
  return response.data.data;
}
```

**Things to Check**:
- Is the response structure matching the backend?
- Is the data nested correctly (response.data.data)?
- Are errors being caught and handled?

**Backend Response Structure**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Project Name",
    "description": "...",
    "platform": "wordpress",
    "status": "active",
    "created_by": "user-uuid",
    "created_at": "2026-01-21T...",
    "updated_at": "2026-01-21T...",
    "quote_count": 0,
    "message_count": 0,
    "creator_name": "John Doe",
    "creator_email": "john@example.com"
  }
}
```

#### B. Type Definitions
```typescript
// File: frontend/src/types/project.ts

// Verify types match backend schema exactly
interface Project {
  id: string;
  name: string;
  description?: string;
  platform?: ProjectPlatform;
  status: ProjectStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  quote_count: number;  // May be missing?
  message_count: number;  // May be missing?
  // ... other fields
}
```

**Potential Issues**:
- Type mismatch between frontend and backend
- Optional fields that should be required
- Missing fields that backend provides

#### C. Project Detail Page
```typescript
// File: frontend/src/pages/ProjectDetail.tsx
// Line: ~352-370

useEffect(() => {
  if (!id) return;

  const loadProject = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const projectData = await projectsService.get(id);
      setProject(projectData);
    } catch (err) {
      setError('Failed to load project. Please try again.');
      console.error('Failed to load project:', err);
    } finally {
      setIsLoading(false);
    }
  };

  loadProject();
}, [id]);
```

**Things to Check**:
- Is `id` from URL params valid UUID?
- Is error being logged to console (check browser console)?
- Is the error response giving details about the failure?

---

### 3. Database Schema Verification

**Check Migrations**:
```bash
# File: backend/alembic/versions/20260121_000001_add_project_quote_chat_models.py

# Verify:
# 1. projects table exists
# 2. All columns are present
# 3. Foreign key constraints are correct
# 4. Indexes exist for performance
```

**Database Query to Check**:
```sql
-- Connect to PostgreSQL
docker-compose exec db psql -U postgres -d quote_assistant

-- Check projects table structure
\d projects

-- Check if any projects exist
SELECT id, name, created_by, created_at FROM projects LIMIT 5;

-- Check for orphaned data
SELECT COUNT(*) FROM projects WHERE created_by IS NULL;

-- Check relationships
SELECT p.id, p.name, u.email
FROM projects p
LEFT JOIN users u ON p.created_by = u.id
LIMIT 5;
```

---

## Debugging Approach

### Step 1: Enable Detailed Logging

**Backend Logging**:
```python
# File: backend/app/api/v1/projects.py

import logging
logger = logging.getLogger(__name__)

@router.get("/{project_id}", ...)
async def get_project(project_id: UUID, ...):
    logger.info(f"Fetching project: {project_id}")
    logger.info(f"Current user: {current_user.id} ({current_user.email})")

    query = select(Project).options(selectinload(Project.creator)).where(Project.id == project_id)
    result = await db.execute(query)
    project = result.scalar_one_or_none()

    logger.info(f"Query result: {project}")

    if project is None:
        logger.warning(f"Project not found: {project_id}")
        raise HTTPException(...)

    logger.info(f"Project found: {project.name}, owner: {project.created_by}")
    # ...
```

**Frontend Logging**:
```typescript
// File: frontend/src/services/projects.service.ts

get: async (projectId: string): Promise<Project> => {
  console.log('[ProjectService] Fetching project:', projectId);

  try {
    const response = await apiClient.get<ApiResponse<Project>>(
      `/api/v1/projects/${projectId}`
    );
    console.log('[ProjectService] Response:', response);
    console.log('[ProjectService] Data:', response.data);

    return response.data.data;
  } catch (error) {
    console.error('[ProjectService] Error fetching project:', error);
    console.error('[ProjectService] Error response:', error.response);
    throw error;
  }
}
```

### Step 2: Test API Directly

**Using curl**:
```bash
# 1. Login to get token
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.data.access_token')

# 2. Create a project
curl -X POST http://localhost:8000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "description": "Testing project creation",
    "platform": "wordpress"
  }' | jq

# 3. List projects
curl -X GET http://localhost:8000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. Get specific project (use ID from create response)
PROJECT_ID="uuid-from-create-response"
curl -X GET http://localhost:8000/api/v1/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Step 3: Check Database State

```bash
# Access database
docker-compose exec db psql -U postgres -d quote_assistant

# Check if project was created
SELECT * FROM projects ORDER BY created_at DESC LIMIT 1;

# Check user relationship
SELECT p.id, p.name, p.created_by, u.email, u.full_name
FROM projects p
LEFT JOIN users u ON p.created_by = u.id
ORDER BY p.created_at DESC
LIMIT 5;
```

---

## Common Issues and Fixes

### Issue 1: UUID Format Mismatch

**Symptom**: "Invalid UUID format" error

**Fix**: Ensure frontend sends UUID as string without dashes or with dashes consistently
```typescript
// If backend expects UUID with dashes
const projectId = '550e8400-e29b-41d4-a716-446655440000';

// Not this
const projectId = '550e8400e29b41d4a716446655440000';
```

### Issue 2: Response Schema Mismatch

**Symptom**: Data is undefined or missing fields

**Backend sends**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "...",
    "quote_count": 0
  }
}
```

**Frontend expects**:
```typescript
// Wrong
return response.data;

// Correct
return response.data.data;
```

### Issue 3: Missing Creator Relationship

**Symptom**: `project.creator` is null causing errors

**Fix**: Add selectinload to query
```python
query = (
    select(Project)
    .options(selectinload(Project.creator))  # This line is critical
    .where(Project.id == project_id)
)
```

### Issue 4: Count Queries Returning None

**Symptom**: `quote_count` or `message_count` is null/undefined

**Fix**: Ensure scalar returns 0 instead of None
```python
# Wrong
quote_count = quote_count_result.scalar()

# Correct
quote_count = quote_count_result.scalar() or 0
```

### Issue 5: CORS Issues

**Symptom**: Network error, CORS policy blocking request

**Check**: Backend CORS configuration
```python
# File: backend/app/main.py or docker-compose.yml

CORS_ORIGINS=["http://localhost:3000","http://frontend:3000"]
```

---

## Implementation Checklist

### Investigation Phase
- [ ] Check backend logs for errors during project creation
- [ ] Check backend logs for errors during project retrieval
- [ ] Check frontend console for network errors
- [ ] Test API endpoints directly with curl
- [ ] Verify database schema is correct
- [ ] Check if any projects exist in database
- [ ] Verify user authentication is working

### Bug Identification
- [ ] Identify exact error message
- [ ] Reproduce issue consistently
- [ ] Determine if issue is frontend, backend, or database
- [ ] Check if issue affects all projects or specific ones
- [ ] Verify issue happens for all users or specific users

### Fix Implementation
- [ ] Fix identified backend issues
- [ ] Fix identified frontend issues
- [ ] Add proper error handling
- [ ] Add validation where needed
- [ ] Update types if schema changed

### Testing
- [ ] Test project creation
- [ ] Test project list retrieval
- [ ] Test project detail retrieval
- [ ] Test project update
- [ ] Test project delete
- [ ] Test with different users
- [ ] Test error cases (not found, unauthorized)

### Code Quality
- [ ] Add comprehensive error logging
- [ ] Add input validation
- [ ] Add unit tests for bug fixes
- [ ] Update API documentation if needed

---

## Testing Plan

### Manual Testing

1. **Create Project Flow**
   - Navigate to /projects/new
   - Fill in project details
   - Submit form
   - Verify success message
   - Verify redirect to project detail page
   - Verify project appears in projects list

2. **View Project Flow**
   - Navigate to /projects
   - Click on a project card
   - Verify project detail page loads
   - Verify all project information displays correctly
   - Verify tabs work (Chat, Quotes, Settings)

3. **Update Project Flow**
   - From project detail page, click Edit
   - Update project details
   - Save changes
   - Verify updates are reflected

### Automated Testing

**Backend Tests** (`backend/tests/test_projects.py`):
```python
import pytest
from httpx import AsyncClient

async def test_create_project(client: AsyncClient, auth_headers):
    """Test project creation."""
    response = await client.post(
        "/api/v1/projects",
        json={
            "name": "Test Project",
            "description": "Test description",
            "platform": "wordpress"
        },
        headers=auth_headers
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["name"] == "Test Project"
    assert data["data"]["id"] is not None

async def test_get_project(client: AsyncClient, auth_headers, test_project):
    """Test getting project by ID."""
    response = await client.get(
        f"/api/v1/projects/{test_project.id}",
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["id"] == str(test_project.id)
    assert data["data"]["name"] == test_project.name

async def test_get_nonexistent_project(client: AsyncClient, auth_headers):
    """Test getting project that doesn't exist."""
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    response = await client.get(
        f"/api/v1/projects/{fake_uuid}",
        headers=auth_headers
    )

    assert response.status_code == 404
    data = response.json()
    assert "PROJECT_NOT_FOUND" in str(data)

async def test_list_projects(client: AsyncClient, auth_headers):
    """Test listing projects."""
    response = await client.get(
        "/api/v1/projects",
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "data" in data
    assert "projects" in data["data"]
    assert "pagination" in data["data"]
```

---

## Success Criteria

1. Projects are created successfully without errors
2. Projects appear in the project list immediately after creation
3. Clicking on a project from dashboard loads the detail page
4. All project information displays correctly on detail page
5. Quote count and message count display correctly
6. No console errors in browser
7. No backend errors in logs
8. All CRUD operations work correctly

---

## Estimated Effort Breakdown

| Task | Hours |
|------|-------|
| Investigation and debugging | 3h |
| Backend fixes | 2h |
| Frontend fixes | 2h |
| Testing and validation | 2h |
| Error handling improvements | 1h |
| Documentation updates | 1h |
| Buffer for unexpected issues | 2h |
| **TOTAL** | **13h** |

---

## Dependencies

**None** - This is a bug fix that can be implemented independently.

---

## Risk Mitigation

### Risk: Issue may be in Docker networking
**Mitigation**: Test API endpoints from both host and within Docker network

### Risk: Database migration issue
**Mitigation**: Check alembic version, run migrations again if needed

### Risk: Cached data causing issues
**Mitigation**: Clear browser cache, restart backend service

---

## Follow-up Tasks

After fixing the bugs:
1. Add integration tests to prevent regression
2. Add monitoring/alerting for project operations
3. Improve error messages for better debugging
4. Add database indexes if queries are slow
5. Consider adding request/response logging middleware
