# API Contracts Specification

## AI-Based Quote Generation Assistant

**Version:** 1.0.0
**Base URL:** `https://api.quoteassistant.com/v1`
**WebSocket URL:** `wss://api.quoteassistant.com/ws`

---

## Table of Contents

1. [API Overview](#1-api-overview)
2. [Authentication Endpoints](#2-authentication-endpoints)
3. [Project Endpoints](#3-project-endpoints)
4. [Quote Generation Endpoints](#4-quote-generation-endpoints)
5. [File Upload Endpoints](#5-file-upload-endpoints)
6. [Knowledge Base Management Endpoints](#6-knowledge-base-management-endpoints)
7. [Export Endpoints](#7-export-endpoints)
8. [Feedback Endpoints](#8-feedback-endpoints)
9. [WebSocket Events Specification](#9-websocket-events-specification)
10. [Error Response Formats](#10-error-response-formats)
11. [Rate Limiting Strategy](#11-rate-limiting-strategy)

---

## 1. API Overview

### 1.1 Architecture Summary

| Protocol | Purpose | Authentication |
|----------|---------|----------------|
| REST API | CRUD operations, file uploads, exports | JWT Bearer Token |
| WebSocket | Real-time collaborative editing | JWT via connection params |

### 1.2 Common Headers

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
Accept: application/json
X-Request-ID: <uuid>  # Optional, for request tracing
```

### 1.3 API Versioning

- Version included in URL path: `/v1/`
- Breaking changes will increment major version
- Deprecation notices provided 6 months in advance via `X-API-Deprecation` header

### 1.4 Pagination

All list endpoints support cursor-based pagination:

```json
{
  "data": [...],
  "pagination": {
    "cursor": "eyJpZCI6MTAwfQ==",
    "has_more": true,
    "total_count": 250
  }
}
```

**Query Parameters:**
- `cursor` (string): Opaque cursor for next page
- `limit` (integer): Items per page (default: 20, max: 100)

### 1.5 Timestamps

All timestamps are ISO 8601 format in UTC:
```
2024-01-15T14:30:00.000Z
```

---

## 2. Authentication Endpoints

### 2.1 Register User

Creates a new user account.

```
POST /auth/register
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "full_name": "John Doe",
  "company_name": "Acme Corp"
}
```

**Validation Rules:**
- `email`: Valid email format, max 255 characters
- `password`: Min 8 characters, must contain uppercase, lowercase, number, special character
- `full_name`: 2-100 characters
- `company_name`: Optional, max 200 characters

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_a1b2c3d4e5f6",
      "email": "user@example.com",
      "full_name": "John Doe",
      "company_name": "Acme Corp",
      "role": "PM",
      "created_at": "2024-01-15T14:30:00.000Z"
    },
    "message": "Registration successful. Please check your email to verify your account."
  }
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors
- `409 Conflict`: Email already registered

---

### 2.2 Login

Authenticates user and returns JWT tokens.

```
POST /auth/login
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_a1b2c3d4e5f6",
      "email": "user@example.com",
      "full_name": "John Doe",
      "role": "PM",
      "company_name": "Acme Corp"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "Bearer",
      "expires_in": 3600
    }
  }
}
```

**JWT Access Token Claims:**
```json
{
  "sub": "usr_a1b2c3d4e5f6",
  "email": "user@example.com",
  "role": "PM",
  "iat": 1705328400,
  "exp": 1705332000,
  "iss": "quote-assistant-api"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `403 Forbidden`: Account not verified or suspended
- `429 Too Many Requests`: Rate limit exceeded (5 attempts per 15 minutes)

---

### 2.3 Refresh Token

Exchanges refresh token for new access token.

```
POST /auth/refresh
```

**Request Body:**

```json
{
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 3600
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or expired refresh token

---

### 2.4 Request Password Reset

Initiates password reset flow via email.

```
POST /auth/password/reset-request
```

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "If an account exists with this email, a reset link has been sent."
  }
}
```

**Note:** Always returns 200 to prevent email enumeration attacks.

---

### 2.5 Reset Password

Completes password reset with token.

```
POST /auth/password/reset
```

**Request Body:**

```json
{
  "token": "reset_token_from_email",
  "new_password": "NewSecureP@ss456"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Password has been reset successfully. Please login with your new password."
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid or expired token, password validation failed
- `404 Not Found`: Token not found

---

### 2.6 Logout

Invalidates current session tokens.

```
POST /auth/logout
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

### 2.7 Get Current User

Returns authenticated user's profile.

```
GET /auth/me
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "usr_a1b2c3d4e5f6",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "PM",
    "company_name": "Acme Corp",
    "avatar_url": "https://cdn.quoteassistant.com/avatars/usr_a1b2c3d4e5f6.jpg",
    "created_at": "2024-01-15T14:30:00.000Z",
    "updated_at": "2024-01-20T10:00:00.000Z"
  }
}
```

---

## 3. Project Endpoints

### 3.1 Create Project

Creates a new project.

```
POST /projects
```

**Request Body:**

```json
{
  "name": "E-Commerce Platform Redesign",
  "description": "Complete redesign of the customer-facing e-commerce platform",
  "client_name": "Retail Corp",
  "client_email": "contact@retailcorp.com",
  "target_completion_date": "2024-06-30"
}
```

**Validation Rules:**
- `name`: Required, 3-200 characters
- `description`: Optional, max 2000 characters
- `client_name`: Optional, max 200 characters
- `client_email`: Optional, valid email format
- `target_completion_date`: Optional, ISO 8601 date, must be future

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "prj_x1y2z3a4b5c6",
    "name": "E-Commerce Platform Redesign",
    "description": "Complete redesign of the customer-facing e-commerce platform",
    "client_name": "Retail Corp",
    "client_email": "contact@retailcorp.com",
    "target_completion_date": "2024-06-30",
    "status": "active",
    "owner": {
      "id": "usr_a1b2c3d4e5f6",
      "full_name": "John Doe",
      "email": "john@example.com"
    },
    "team_members": [],
    "quotes_count": 0,
    "created_at": "2024-01-15T14:30:00.000Z",
    "updated_at": "2024-01-15T14:30:00.000Z"
  }
}
```

---

### 3.2 List User's Projects

Returns paginated list of projects the user owns or is a member of.

```
GET /projects
```

**Query Parameters:**
- `status` (string): Filter by status (`active`, `archived`, `completed`)
- `role` (string): Filter by user's role (`owner`, `member`)
- `search` (string): Search in name and description
- `sort_by` (string): Sort field (`created_at`, `updated_at`, `name`) - default: `updated_at`
- `sort_order` (string): `asc` or `desc` - default: `desc`
- `cursor` (string): Pagination cursor
- `limit` (integer): Items per page (default: 20, max: 100)

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "prj_x1y2z3a4b5c6",
      "name": "E-Commerce Platform Redesign",
      "description": "Complete redesign of the customer-facing e-commerce platform",
      "client_name": "Retail Corp",
      "status": "active",
      "owner": {
        "id": "usr_a1b2c3d4e5f6",
        "full_name": "John Doe"
      },
      "team_members_count": 3,
      "quotes_count": 5,
      "latest_quote": {
        "id": "qte_m1n2o3p4q5r6",
        "quote_number": "QTE-2024-0042",
        "version": 3,
        "status": "draft"
      },
      "user_role": "owner",
      "created_at": "2024-01-15T14:30:00.000Z",
      "updated_at": "2024-01-20T10:00:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6InByal94MXkyejNhNGI1YzYifQ==",
    "has_more": true,
    "total_count": 42
  }
}
```

---

### 3.3 Get Project by ID

Returns detailed project information.

```
GET /projects/{project_id}
```

**Path Parameters:**
- `project_id` (string): Project identifier

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "prj_x1y2z3a4b5c6",
    "name": "E-Commerce Platform Redesign",
    "description": "Complete redesign of the customer-facing e-commerce platform",
    "client_name": "Retail Corp",
    "client_email": "contact@retailcorp.com",
    "target_completion_date": "2024-06-30",
    "status": "active",
    "owner": {
      "id": "usr_a1b2c3d4e5f6",
      "full_name": "John Doe",
      "email": "john@example.com",
      "avatar_url": "https://cdn.quoteassistant.com/avatars/usr_a1b2c3d4e5f6.jpg"
    },
    "team_members": [
      {
        "id": "usr_b2c3d4e5f6g7",
        "full_name": "Jane Smith",
        "email": "jane@example.com",
        "role": "PM",
        "joined_at": "2024-01-16T09:00:00.000Z"
      }
    ],
    "quotes_count": 5,
    "requirements_count": 12,
    "created_at": "2024-01-15T14:30:00.000Z",
    "updated_at": "2024-01-20T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `404 Not Found`: Project does not exist
- `403 Forbidden`: User not authorized to view project

---

### 3.4 Update Project

Updates project details. Only owner can update.

```
PATCH /projects/{project_id}
```

**Request Body:**

```json
{
  "name": "E-Commerce Platform Redesign v2",
  "description": "Updated scope with mobile app",
  "status": "active",
  "target_completion_date": "2024-07-31"
}
```

**Note:** All fields are optional. Only provided fields are updated.

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "prj_x1y2z3a4b5c6",
    "name": "E-Commerce Platform Redesign v2",
    "description": "Updated scope with mobile app",
    "status": "active",
    "target_completion_date": "2024-07-31",
    "updated_at": "2024-01-21T11:00:00.000Z"
  }
}
```

---

### 3.5 Delete Project

Soft-deletes a project. Only owner can delete.

```
DELETE /projects/{project_id}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Project deleted successfully",
    "deleted_at": "2024-01-21T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `403 Forbidden`: Only owner can delete
- `409 Conflict`: Project has active quotes being edited

---

### 3.6 Invite Team Member

Invites a user to join the project.

```
POST /projects/{project_id}/members
```

**Request Body:**

```json
{
  "email": "newmember@example.com",
  "message": "Please join our project team!"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "invitation_id": "inv_j1k2l3m4n5o6",
    "email": "newmember@example.com",
    "status": "pending",
    "expires_at": "2024-01-22T14:30:00.000Z",
    "invited_by": {
      "id": "usr_a1b2c3d4e5f6",
      "full_name": "John Doe"
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: User already a member
- `403 Forbidden`: Only owner can invite
- `404 Not Found`: Project not found

---

### 3.7 List Project Members

Returns all members of a project.

```
GET /projects/{project_id}/members
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "owner": {
      "id": "usr_a1b2c3d4e5f6",
      "full_name": "John Doe",
      "email": "john@example.com",
      "avatar_url": "https://cdn.quoteassistant.com/avatars/usr_a1b2c3d4e5f6.jpg"
    },
    "members": [
      {
        "id": "usr_b2c3d4e5f6g7",
        "full_name": "Jane Smith",
        "email": "jane@example.com",
        "role": "PM",
        "joined_at": "2024-01-16T09:00:00.000Z"
      }
    ],
    "pending_invitations": [
      {
        "invitation_id": "inv_j1k2l3m4n5o6",
        "email": "pending@example.com",
        "invited_at": "2024-01-20T10:00:00.000Z",
        "expires_at": "2024-01-27T10:00:00.000Z"
      }
    ]
  }
}
```

---

### 3.8 Remove Team Member

Removes a member from the project. Owner only.

```
DELETE /projects/{project_id}/members/{user_id}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Member removed successfully"
  }
}
```

---

## 4. Quote Generation Endpoints

### 4.1 Generate Quote

Initiates AI-powered quote generation based on requirements.

```
POST /projects/{project_id}/quotes/generate
```

**Request Body:**

```json
{
  "requirements_text": "We need a mobile app with user authentication, push notifications, and offline support. The app should integrate with our existing REST API and support both iOS and Android platforms.",
  "attachment_ids": ["att_f1g2h3i4j5k6", "att_l7m8n9o0p1q2"],
  "generation_options": {
    "detail_level": "detailed",
    "include_assumptions": true,
    "include_risks": true,
    "estimation_approach": "three_point",
    "currency": "USD",
    "hourly_rate": 150
  }
}
```

**Validation Rules:**
- `requirements_text`: Required, 50-50000 characters
- `attachment_ids`: Optional, max 10 attachments
- `detail_level`: `summary`, `standard`, `detailed` - default: `standard`
- `estimation_approach`: `single_point`, `three_point`, `t_shirt` - default: `three_point`
- `currency`: ISO 4217 currency code - default: `USD`
- `hourly_rate`: 1-10000 - default: from user settings

**Response (202 Accepted):**

```json
{
  "success": true,
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6",
    "quote_number": "QTE-2024-0043",
    "version": 1,
    "status": "generating",
    "generation_job_id": "job_s1t2u3v4w5x6",
    "estimated_completion_seconds": 45,
    "created_at": "2024-01-21T14:30:00.000Z"
  }
}
```

**Note:** Quote generation is asynchronous. Poll status or use WebSocket for real-time updates.

---

### 4.2 Get Quote Generation Status

Checks the status of an ongoing quote generation.

```
GET /projects/{project_id}/quotes/{quote_id}/generation-status
```

**Response (200 OK) - In Progress:**

```json
{
  "success": true,
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6",
    "status": "generating",
    "progress": {
      "current_step": "analyzing_requirements",
      "steps_completed": 2,
      "total_steps": 5,
      "percentage": 40
    },
    "started_at": "2024-01-21T14:30:00.000Z"
  }
}
```

**Response (200 OK) - Completed:**

```json
{
  "success": true,
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6",
    "status": "completed",
    "progress": {
      "percentage": 100
    },
    "completed_at": "2024-01-21T14:30:45.000Z",
    "redirect_url": "/projects/prj_x1y2z3a4b5c6/quotes/qte_m1n2o3p4q5r6"
  }
}
```

**Generation Steps:**
1. `parsing_input` - Processing requirements text and attachments
2. `analyzing_requirements` - AI analysis of requirements
3. `retrieving_knowledge` - Fetching relevant knowledge base documents
4. `generating_estimate` - Creating time/cost estimates
5. `formatting_output` - Final quote formatting

---

### 4.3 Get Quote

Returns full quote details.

```
GET /projects/{project_id}/quotes/{quote_id}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "qte_m1n2o3p4q5r6",
    "quote_number": "QTE-2024-0043",
    "version": 1,
    "status": "draft",
    "project": {
      "id": "prj_x1y2z3a4b5c6",
      "name": "E-Commerce Platform Redesign"
    },
    "requirements": {
      "text": "We need a mobile app with user authentication...",
      "attachments": [
        {
          "id": "att_f1g2h3i4j5k6",
          "filename": "wireframes.pdf",
          "file_type": "application/pdf",
          "file_size": 2456789,
          "url": "https://cdn.quoteassistant.com/attachments/att_f1g2h3i4j5k6.pdf"
        }
      ]
    },
    "content": {
      "executive_summary": "This quote covers the development of a cross-platform mobile application...",
      "scope": {
        "included": [
          "User authentication with OAuth 2.0 and biometric support",
          "Push notification system with FCM and APNs",
          "Offline data sync with conflict resolution"
        ],
        "excluded": [
          "Backend API development (using existing)",
          "App store submission and management"
        ]
      },
      "deliverables": [
        {
          "id": "del_001",
          "name": "Authentication Module",
          "description": "Complete user auth flow including login, register, password reset",
          "estimate": {
            "optimistic_hours": 40,
            "most_likely_hours": 56,
            "pessimistic_hours": 80,
            "expected_hours": 57,
            "cost": 8550
          }
        },
        {
          "id": "del_002",
          "name": "Push Notifications",
          "description": "Cross-platform push notification implementation",
          "estimate": {
            "optimistic_hours": 24,
            "most_likely_hours": 32,
            "pessimistic_hours": 48,
            "expected_hours": 33,
            "cost": 4950
          }
        }
      ],
      "assumptions": [
        "Existing REST API is well-documented and stable",
        "Client will provide Apple Developer and Google Play accounts",
        "Design assets will be provided in Figma format"
      ],
      "risks": [
        {
          "description": "Third-party API changes may require additional work",
          "impact": "medium",
          "mitigation": "Include 10% buffer in timeline"
        }
      ],
      "timeline": {
        "estimated_start": "2024-02-01",
        "estimated_end": "2024-04-15",
        "milestones": [
          {
            "name": "Authentication Complete",
            "target_date": "2024-02-15"
          },
          {
            "name": "Core Features Complete",
            "target_date": "2024-03-15"
          },
          {
            "name": "Testing & Polish",
            "target_date": "2024-04-01"
          }
        ]
      },
      "totals": {
        "total_optimistic_hours": 200,
        "total_most_likely_hours": 280,
        "total_pessimistic_hours": 400,
        "total_expected_hours": 290,
        "total_cost": 43500,
        "currency": "USD",
        "hourly_rate": 150
      }
    },
    "generation_metadata": {
      "model_used": "anthropic/claude-3-opus",
      "knowledge_docs_used": ["kb_doc1", "kb_doc2"],
      "confidence_score": 0.85,
      "generation_time_seconds": 42
    },
    "created_by": {
      "id": "usr_a1b2c3d4e5f6",
      "full_name": "John Doe"
    },
    "created_at": "2024-01-21T14:30:00.000Z",
    "updated_at": "2024-01-21T14:30:45.000Z"
  }
}
```

---

### 4.4 Update Quote

Saves edits to a quote (manual edits or collaborative changes).

```
PATCH /projects/{project_id}/quotes/{quote_id}
```

**Request Body:**

```json
{
  "content": {
    "executive_summary": "Updated executive summary...",
    "deliverables": [
      {
        "id": "del_001",
        "estimate": {
          "optimistic_hours": 45,
          "most_likely_hours": 60,
          "pessimistic_hours": 85
        }
      }
    ]
  },
  "status": "draft"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "qte_m1n2o3p4q5r6",
    "version": 1,
    "status": "draft",
    "updated_at": "2024-01-21T15:00:00.000Z",
    "updated_by": {
      "id": "usr_a1b2c3d4e5f6",
      "full_name": "John Doe"
    }
  }
}
```

---

### 4.5 Create Quote Version

Creates a new version of an existing quote.

```
POST /projects/{project_id}/quotes/{quote_id}/versions
```

**Request Body:**

```json
{
  "version_note": "Updated estimates based on client feedback"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "qte_n2o3p4q5r6s7",
    "quote_number": "QTE-2024-0043",
    "version": 2,
    "parent_version_id": "qte_m1n2o3p4q5r6",
    "version_note": "Updated estimates based on client feedback",
    "status": "draft",
    "created_at": "2024-01-22T10:00:00.000Z"
  }
}
```

---

### 4.6 List Quote History

Returns all versions of quotes for a project.

```
GET /projects/{project_id}/quotes
```

**Query Parameters:**
- `status` (string): Filter by status (`draft`, `finalized`, `sent`, `accepted`, `rejected`)
- `cursor` (string): Pagination cursor
- `limit` (integer): Items per page

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "qte_n2o3p4q5r6s7",
      "quote_number": "QTE-2024-0043",
      "version": 2,
      "status": "draft",
      "totals": {
        "total_expected_hours": 310,
        "total_cost": 46500,
        "currency": "USD"
      },
      "created_by": {
        "id": "usr_a1b2c3d4e5f6",
        "full_name": "John Doe"
      },
      "created_at": "2024-01-22T10:00:00.000Z",
      "updated_at": "2024-01-22T10:00:00.000Z"
    },
    {
      "id": "qte_m1n2o3p4q5r6",
      "quote_number": "QTE-2024-0043",
      "version": 1,
      "status": "archived",
      "totals": {
        "total_expected_hours": 290,
        "total_cost": 43500,
        "currency": "USD"
      },
      "created_by": {
        "id": "usr_a1b2c3d4e5f6",
        "full_name": "John Doe"
      },
      "created_at": "2024-01-21T14:30:00.000Z",
      "updated_at": "2024-01-21T15:00:00.000Z"
    }
  ],
  "pagination": {
    "cursor": null,
    "has_more": false,
    "total_count": 2
  }
}
```

