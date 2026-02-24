# Document-Aware Content Quality Check

## Goal

Make the content quality check consider **form fields + uploaded/source document text** together. Only show "content too vague" when **both** the form and any attached documents are thin. When the user has uploaded a detailed SOW or requirements file, a brief description in the form should be sufficient.

## Current Behavior

- **Check input**: Only `project_name`, `description`, `additional_instructions` (form fields).
- **Quote generation**: Builds `canonical_brief` from form + `Document.plain_text` (requirement docs). So the model already sees documents at estimate time.
- **Gap**: Quality check is blind to documents → user can see "too vague" even when they uploaded a full SOW.

## Design

### 1. Backend: Extend check request and logic

- **Schema** (`CheckContentQualityRequest`):
  - `document_text: Optional[str] = None` — combined plain text from attached/source documents (e.g. SOW). When provided, the LLM evaluates form + document together.
  - `project_id: Optional[UUID] = None` — when provided (and user has access), load requirement documents for that project and use their `plain_text` as document context. Merged with `document_text` if both are present.
- **API** (`POST /projects/check-content-quality`):
  - Inject `DbSession` when `project_id` is in the request.
  - If `project_id` is set: resolve project, load `Document.plain_text` for `document_type=REQUIREMENTS`, combine (e.g. `"\n\n---\n\n".join`), cap total size (e.g. 50k chars), merge with any request `document_text`.
  - Pass combined `document_text` to LLM service.
- **Prompt** (`build_content_quality_prompt`):
  - Add optional `document_text`. When present, add a section "## Attached/source document (e.g. SOW, requirements)" and instruct: if the document contains substantial scope (pages, features, timeline), treat overall content as sufficient even if the description field is brief; only flag as insufficient when **both** form and document are vague or missing.
- **LLM service** (`check_content_quality`):
  - Add parameter `document_text: Optional[str] = None`; pass through to prompt.

### 2. Backend: Extract-text endpoint (no project)

- **New endpoint**: `POST /api/v1/files/extract-text`
  - Body: multipart file upload (single file).
  - Auth: required.
  - Response: `{ "success": true, "data": { "plain_text": "..." } }`.
  - Uses existing `document_parsing_service.extract_text_with_vision`. Same extensions as requirement uploads (PDF, DOCX, TXT, MD, images). No project_id; used only to feed into content quality check before project exists.

### 3. Frontend

- **Types**: Add `document_text?: string` and `project_id?: string` to `CheckContentQualityRequest`.
- **Upload service**: Add `extractText(file: File): Promise<string>` calling `POST /api/v1/files/extract-text`, returning `data.plain_text`.
- **Projects service**: `checkContentQuality` sends optional `document_text` and `project_id` in the request body.
- **NewProject page**: Before calling `checkContentQuality`:
  - If `formData.files` has any requirement-type files, call `extractText` for each (in parallel), combine with `"\n\n---\n\n"`, pass as `document_text` (optionally cap length client-side, e.g. 45k chars).
  - When we later have a project context (e.g. estimate page), callers can pass `project_id` so backend loads documents.

## Files to Touch

| Layer        | File(s) |
|-------------|---------|
| Backend     | `app/schemas/project.py` — extend `CheckContentQualityRequest` |
| Backend     | `app/api/v1/projects.py` — inject db when project_id, load docs, pass document_text |
| Backend     | `app/api/v1/files.py` — add `POST /extract-text` |
| Backend     | `app/services/ai/prompts.py` — extend `build_content_quality_prompt` |
| Backend     | `app/services/ai/llm_service.py` — `check_content_quality(..., document_text=...)` |
| Frontend    | `src/types/project.ts` — optional `document_text`, `project_id` |
| Frontend    | `src/services/upload.service.ts` — `extractText(file)` |
| Frontend    | `src/services/projects.service.ts` — pass optional fields |
| Frontend    | `src/pages/NewProject.tsx` — extract text from selected files, pass to check |

## Out of Scope

- No change to quote generation brief building (already uses documents).
- No new DB migrations.