---

### 4.7 Delete Quote

Soft-deletes a quote. Only drafts can be deleted.

```
DELETE /projects/{project_id}/quotes/{quote_id}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Quote deleted successfully"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Cannot delete finalized/sent quotes
- `403 Forbidden`: Not authorized

---

## 5. File Upload Endpoints

### 5.1 Upload Attachment

Uploads a file (image or document) for use in quote generation.

```
POST /uploads/attachments
```

**Request:**
- Content-Type: `multipart/form-data`

**Form Fields:**
- `file` (required): The file to upload
- `project_id` (required): Associated project ID
- `description` (optional): File description

**Supported File Types:**
| Category | Extensions | Max Size |
|----------|------------|----------|
| Images | jpg, jpeg, png, gif, webp | 10 MB |
| Documents | pdf, doc, docx, xls, xlsx, ppt, pptx | 25 MB |
| Text | txt, md, csv | 5 MB |

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "att_f1g2h3i4j5k6",
    "filename": "requirements-diagram.png",
    "original_filename": "Requirements Diagram (Final).png",
    "file_type": "image/png",
    "file_size": 1456789,
    "url": "https://cdn.quoteassistant.com/attachments/att_f1g2h3i4j5k6.png",
    "thumbnail_url": "https://cdn.quoteassistant.com/attachments/att_f1g2h3i4j5k6_thumb.png",
    "project_id": "prj_x1y2z3a4b5c6",
    "uploaded_by": {
      "id": "usr_a1b2c3d4e5f6",
      "full_name": "John Doe"
    },
    "created_at": "2024-01-21T14:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid file type or size exceeded
- `413 Payload Too Large`: File exceeds maximum size
- `422 Unprocessable Entity`: Corrupt or unreadable file

---

### 5.2 List Project Attachments

Returns all attachments for a project.

```
GET /projects/{project_id}/attachments
```

**Query Parameters:**
- `file_type` (string): Filter by category (`image`, `document`, `text`)
- `cursor` (string): Pagination cursor
- `limit` (integer): Items per page

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "att_f1g2h3i4j5k6",
      "filename": "requirements-diagram.png",
      "file_type": "image/png",
      "file_size": 1456789,
      "url": "https://cdn.quoteassistant.com/attachments/att_f1g2h3i4j5k6.png",
      "thumbnail_url": "https://cdn.quoteassistant.com/attachments/att_f1g2h3i4j5k6_thumb.png",
      "used_in_quotes": ["qte_m1n2o3p4q5r6"],
      "uploaded_by": {
        "id": "usr_a1b2c3d4e5f6",
        "full_name": "John Doe"
      },
      "created_at": "2024-01-21T14:00:00.000Z"
    }
  ],
  "pagination": {
    "cursor": null,
    "has_more": false,
    "total_count": 5
  }
}
```

---

### 5.3 Delete Attachment

Deletes an attachment. Cannot delete if used in finalized quote.

```
DELETE /uploads/attachments/{attachment_id}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Attachment deleted successfully"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Attachment used in finalized quote
- `404 Not Found`: Attachment not found

---

### 5.4 Get Presigned Upload URL

Gets a presigned URL for direct upload to S3 (for large files).

```
POST /uploads/presigned-url
```

**Request Body:**

```json
{
  "filename": "large-document.pdf",
  "file_type": "application/pdf",
  "file_size": 15000000,
  "project_id": "prj_x1y2z3a4b5c6"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "upload_id": "upl_a1b2c3d4e5f6",
    "upload_url": "https://s3.amazonaws.com/quote-assistant-uploads/...",
    "fields": {
      "key": "uploads/upl_a1b2c3d4e5f6/large-document.pdf",
      "policy": "eyJleHBpcmF0aW9uIjo...",
      "x-amz-algorithm": "AWS4-HMAC-SHA256",
      "x-amz-credential": "AKIA.../us-east-1/s3/aws4_request",
      "x-amz-date": "20240121T140000Z",
      "x-amz-signature": "abc123..."
    },
    "expires_at": "2024-01-21T15:00:00.000Z"
  }
}
```

---

### 5.5 Confirm Upload

Confirms a presigned upload is complete and creates the attachment record.

```
POST /uploads/confirm
```

**Request Body:**

```json
{
  "upload_id": "upl_a1b2c3d4e5f6",
  "description": "Project requirements document"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "att_g2h3i4j5k6l7",
    "filename": "large-document.pdf",
    "file_type": "application/pdf",
    "file_size": 15000000,
    "url": "https://cdn.quoteassistant.com/attachments/att_g2h3i4j5k6l7.pdf",
    "project_id": "prj_x1y2z3a4b5c6",
    "created_at": "2024-01-21T14:05:00.000Z"
  }
}
```

---

## 6. Knowledge Base Management Endpoints

### 6.1 Upload Knowledge Base Document

Uploads a document to the knowledge base. **Admin only.**

```
POST /knowledge-base/documents
```

**Request:**
- Content-Type: `multipart/form-data`

**Form Fields:**
- `file` (required): The document file
- `title` (required): Document title
- `description` (optional): Document description
- `category` (optional): Document category
- `tags` (optional): Comma-separated tags

**Supported File Types:**
| Type | Extensions | Max Size |
|------|------------|----------|
| Documents | pdf, doc, docx | 50 MB |
| Text | txt, md | 10 MB |
| Spreadsheets | xls, xlsx, csv | 25 MB |

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "kb_d1e2f3g4h5i6",
    "title": "Mobile App Development Standards",
    "description": "Internal standards and best practices for mobile development",
    "filename": "mobile-dev-standards.pdf",
    "file_type": "application/pdf",
    "file_size": 3456789,
    "category": "Development Standards",
    "tags": ["mobile", "ios", "android", "standards"],
    "processing_status": "processing",
    "uploaded_by": {
      "id": "usr_admin123",
      "full_name": "Admin User"
    },
    "created_at": "2024-01-21T14:30:00.000Z"
  }
}
```

**Processing Status Values:**
- `processing`: Document is being parsed and indexed
- `completed`: Document is ready for use
- `failed`: Processing failed (see error details)

---

### 6.2 Get Document Processing Status

Checks the processing status of an uploaded knowledge base document.

```
GET /knowledge-base/documents/{document_id}/status
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "kb_d1e2f3g4h5i6",
    "processing_status": "completed",
    "processing_details": {
      "pages_processed": 45,
      "chunks_created": 128,
      "embeddings_generated": 128,
      "processing_time_seconds": 12
    },
    "completed_at": "2024-01-21T14:30:12.000Z"
  }
}
```

---

### 6.3 List Knowledge Base Documents

Returns paginated list of knowledge base documents.

```
GET /knowledge-base/documents
```

**Query Parameters:**
- `category` (string): Filter by category
- `tags` (string): Filter by tags (comma-separated, OR logic)
- `search` (string): Search in title and description
- `processing_status` (string): Filter by status
- `cursor` (string): Pagination cursor
- `limit` (integer): Items per page

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "kb_d1e2f3g4h5i6",
      "title": "Mobile App Development Standards",
      "description": "Internal standards and best practices for mobile development",
      "filename": "mobile-dev-standards.pdf",
      "file_type": "application/pdf",
      "file_size": 3456789,
      "category": "Development Standards",
      "tags": ["mobile", "ios", "android", "standards"],
      "processing_status": "completed",
      "usage_count": 15,
      "last_used_at": "2024-01-20T10:00:00.000Z",
      "uploaded_by": {
        "id": "usr_admin123",
        "full_name": "Admin User"
      },
      "created_at": "2024-01-21T14:30:00.000Z"
    }
  ],
  "pagination": {
    "cursor": null,
    "has_more": false,
    "total_count": 23
  }
}
```

---

### 6.4 Get Knowledge Base Document

Returns detailed document information.

```
GET /knowledge-base/documents/{document_id}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "kb_d1e2f3g4h5i6",
    "title": "Mobile App Development Standards",
    "description": "Internal standards and best practices for mobile development",
    "filename": "mobile-dev-standards.pdf",
    "file_type": "application/pdf",
    "file_size": 3456789,
    "download_url": "https://cdn.quoteassistant.com/knowledge-base/kb_d1e2f3g4h5i6.pdf",
    "category": "Development Standards",
    "tags": ["mobile", "ios", "android", "standards"],
    "processing_status": "completed",
    "processing_details": {
      "pages_processed": 45,
      "chunks_created": 128
    },
    "usage_stats": {
      "total_uses": 15,
      "quotes_using": ["qte_m1n2o3p4q5r6", "qte_n2o3p4q5r6s7"],
      "last_used_at": "2024-01-20T10:00:00.000Z"
    },
    "uploaded_by": {
      "id": "usr_admin123",
      "full_name": "Admin User"
    },
    "created_at": "2024-01-21T14:30:00.000Z",
    "updated_at": "2024-01-21T14:30:12.000Z"
  }
}
```

---

### 6.5 Update Knowledge Base Document

Updates document metadata. **Admin only.**

```
PATCH /knowledge-base/documents/{document_id}
```

**Request Body:**

```json
{
  "title": "Updated Mobile Development Standards 2024",
  "description": "Updated standards including Flutter guidelines",
  "category": "Development Standards",
  "tags": ["mobile", "ios", "android", "flutter", "standards"]
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "kb_d1e2f3g4h5i6",
    "title": "Updated Mobile Development Standards 2024",
    "description": "Updated standards including Flutter guidelines",
    "category": "Development Standards",
    "tags": ["mobile", "ios", "android", "flutter", "standards"],
    "updated_at": "2024-01-22T10:00:00.000Z"
  }
}
```

---

### 6.6 Delete Knowledge Base Document

Deletes a knowledge base document. **Admin only.**

```
DELETE /knowledge-base/documents/{document_id}
```

**Query Parameters:**
- `force` (boolean): Force delete even if used in quotes (default: false)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Document deleted successfully"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Document in use, use `force=true` to override
- `403 Forbidden`: Admin access required

---

### 6.7 List Knowledge Base Categories

Returns all categories with document counts.

```
GET /knowledge-base/categories
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "name": "Development Standards",
      "document_count": 12
    },
    {
      "name": "Past Projects",
      "document_count": 45
    },
    {
      "name": "Industry Benchmarks",
      "document_count": 8
    }
  ]
}
```

---

## 7. Export Endpoints

### 7.1 Export Quote to PDF

Generates a PDF export of the quote.

```
POST /projects/{project_id}/quotes/{quote_id}/export/pdf
```

**Request Body:**

```json
{
  "template": "professional",
  "include_sections": {
    "executive_summary": true,
    "scope": true,
    "deliverables": true,
    "timeline": true,
    "assumptions": true,
    "risks": true,
    "terms_and_conditions": true
  },
  "branding": {
    "company_logo_url": "https://example.com/logo.png",
    "primary_color": "#2563eb",
    "include_footer": true
  },
  "metadata": {
    "prepared_for": "Retail Corp",
    "prepared_by": "John Doe, Project Manager",
    "valid_until": "2024-02-21"
  }
}
```

**Available Templates:**
- `professional`: Clean, corporate-friendly design
- `minimal`: Simple, text-focused layout
- `detailed`: Comprehensive with all sections expanded

**Response (202 Accepted):**

```json
{
  "success": true,
  "data": {
    "export_job_id": "exp_j1k2l3m4n5o6",
    "status": "processing",
    "format": "pdf",
    "estimated_completion_seconds": 15,
    "created_at": "2024-01-21T15:00:00.000Z"
  }
}
```

---

### 7.2 Export Quote to DOCX

Generates a Word document export of the quote.

```
POST /projects/{project_id}/quotes/{quote_id}/export/docx
```

**Request Body:**

```json
{
  "template": "editable",
  "include_sections": {
    "executive_summary": true,
    "scope": true,
    "deliverables": true,
    "timeline": true,
    "assumptions": true,
    "risks": true
  },
  "include_comments": false,
  "metadata": {
    "author": "John Doe",
    "company": "Acme Corp"
  }
}
```

**Available Templates:**
- `editable`: Fully editable document with styling
- `print_ready`: Optimized for printing

**Response (202 Accepted):**

```json
{
  "success": true,
  "data": {
    "export_job_id": "exp_k2l3m4n5o6p7",
    "status": "processing",
    "format": "docx",
    "estimated_completion_seconds": 10,
    "created_at": "2024-01-21T15:00:00.000Z"
  }
}
```

---

### 7.3 Get Export Status

Checks the status of an export job.

```
GET /exports/{export_job_id}/status
```

**Response (200 OK) - In Progress:**

```json
{
  "success": true,
  "data": {
    "export_job_id": "exp_j1k2l3m4n5o6",
    "status": "processing",
    "progress_percentage": 60,
    "started_at": "2024-01-21T15:00:00.000Z"
  }
}
```

**Response (200 OK) - Completed:**

```json
{
  "success": true,
  "data": {
    "export_job_id": "exp_j1k2l3m4n5o6",
    "status": "completed",
    "format": "pdf",
    "download_url": "https://cdn.quoteassistant.com/exports/exp_j1k2l3m4n5o6.pdf",
    "download_url_expires_at": "2024-01-21T16:00:00.000Z",
    "file_size": 456789,
    "completed_at": "2024-01-21T15:00:12.000Z"
  }
}
```

**Export Status Values:**
- `processing`: Export is being generated
- `completed`: Export ready for download
- `failed`: Export generation failed

---

### 7.4 Download Export

Direct download of completed export.

```
GET /exports/{export_job_id}/download
```

**Response (302 Found):**
Redirects to the download URL with presigned S3 link.

**Response Headers:**
```
Location: https://cdn.quoteassistant.com/exports/exp_j1k2l3m4n5o6.pdf?...
Content-Disposition: attachment; filename="QTE-2024-0043_v1.pdf"
```

**Error Responses:**
- `404 Not Found`: Export not found or expired
- `409 Conflict`: Export still processing

---

### 7.5 List Export History

Returns history of exports for a quote.

```
GET /projects/{project_id}/quotes/{quote_id}/exports
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "export_job_id": "exp_j1k2l3m4n5o6",
      "format": "pdf",
      "template": "professional",
      "status": "completed",
      "file_size": 456789,
      "download_url": "https://cdn.quoteassistant.com/exports/exp_j1k2l3m4n5o6.pdf",
      "download_url_expires_at": "2024-01-22T15:00:00.000Z",
      "created_by": {
        "id": "usr_a1b2c3d4e5f6",
        "full_name": "John Doe"
      },
      "created_at": "2024-01-21T15:00:00.000Z"
    }
  ],
  "pagination": {
    "cursor": null,
    "has_more": false,
    "total_count": 3
  }
}
```

---

## 8. Feedback Endpoints

### 8.1 Submit Feedback

Submits feedback (thumbs up/down) for a generated quote.

```
POST /projects/{project_id}/quotes/{quote_id}/feedback
```

**Request Body:**

```json
{
  "rating": "positive",
  "feedback_categories": ["accuracy", "completeness"],
  "comment": "The estimates were very accurate and matched our historical data well.",
  "specific_feedback": [
    {
      "deliverable_id": "del_001",
      "rating": "positive",
      "comment": "Auth estimate was spot-on"
    },
    {
      "deliverable_id": "del_002",
      "rating": "negative",
      "comment": "Push notifications estimate seems low"
    }
  ]
}
```

**Validation Rules:**
- `rating`: Required, `positive` or `negative`
- `feedback_categories`: Optional array from predefined list
- `comment`: Optional, max 2000 characters
- `specific_feedback`: Optional, per-deliverable feedback

**Feedback Categories:**
- `accuracy`: Estimate accuracy
- `completeness`: Coverage of requirements
- `clarity`: Clarity of output
- `assumptions`: Quality of assumptions
- `risks`: Risk identification
- `formatting`: Output formatting
- `speed`: Generation speed

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "feedback_id": "fb_p1q2r3s4t5u6",
    "quote_id": "qte_m1n2o3p4q5r6",
    "rating": "positive",
    "feedback_categories": ["accuracy", "completeness"],
    "submitted_by": {
      "id": "usr_a1b2c3d4e5f6",
      "full_name": "John Doe"
    },
    "created_at": "2024-01-21T16:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid rating or categories
- `409 Conflict`: Feedback already submitted for this quote by this user

---

### 8.2 Update Feedback

Updates previously submitted feedback.

```
PATCH /projects/{project_id}/quotes/{quote_id}/feedback/{feedback_id}
```

**Request Body:**

```json
{
  "rating": "negative",
  "comment": "After review, the estimates were actually off by 30%"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "feedback_id": "fb_p1q2r3s4t5u6",
    "rating": "negative",
    "comment": "After review, the estimates were actually off by 30%",
    "updated_at": "2024-01-25T10:00:00.000Z"
  }
}
```

---

### 8.3 Get Feedback Stats

Returns aggregated feedback statistics. **Admin only** for global stats, users can see their own project stats.

```
GET /feedback/stats
```

**Query Parameters:**
- `project_id` (string): Filter by project (optional)
- `date_from` (string): Start date filter (ISO 8601)
- `date_to` (string): End date filter (ISO 8601)
- `group_by` (string): Group results by `day`, `week`, `month`

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_feedback": 156,
      "positive_count": 128,
      "negative_count": 28,
      "positive_rate": 0.821,
      "average_rating_trend": "improving"
    },
    "by_category": {
      "accuracy": {
        "positive": 95,
        "negative": 12,
        "positive_rate": 0.888
      },
      "completeness": {
        "positive": 88,
        "negative": 18,
        "positive_rate": 0.830
      },
      "clarity": {
        "positive": 102,
        "negative": 8,
        "positive_rate": 0.927
      }
    },
    "timeline": [
      {
        "period": "2024-01-15",
        "positive": 12,
        "negative": 3,
        "positive_rate": 0.80
      },
      {
        "period": "2024-01-16",
        "positive": 15,
        "negative": 2,
        "positive_rate": 0.882
      }
    ],
    "recent_negative_feedback": [
      {
        "feedback_id": "fb_x1y2z3a4b5c6",
        "quote_id": "qte_abc123",
        "comment": "Estimates were significantly lower than actual",
        "categories": ["accuracy"],
        "created_at": "2024-01-20T14:00:00.000Z"
      }
    ]
  }
}
```

---

### 8.4 Get Quote Feedback

Returns all feedback for a specific quote.

```
GET /projects/{project_id}/quotes/{quote_id}/feedback
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "feedback_id": "fb_p1q2r3s4t5u6",
      "rating": "positive",
      "feedback_categories": ["accuracy", "completeness"],
      "comment": "The estimates were very accurate",
      "specific_feedback": [
        {
          "deliverable_id": "del_001",
          "deliverable_name": "Authentication Module",
          "rating": "positive",
          "comment": "Auth estimate was spot-on"
        }
      ],
      "submitted_by": {
        "id": "usr_a1b2c3d4e5f6",
        "full_name": "John Doe"
      },
      "created_at": "2024-01-21T16:00:00.000Z",
      "updated_at": "2024-01-21T16:00:00.000Z"
    }
  ]
}
```

---

## 9. WebSocket Events Specification

### 9.1 Connection

**WebSocket URL:**
```
wss://api.quoteassistant.com/ws
```

**Connection Parameters:**
```
wss://api.quoteassistant.com/ws?token=<jwt_access_token>&project_id=<project_id>
```

**Connection Lifecycle:**

```
Client                                  Server
  |                                        |
  |------ WebSocket Connect -------------->|
  |<----- connection:established ----------|
  |                                        |
  |------ quote:join ---------------------->|
  |<----- quote:joined --------------------|
  |<----- quote:state ---------------------|
  |                                        |
  |<----- quote:update (from others) ------|
  |------ quote:update (own changes) ----->|
  |<----- quote:update:ack ----------------|
  |                                        |
  |------ quote:leave -------------------->|
  |<----- quote:left ----------------------|
  |                                        |
  |------ disconnect ---------------------->|
```

### 9.2 Event Types

#### 9.2.1 Connection Events

**connection:established**

Sent by server upon successful WebSocket connection.

```json
{
  "event": "connection:established",
  "data": {
    "connection_id": "conn_a1b2c3d4e5f6",
    "user": {
      "id": "usr_a1b2c3d4e5f6",
      "full_name": "John Doe"
    },
    "server_time": "2024-01-21T14:30:00.000Z"
  }
}
```

**connection:error**

Sent when connection fails.

```json
{
  "event": "connection:error",
  "data": {
    "code": "AUTH_FAILED",
    "message": "Invalid or expired token"
  }
}
```

**Error Codes:**
- `AUTH_FAILED`: Invalid token
- `AUTH_EXPIRED`: Token expired
- `PROJECT_ACCESS_DENIED`: No access to project
- `RATE_LIMITED`: Too many connections

---

#### 9.2.2 Quote Collaboration Events

**quote:join** (Client -> Server)

Joins a quote editing session.

```json
{
  "event": "quote:join",
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6"
  }
}
```

**quote:joined** (Server -> Client)

Confirms quote session joined.

```json
{
  "event": "quote:joined",
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6",
    "active_users": [
      {
        "id": "usr_a1b2c3d4e5f6",
        "full_name": "John Doe",
        "cursor_position": null,
        "color": "#2563eb"
      },
      {
        "id": "usr_b2c3d4e5f6g7",
        "full_name": "Jane Smith",
        "cursor_position": {
          "section": "deliverables",
          "deliverable_id": "del_001"
        },
        "color": "#dc2626"
      }
    ]
  }
}
```

**quote:state** (Server -> Client)

Sends full quote state upon joining.

```json
{
  "event": "quote:state",
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6",
    "version": 1,
    "revision": 42,
    "content": {
      "executive_summary": "...",
      "deliverables": [...]
    },
    "last_updated_at": "2024-01-21T14:30:00.000Z",
    "last_updated_by": {
      "id": "usr_b2c3d4e5f6g7",
      "full_name": "Jane Smith"
    }
  }
}
```

**quote:update** (Bidirectional)

Sends/receives quote content changes using operational transformation.

```json
{
  "event": "quote:update",
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6",
    "client_revision": 42,
    "operations": [
      {
        "op": "replace",
        "path": "/content/deliverables/0/estimate/most_likely_hours",
        "value": 64,
        "previous_value": 56
      }
    ],
    "client_id": "conn_a1b2c3d4e5f6",
    "timestamp": "2024-01-21T14:35:00.000Z"
  }
}
```

**Operation Types:**
- `replace`: Replace value at path
- `add`: Add new item (for arrays)
- `remove`: Remove item
- `move`: Move item (for reordering)

**quote:update:ack** (Server -> Client)

Acknowledges update receipt with new revision.

```json
{
  "event": "quote:update:ack",
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6",
    "client_revision": 42,
    "server_revision": 43,
    "status": "accepted"
  }
}
```

**Status Values:**
- `accepted`: Update applied
- `rejected`: Conflict detected, client should refresh
- `transformed`: Update applied with transformation

**quote:update:rejected** (Server -> Client)

Sent when update cannot be applied.

```json
{
  "event": "quote:update:rejected",
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6",
    "client_revision": 42,
    "reason": "REVISION_CONFLICT",
    "message": "Quote has been modified. Please refresh to get latest version.",
    "current_revision": 45
  }
}
```

---

#### 9.2.3 Presence Events

**presence:cursor** (Bidirectional)

Broadcasts cursor position to other users.

```json
{
  "event": "presence:cursor",
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6",
    "user_id": "usr_a1b2c3d4e5f6",
    "cursor_position": {
      "section": "deliverables",
      "deliverable_id": "del_001",
      "field": "estimate.most_likely_hours"
    }
  }
}
```

**presence:user_joined** (Server -> Client)

Broadcast when a user joins the quote session.

```json
{
  "event": "presence:user_joined",
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6",
    "user": {
      "id": "usr_c3d4e5f6g7h8",
      "full_name": "Bob Wilson",
      "color": "#059669"
    }
  }
}
```

**presence:user_left** (Server -> Client)

Broadcast when a user leaves the quote session.

```json
{
  "event": "presence:user_left",
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6",
    "user_id": "usr_c3d4e5f6g7h8"
  }
}
```

---

#### 9.2.4 Quote Generation Events

**generation:started** (Server -> Client)

Notifies that quote generation has started.

```json
{
  "event": "generation:started",
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6",
    "job_id": "job_s1t2u3v4w5x6",
    "started_by": {
      "id": "usr_a1b2c3d4e5f6",
      "full_name": "John Doe"
    },
    "started_at": "2024-01-21T14:30:00.000Z"
  }
}
```

**generation:progress** (Server -> Client)

Real-time progress updates during generation.

```json
{
  "event": "generation:progress",
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6",
    "job_id": "job_s1t2u3v4w5x6",
    "current_step": "analyzing_requirements",
    "steps_completed": 2,
    "total_steps": 5,
    "percentage": 40,
    "message": "Analyzing requirements and extracting features..."
  }
}
```

**generation:completed** (Server -> Client)

Notifies that quote generation is complete.

```json
{
  "event": "generation:completed",
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6",
    "job_id": "job_s1t2u3v4w5x6",
    "completed_at": "2024-01-21T14:30:45.000Z",
    "generation_time_seconds": 45
  }
}
```

**generation:failed** (Server -> Client)

Notifies that quote generation failed.

```json
{
  "event": "generation:failed",
  "data": {
    "quote_id": "qte_m1n2o3p4q5r6",
    "job_id": "job_s1t2u3v4w5x6",
    "error_code": "LLM_TIMEOUT",
    "message": "AI service did not respond in time. Please try again.",
    "failed_at": "2024-01-21T14:31:00.000Z"
  }
}
```

---

#### 9.2.5 System Events

**ping/pong** (Bidirectional)

Heartbeat to maintain connection.

```json
{
  "event": "ping",
  "data": {
    "timestamp": "2024-01-21T14:30:00.000Z"
  }
}
```

```json
{
  "event": "pong",
  "data": {
    "timestamp": "2024-01-21T14:30:00.000Z"
  }
}
```

**system:maintenance** (Server -> Client)

Warns of upcoming maintenance.

```json
{
  "event": "system:maintenance",
  "data": {
    "message": "System maintenance in 15 minutes. Please save your work.",
    "maintenance_starts_at": "2024-01-21T15:00:00.000Z",
    "estimated_duration_minutes": 30
  }
}
```

---

### 9.3 WebSocket Error Handling

**Reconnection Strategy:**

1. On disconnect, wait 1 second then reconnect
2. Use exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
3. After successful reconnect, rejoin quote session
4. Request state sync to catch up on missed updates

**Error Event:**

```json
{
  "event": "error",
  "data": {
    "code": "QUOTE_LOCKED",
    "message": "Quote is currently locked for export",
    "retry_after_seconds": 30
  }
}
```

**Common Error Codes:**
- `QUOTE_NOT_FOUND`: Quote does not exist
- `QUOTE_LOCKED`: Quote temporarily locked
- `ACCESS_DENIED`: No permission for operation
- `INVALID_OPERATION`: Malformed operation
- `RATE_LIMITED`: Too many operations

---

## 10. Error Response Formats

### 10.1 Standard Error Response

All API errors follow this consistent structure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "code": "INVALID_FORMAT"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters",
        "code": "MIN_LENGTH"
      }
    ],
    "request_id": "req_a1b2c3d4e5f6",
    "timestamp": "2024-01-21T14:30:00.000Z",
    "documentation_url": "https://docs.quoteassistant.com/errors/VALIDATION_ERROR"
  }
}
```

### 10.2 HTTP Status Code Mapping

| Status Code | Usage |
|-------------|-------|
| 200 OK | Successful GET, PATCH, DELETE |
| 201 Created | Successful POST creating resource |
| 202 Accepted | Async operation initiated |
| 204 No Content | Successful operation, no response body |
| 400 Bad Request | Invalid request syntax or validation error |
| 401 Unauthorized | Missing or invalid authentication |
| 403 Forbidden | Valid auth but insufficient permissions |
| 404 Not Found | Resource does not exist |
| 409 Conflict | Resource state conflict |
| 413 Payload Too Large | Request body exceeds limit |
| 422 Unprocessable Entity | Semantically invalid request |
| 429 Too Many Requests | Rate limit exceeded |
| 500 Internal Server Error | Unexpected server error |
| 502 Bad Gateway | Upstream service error |
| 503 Service Unavailable | Temporary overload or maintenance |

### 10.3 Error Code Reference

#### Authentication Errors (AUTH_*)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| AUTH_INVALID_CREDENTIALS | 401 | Email or password incorrect |
| AUTH_TOKEN_EXPIRED | 401 | JWT access token expired |
| AUTH_TOKEN_INVALID | 401 | JWT malformed or signature invalid |
| AUTH_REFRESH_TOKEN_EXPIRED | 401 | Refresh token expired |
| AUTH_ACCOUNT_SUSPENDED | 403 | Account has been suspended |
| AUTH_EMAIL_NOT_VERIFIED | 403 | Email verification required |
| AUTH_MFA_REQUIRED | 403 | Multi-factor auth required |

#### Validation Errors (VALIDATION_*)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | One or more fields invalid |
| VALIDATION_REQUIRED_FIELD | 400 | Required field missing |
| VALIDATION_INVALID_FORMAT | 400 | Field format incorrect |
| VALIDATION_OUT_OF_RANGE | 400 | Value outside allowed range |
| VALIDATION_INVALID_ENUM | 400 | Value not in allowed set |

#### Resource Errors (RESOURCE_*)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| RESOURCE_NOT_FOUND | 404 | Requested resource not found |
| RESOURCE_ALREADY_EXISTS | 409 | Resource already exists |
| RESOURCE_CONFLICT | 409 | Resource state conflict |
| RESOURCE_LOCKED | 423 | Resource temporarily locked |

#### Permission Errors (PERMISSION_*)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| PERMISSION_DENIED | 403 | Insufficient permissions |
| PERMISSION_OWNER_REQUIRED | 403 | Owner role required |
| PERMISSION_ADMIN_REQUIRED | 403 | Admin role required |

#### Rate Limit Errors (RATE_*)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| RATE_LIMIT_QUOTA_EXCEEDED | 429 | Monthly quota exceeded |

#### Generation Errors (GENERATION_*)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| GENERATION_FAILED | 500 | Quote generation failed |
| GENERATION_TIMEOUT | 504 | Generation timed out |
| GENERATION_LLM_ERROR | 502 | LLM service error |
| GENERATION_INSUFFICIENT_INPUT | 400 | Requirements too vague |

#### File Errors (FILE_*)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| FILE_TOO_LARGE | 413 | File exceeds size limit |
| FILE_TYPE_NOT_ALLOWED | 400 | File type not supported |
| FILE_CORRUPT | 422 | File cannot be processed |
| FILE_UPLOAD_FAILED | 500 | Upload to storage failed |

### 10.4 Error Response Examples

**Validation Error:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "requirements_text",
        "message": "Requirements must be at least 50 characters",
        "code": "MIN_LENGTH",
        "constraint": {
          "min": 50,
          "actual": 23
        }
      }
    ],
    "request_id": "req_a1b2c3d4e5f6",
    "timestamp": "2024-01-21T14:30:00.000Z"
  }
}
```

**Authentication Error:**

```json
{
  "success": false,
  "error": {
    "code": "AUTH_TOKEN_EXPIRED",
    "message": "Your session has expired. Please log in again.",
    "request_id": "req_b2c3d4e5f6g7",
    "timestamp": "2024-01-21T14:30:00.000Z"
  }
}
```

**Rate Limit Error:**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait before trying again.",
    "retry_after_seconds": 60,
    "limit": {
      "requests": 100,
      "window_seconds": 60,
      "remaining": 0,
      "reset_at": "2024-01-21T14:31:00.000Z"
    },
    "request_id": "req_c3d4e5f6g7h8",
    "timestamp": "2024-01-21T14:30:00.000Z"
  }
}
```

**Server Error:**

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred. Our team has been notified.",
    "request_id": "req_d4e5f6g7h8i9",
    "timestamp": "2024-01-21T14:30:00.000Z",
    "support_reference": "ERR-2024012114300-D4E5F6"
  }
}
```

---

## 11. Rate Limiting Strategy

### 11.1 Rate Limit Tiers

| Tier | Applies To | Requests/Minute | Requests/Hour | Requests/Day |
|------|------------|-----------------|---------------|--------------|
| Standard | All authenticated users | 100 | 2,000 | 20,000 |
| Heavy Endpoints | Quote generation, exports | 10 | 100 | 500 |
| Auth Endpoints | Login, register, password reset | 5 | 30 | 100 |
| Admin Endpoints | Knowledge base management | 50 | 1,000 | 10,000 |
| WebSocket | Messages per connection | 60 | N/A | N/A |

### 11.2 Rate Limit Headers

All responses include rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705846260
X-RateLimit-Window: 60
```

| Header | Description |
|--------|-------------|
| X-RateLimit-Limit | Maximum requests allowed in window |
| X-RateLimit-Remaining | Requests remaining in current window |
| X-RateLimit-Reset | Unix timestamp when window resets |
| X-RateLimit-Window | Window size in seconds |

### 11.3 Rate Limit Response

When rate limit is exceeded:

**HTTP Status:** 429 Too Many Requests

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please wait before making more requests.",
    "retry_after_seconds": 45,
    "limit": {
      "tier": "standard",
      "requests": 100,
      "window_seconds": 60,
      "remaining": 0,
      "reset_at": "2024-01-21T14:31:00.000Z"
    }
  }
}
```

**Response Header:**
```
Retry-After: 45
```

### 11.4 Rate Limit Bypass

For approved integrations, rate limits can be increased:

**Request Header:**
```
X-API-Key: api_key_with_elevated_limits
```

### 11.5 Endpoint-Specific Limits

**Quote Generation:**
- 10 concurrent generation jobs per user
- 100 generations per day per user
- 5-minute timeout per generation

**File Uploads:**
- 100 MB total uploads per hour
- 10 concurrent uploads
- 50 MB max single file

**Exports:**
- 50 exports per hour
- 5 concurrent export jobs

**WebSocket:**
- 5 connections per user
- 60 messages per minute per connection
- 10 KB max message size

### 11.6 Handling Rate Limits (Client Best Practices)

1. **Check headers proactively** - Monitor `X-RateLimit-Remaining`
2. **Implement exponential backoff** - On 429, wait `Retry-After` seconds
3. **Queue requests** - Spread requests over time
4. **Cache responses** - Reduce duplicate requests
5. **Use webhooks** - For generation status instead of polling

**Example Backoff Implementation:**

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 60;
      await sleep(retryAfter * 1000 * Math.pow(2, attempt));
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}
```

---

## Appendix A: Data Type Definitions

### A.1 ID Formats

All resource IDs are prefixed for type safety:

| Prefix | Resource |
|--------|----------|
| `usr_` | User |
| `prj_` | Project |
| `qte_` | Quote |
| `att_` | Attachment |
| `kb_` | Knowledge Base Document |
| `fb_` | Feedback |
| `inv_` | Invitation |
| `exp_` | Export Job |
| `job_` | Background Job |
| `conn_` | WebSocket Connection |

### A.2 Enum Values

**User Roles:**
- `Admin`
- `PM`

**Project Status:**
- `active`
- `archived`
- `completed`

**Quote Status:**
- `generating`
- `draft`
- `finalized`
- `sent`
- `accepted`
- `rejected`
- `archived`

**Feedback Rating:**
- `positive`
- `negative`

**Export Format:**
- `pdf`
- `docx`

### A.3 Common Field Constraints

| Field Type | Constraints |
|------------|-------------|
| email | RFC 5322 compliant, max 255 chars |
| password | Min 8 chars, uppercase, lowercase, number, special |
| name | 2-200 characters |
| description | Max 2000 characters |
| comment | Max 2000 characters |
| requirements_text | 50-50000 characters |
| currency | ISO 4217 (3 letters) |
| hourly_rate | 1-10000 |

---

## Appendix B: Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-21 | Initial API specification |

---

*Document maintained by the Product Orchestrator. Last updated: 2024-01-21*
