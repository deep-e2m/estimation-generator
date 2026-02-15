# Feature Specification: Inline Tiptap Editor in Estimation Preview Panel

**Status:** Draft
**Created:** 2026-02-13
**Author:** Product Orchestrator
**Priority:** High
**Estimated Complexity:** Large (L)

---

## 1. Overview

### 1.1 Goal

Replace the read-only `QuoteDocument` preview in the right panel of `EstimationSplitView` with an inline Tiptap rich-text editor, enabling users to directly edit AI-generated estimate content without leaving the split-view workflow.

### 1.2 Problem Statement

Currently, the estimation split view has a read-only preview on the right (`QuoteDocument`) and a chat panel on the left. When users want to manually edit the estimate content, they must navigate to a separate full-page editor (`QuoteEdit.tsx`), breaking their workflow context. The AI chat can refine content conversationally, but fine-grained text editing (fixing typos, rewording paragraphs, adjusting formatting) requires the separate editor page.

### 1.3 Success Criteria

- Users can toggle between a read-only preview and an editable Tiptap editor inline within the right panel of the split view
- Editing supports rich text formatting (bold, italic, underline, headings, lists, alignment)
- Changes auto-save after a configurable debounce interval
- Users can manually trigger save via button or Ctrl+S
- Users can export edited content as PDF or DOCX directly from the preview panel
- Edited content persists to the backend via the existing `PUT /api/v1/quotes/{quote_id}` endpoint
- The chat panel on the left continues to work; AI refinements update the editor content in real time

---

## 2. Current Architecture Analysis

### 2.1 Component Hierarchy (Right Panel)

```
EstimationSplitView
  |-- EstimationChatPanel (left, 35%)
  |-- EstimationPreviewPanel (right, 65%)
        |-- QuoteDocument (read-only rendering)
              |-- MarkdownBody (for markdown-only content)
              |-- Structured sections (deliverables, scope, risks, etc.)
```

### 2.2 Data Flow (Current)

```
Backend DB (quotes.content = markdown string)
  --> API: GET /api/v1/quotes/{quote_id}
    --> quote-normalizer.ts: normalizeQuoteFromApi()
      --> ApiQuote.content (string) becomes QuoteContent.executive_summary (string)
      --> Metadata breakdown becomes QuoteContent.deliverables[]
      --> Metadata assumptions becomes QuoteContent.assumptions[]
      --> Metadata exclusions becomes QuoteContent.scope.excluded[]
    --> EstimationSplitView holds currentQuote state
      --> EstimationPreviewPanel receives quote prop
        --> QuoteDocument renders structured sections OR MarkdownBody
```

### 2.3 Key Insight: Backend Content is a Markdown String

The backend `Quote.content` column is a `Text` field containing the full AI-generated markdown string. The frontend `quote-normalizer.ts` parses this into structured `QuoteContent` with `executive_summary`, `deliverables`, `scope`, etc. However, for markdown-only content (detected by `isMarkdownOnlyContent()`), the entire string is rendered as markdown via `MarkdownBody`.

This means:
- The Tiptap editor will work with the **raw content string** (markdown/HTML), not the parsed `QuoteContent` structure
- A conversion function is needed to transform `QuoteContent` back into a single HTML string for the editor
- When saving, the editor HTML content replaces `Quote.content` on the backend

### 2.4 Existing Reusable Components

| Component | Location | What to Reuse |
|---|---|---|
| `AdvancedEditor` | `frontend/src/components/editor/AdvancedEditor/AdvancedEditor.tsx` | Tiptap setup, toolbar buttons, extensions, keyboard shortcuts, save handler |
| `editor.css` | `frontend/src/components/editor/AdvancedEditor/editor.css` | Editor styling |
| `CommentPlugin` | `frontend/src/components/editor/AdvancedEditor/CommentPlugin.tsx` | Not needed for inline editor (Phase 2 consideration) |
| `ExportDialog` | `frontend/src/components/quote/ExportDialog.tsx` | Export format selection UI and download logic |
| `quoteService.exportQuote()` | `frontend/src/services/quote-generation.service.ts` | Direct blob download for PDF/DOCX |
| `quotesService.update()` | `frontend/src/services/quotes.service.ts` | Quote update API call |
| `useUpdateQuote` | `frontend/src/hooks/useQuotes.ts` | React Query mutation for quote updates |
| `convertQuoteToHtml()` | `frontend/src/pages/QuoteEdit.tsx` | Quote-to-HTML conversion (needs adaptation) |

### 2.5 Existing Backend Capabilities

| Capability | Endpoint | Notes |
|---|---|---|
| Update quote content | `PUT /api/v1/quotes/{quote_id}` | Accepts `{ content: string }` -- only for `draft` status quotes |
| Export DOCX | `POST /api/v1/projects/{pid}/quotes/{qid}/export/docx` | Reads `quote.content` (string) and `quote.extra_data` (metadata) |
| Export PDF | `POST /api/v1/projects/{pid}/quotes/{qid}/export/pdf` | Same pattern as DOCX |
| Refine quote | `POST /api/v1/projects/{pid}/quotes/{qid}/refine` | Returns updated content string |

---

## 3. Proposed Architecture

### 3.1 New Component Hierarchy

```
EstimationSplitView
  |-- EstimationChatPanel (left)
  |-- EstimationPreviewPanel (right) -- MODIFIED
        |-- PreviewToolbar (NEW)
        |     |-- Edit/Preview toggle button
        |     |-- Save button + save status indicator
        |     |-- Export dropdown (PDF / DOCX)
        |     |-- Formatting toolbar (visible only in edit mode)
        |-- QuoteDocument (existing, shown in preview mode)
        |-- InlineQuoteEditor (NEW, shown in edit mode)
              |-- Uses Tiptap with extensions from AdvancedEditor
              |-- Document-style editing area
```

### 3.2 Data Flow (Proposed)

```
                  +-----------------------+
                  |   EstimationSplitView |
                  |   (currentQuote state)|
                  +-----------+-----------+
                              |
                  +-----------v-----------+
                  | EstimationPreviewPanel|
                  |  mode: 'preview'|'edit'|
                  +-----------+-----------+
                              |
              +---------------+---------------+
              |                               |
    +---------v---------+          +----------v----------+
    |   QuoteDocument   |          |  InlineQuoteEditor  |
    | (read-only render)|          | (Tiptap editable)   |
    +-------------------+          +----------+----------+
                                              |
                                   quoteToHtml(quote)
                                   htmlToQuoteContent(html)
                                              |
                                   +----------v----------+
                                   | Save: PUT /quotes/id|
                                   | content = html string|
                                   +---------------------+
```

### 3.3 Content Conversion Strategy

**Quote to HTML (for editor initialization):**

The existing `convertQuoteToHtml()` in `QuoteEdit.tsx` already does this. It will be extracted into a shared utility at `frontend/src/lib/quote-to-html.ts` and enhanced to handle both structured content and markdown-only content.

```
QuoteContent --> quoteContentToHtml() --> HTML string for Tiptap
```

Logic:
1. If `isMarkdownOnlyContent(content)` is true, convert the `executive_summary` markdown to HTML using a markdown-to-HTML library (or Tiptap's built-in markdown parsing)
2. If structured content, build HTML from sections (executive summary, scope, deliverables, assumptions, risks, timeline) -- same as existing `convertQuoteToHtml()`

**HTML to Backend Content (for saving):**

When saving from the editor, the Tiptap HTML is sent directly as the `content` string to the backend. The backend `QuoteUpdate` schema accepts `content: Optional[str]`. This is the simplest path and maintains compatibility with the existing export services that parse the content string.

```
Tiptap editor.getHTML() --> PUT /quotes/{id} { content: htmlString }
```

The backend export services (`DocxExportService`) already parse content strings for structure (headings, bullet points, numbered lists). HTML tags will need minor handling -- see Backend Tasks section.

### 3.4 Bidirectional Sync: Chat Refinements and Editor

When the user refines via chat (left panel), `EstimationSplitView.handleQuoteUpdate` fires with the new `Quote` object. The editor must update its content to reflect the AI changes.

Strategy:
- `InlineQuoteEditor` watches for `quote` prop changes
- On change, compare new content with current editor content
- If different (AI updated it), replace editor content with `editor.commands.setContent(newHtml)`
- Guard against save loops: set a `skipNextSave` flag when content is externally updated

---

## 4. Detailed Component Specifications

### 4.1 `PreviewToolbar` Component

**File:** `frontend/src/components/estimate/preview/PreviewToolbar.tsx`

**Props:**
```typescript
interface PreviewToolbarProps {
  mode: 'preview' | 'edit';
  onModeChange: (mode: 'preview' | 'edit') => void;
  onSave: () => void;
  onExport: (format: 'pdf' | 'docx') => void;
  isSaving: boolean;
  lastSavedAt: Date | null;
  hasUnsavedChanges: boolean;
  isQuoteEditable: boolean; // false if quote status is not 'draft'
  editor: Editor | null; // Tiptap editor instance (for formatting toolbar)
}
```

**Behavior:**
- Shows Edit/Preview toggle as a segmented control (same pattern as `QuoteEdit.tsx`)
- When `mode === 'edit'`, shows the formatting toolbar below the toggle (undo/redo, headings, bold/italic/underline/strikethrough, lists, alignment)
- Shows save button with spinner when saving, checkmark when saved
- Shows "Unsaved changes" indicator when `hasUnsavedChanges` is true
- Export dropdown with PDF and DOCX options
- Edit toggle is disabled (grayed out with tooltip) when `isQuoteEditable` is false
- Formatting toolbar reuses `ToolbarButton` and `ToolbarDivider` from `AdvancedEditor.tsx` -- extract these to shared components

**Formatting Toolbar Actions (reused from AdvancedEditor):**
- Undo / Redo
- Block type selector (Paragraph, H1, H2, H3, Blockquote, Code Block)
- Bold, Italic, Underline, Strikethrough
- Bullet List, Ordered List
- Align Left, Center, Right

### 4.2 `InlineQuoteEditor` Component

**File:** `frontend/src/components/estimate/preview/InlineQuoteEditor.tsx`

**Props:**
```typescript
interface InlineQuoteEditorProps {
  quote: Quote;
  onContentChange: (html: string) => void;
  onSave: (html: string) => Promise<void>;
  editorRef?: React.MutableRefObject<Editor | null>;
  className?: string;
}
```

**Behavior:**
- Initializes Tiptap editor with extensions: `StarterKit`, `Underline`, `TextAlign`, `Placeholder`
- Converts `quote.content` to HTML via `quoteContentToHtml()` on mount
- Calls `onContentChange` on every edit (debounced for auto-save upstream)
- Exposes editor instance via `editorRef` for toolbar control
- Styled to look like a document (white background, max-width container, appropriate padding) -- reuse `editor.css` styling with `.editor-content-editable` class
- Handles external content updates (from AI refinement) by watching `quote` prop changes
- Supports Ctrl+S keyboard shortcut for manual save

**Tiptap Extensions (same as AdvancedEditor):**
```typescript
extensions: [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Placeholder.configure({ placeholder: 'Start editing your estimate...' }),
]
```

**No new Tiptap dependencies required** -- all extensions are already in `package.json`.

### 4.3 Modified `EstimationPreviewPanel`

**File:** `frontend/src/components/estimate/EstimationPreviewPanel.tsx` (modified)

**Updated Props:**
```typescript
interface EstimationPreviewPanelProps {
  quote: Quote;
  project: Project;
  recentChanges?: ChangeDescription[];
  onQuoteSaved?: (updatedQuote: Quote) => void;
}
```

**New Internal State:**
```typescript
const [mode, setMode] = useState<'preview' | 'edit'>('preview');
const [isSaving, setIsSaving] = useState(false);
const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
const [editorContent, setEditorContent] = useState<string>('');
const editorRef = useRef<Editor | null>(null);
```

**Key Logic:**
- `isQuoteEditable` derived from `quote.status === 'draft'`
- Auto-save: debounce `editorContent` changes by 3 seconds, then call save
- Manual save: `handleSave()` calls `quotesService.update(quoteId, { content: editorContent })`
- Export: triggers `quoteService.exportQuote(projectId, quoteId, format)` (uses existing service)
- Unsaved changes warning via `beforeunload` event listener
- On successful save, calls `onQuoteSaved` to propagate updated quote back to parent

### 4.4 Modified `EstimationSplitView`

**File:** `frontend/src/components/estimate/EstimationSplitView.tsx` (modified)

**Changes:**
- Pass `project` prop to `EstimationPreviewPanel`
- Add `onQuoteSaved` handler that updates `currentQuote` state (same as `handleQuoteUpdate` but without changes)
- Ensure AI refinement updates propagate to the editor via the quote prop chain

---

## 5. Shared Utilities

### 5.1 `quoteContentToHtml()` -- Extract and Enhance

**File:** `frontend/src/lib/quote-to-html.ts`

```typescript
/**
 * Convert a Quote's content to HTML suitable for the Tiptap editor.
 * Handles both structured QuoteContent and markdown-only content.
 */
export function quoteContentToHtml(quote: Quote): string
```

**Logic:**

1. Check `isMarkdownOnlyContent(quote.content)`:
   - If true: the `executive_summary` IS the full markdown content. Convert markdown to HTML.
   - If false: build HTML from structured sections (same approach as `convertQuoteToHtml` in `QuoteEdit.tsx`).

2. For structured content, generate sections:
   - `<h1>Executive Summary</h1><p>...</p>`
   - `<h2>Scope</h2><h3>Included</h3><ul>...</ul><h3>Excluded</h3><ul>...</ul>`
   - `<h2>Deliverables</h2>` with name, description, hours for each
   - `<h2>Assumptions</h2><ul>...</ul>`
   - `<h2>Risks & Mitigation</h2>` with impact and mitigation for each
   - `<h2>Timeline</h2>` with milestones
   - `<h2>Summary</h2>` with total hours

3. For markdown content:
   - Use a lightweight markdown-to-HTML converter. Options:
     - `marked` (already commonly used) -- would need to add as dependency
     - Manual regex conversion for basic markdown (headers, bold, italic, lists, links)
     - Tiptap's built-in `generateHTML` from JSON (if we parse markdown to ProseMirror doc first)
   - Recommended: Use Tiptap's `setContent` with markdown string directly (Tiptap's StarterKit can parse basic HTML; convert markdown headers/lists/bold to HTML first with a simple utility)

### 5.2 Toolbar Shared Components -- Extract from AdvancedEditor

**File:** `frontend/src/components/editor/shared/ToolbarButton.tsx`
**File:** `frontend/src/components/editor/shared/ToolbarDivider.tsx`

Extract the `ToolbarButton` and `ToolbarDivider` components from `AdvancedEditor.tsx` into shared files so both `AdvancedEditor` and `InlineQuoteEditor` (via `PreviewToolbar`) can use them.

---

## 6. Backend Changes

### 6.1 Content Format Compatibility

**Current state:** The backend stores `content` as a plain text/markdown string. The `DocxExportService` parses this string looking for markdown patterns (headers with `#`, bullet points with `-/*`, numbered lists with `1.`).

**After this feature:** The editor will save HTML content (e.g., `<h1>Executive Summary</h1><p>...</p>`). The export service needs to handle HTML content in addition to markdown.

### 6.2 New Backend Endpoint: Save Edited HTML Content

**No new endpoint needed.** The existing `PUT /api/v1/quotes/{quote_id}` endpoint accepts `{ content: string }` and stores it directly. The editor's HTML output is a valid string.

However, the `QuoteUpdate` schema currently validates `content` with `min_length=1`. This is sufficient. No schema changes needed.

### 6.3 Backend Export Service: HTML-Aware Parsing

**File:** `backend/app/services/export/docx_service.py` (modified)

The `DocxExportService._add_scope_of_work()` and related methods parse `data.content` as markdown/text. When the editor saves HTML content, these parsers will encounter HTML tags instead of markdown.

**Required change:** Add an HTML-to-text/structure converter that runs before the existing markdown parsing logic. This strips HTML tags and/or converts them to the markdown equivalents that the existing parser expects.

Options:
1. **Convert HTML to markdown on save (frontend)**: Before sending to backend, convert Tiptap HTML to markdown using `turndown` or similar. This preserves backend compatibility but loses rich formatting.
2. **Add HTML parsing to export service (backend)**: Use `BeautifulSoup` (already likely available via WeasyPrint dependency) to parse HTML content and extract structure. This is the cleaner approach.
3. **Store both formats**: Save HTML as `content` and also save a `content_html` field. This adds schema complexity.

**Recommended approach: Option 2** -- Modify `DocxExportService` to detect HTML content (check for `<` tags) and parse accordingly using `BeautifulSoup` or Python's `html.parser`. If no HTML tags detected, fall back to existing markdown parsing.

```python
def _is_html_content(self, content: str) -> bool:
    """Check if content is HTML (from Tiptap editor) vs plain markdown."""
    return bool(re.search(r'<(?:h[1-6]|p|ul|ol|li|strong|em)\b', content))

def _parse_html_content(self, content: str) -> list[tuple[str, str]]:
    """Parse HTML content into structured sections for DOCX generation."""
    from bs4 import BeautifulSoup
    # Extract headings and their content blocks
    ...
```

### 6.4 Backend Export Service: PDF Template

If a PDF export exists using Jinja2 + WeasyPrint, the same HTML detection and handling applies. The PDF template may actually benefit from receiving HTML content directly since WeasyPrint renders HTML natively.

---

## 7. Task Breakdown

### Frontend Tasks

| Task ID | Title | Description | Dependencies | Estimated Effort | Assigned Role |
|---------|-------|-------------|--------------|-----------------|---------------|
| FE-001 | Extract shared toolbar components | Move `ToolbarButton` and `ToolbarDivider` from `AdvancedEditor.tsx` into `frontend/src/components/editor/shared/`. Update `AdvancedEditor` imports. | None | S | frontend-developer |
| FE-002 | Create `quoteContentToHtml` utility | Create `frontend/src/lib/quote-to-html.ts` with `quoteContentToHtml(quote)` function. Handle both markdown-only and structured content. Include unit tests. | None | M | frontend-developer |
| FE-003 | Create `InlineQuoteEditor` component | Build Tiptap editor component at `frontend/src/components/estimate/preview/InlineQuoteEditor.tsx`. Reuse extensions from `AdvancedEditor`. Accept quote prop, convert to HTML, expose editor ref, handle content changes and external updates. | FE-002 | L | frontend-developer |
| FE-004 | Create `PreviewToolbar` component | Build toolbar at `frontend/src/components/estimate/preview/PreviewToolbar.tsx`. Include edit/preview toggle, formatting toolbar (using shared components from FE-001), save button with status, export dropdown. | FE-001 | M | frontend-developer |
| FE-005 | Modify `EstimationPreviewPanel` | Add mode state, auto-save logic, save handler, export handler, unsaved changes tracking. Conditionally render `QuoteDocument` or `InlineQuoteEditor` based on mode. Integrate `PreviewToolbar`. | FE-003, FE-004 | L | frontend-developer |
| FE-006 | Modify `EstimationSplitView` | Pass `project` prop to `EstimationPreviewPanel`. Add `onQuoteSaved` handler. Ensure bidirectional sync between chat refinements and editor. | FE-005 | S | frontend-developer |
| FE-007 | Add auto-save with debounce | Implement 3-second debounced auto-save in `EstimationPreviewPanel`. Show save status indicator (saving spinner, saved checkmark, last saved timestamp). Integrate `beforeunload` warning for unsaved changes. | FE-005 | M | frontend-developer |
| FE-008 | Integrate export from preview panel | Wire export dropdown to existing `quoteService.exportQuote()`. Handle download blob response. Show loading state during export. | FE-005 | S | frontend-developer |
| FE-009 | Style the inline editor | Apply document-like styling to the inline editor (white background, appropriate padding, max-width, typography matching `QuoteDocument`). Ensure toolbar does not take excessive vertical space. Mobile-responsive layout. | FE-003, FE-004 | M | frontend-developer |
| FE-010 | Handle edge cases and error states | Handle: editor load failure, save failure with retry, network errors during auto-save, quote status not draft (disable editing), empty content, very long content performance. | FE-005, FE-007 | M | frontend-developer |

### Backend Tasks

| Task ID | Title | Description | Dependencies | Estimated Effort | Assigned Role |
|---------|-------|-------------|--------------|-----------------|---------------|
| BE-001 | Add HTML detection to DocxExportService | Add `_is_html_content()` method. When HTML is detected, use BeautifulSoup or html.parser to extract structured content for DOCX generation. Fall back to existing markdown parsing for non-HTML content. | None | M | backend-developer |
| BE-002 | Update `_add_formatted_content` for HTML | Modify the content formatting method to handle HTML tags (headings, paragraphs, lists, bold/italic). Convert HTML elements to python-docx equivalents (add_heading for h1-h3, add_paragraph for p, List Bullet for ul/li, etc.). | BE-001 | M | backend-developer |
| BE-003 | Update `_extract_scope_sections` for HTML | Modify section extraction regex to also match HTML heading tags (`<h1>`, `<h2>`, etc.) in addition to markdown headers. | BE-001 | S | backend-developer |
| BE-004 | Update `_extract_hours_breakdown` for HTML | Modify hours extraction to handle content where hours might be in HTML table tags or structured HTML instead of plain text patterns. | BE-001 | S | backend-developer |
| BE-005 | Add integration tests for HTML content export | Test DOCX export with HTML content input. Verify all sections render correctly. Test with mixed markdown/HTML content. | BE-002, BE-003, BE-004 | M | backend-developer |

### Cross-Cutting Tasks

| Task ID | Title | Description | Dependencies | Estimated Effort | Assigned Role |
|---------|-------|-------------|--------------|-----------------|---------------|
| XC-001 | End-to-end testing | Test full flow: generate estimate via AI, switch to edit mode, make changes, save, verify persistence, export PDF/DOCX, verify exports contain edited content. Test AI refinement while editor is open. | FE-010, BE-005 | L | frontend-developer + backend-developer |
| XC-002 | Performance validation | Verify editor initialization time is under 500ms. Verify auto-save does not cause jank. Test with large quotes (10,000+ characters). | FE-010 | S | frontend-developer |

---

## 8. Phase Plan

### Phase 1: Core Inline Editor (MVP)

**Goal:** Users can switch to edit mode and make text edits in the preview panel.

**Tasks:** FE-001, FE-002, FE-003, FE-004, FE-005, FE-006, FE-009

**Deliverables:**
- Shared toolbar components extracted
- `quoteContentToHtml` utility working
- `InlineQuoteEditor` rendering editable content
- `PreviewToolbar` with mode toggle and formatting tools
- `EstimationPreviewPanel` switching between preview and edit modes
- Bidirectional sync with chat panel

**Acceptance Criteria:**
- [ ] User can click "Edit" to switch from read-only preview to editable Tiptap editor
- [ ] User can click "Preview" to switch back to read-only `QuoteDocument` view
- [ ] Editor displays the same content as the preview (formatting preserved)
- [ ] Formatting toolbar works: bold, italic, underline, headings, lists, alignment
- [ ] Undo/redo works in editor
- [ ] When AI refines the quote via chat, the editor content updates accordingly
- [ ] Edit toggle is disabled for non-draft quotes with tooltip "Only draft quotes can be edited"

### Phase 2: Save and Persistence

**Goal:** Edited content is saved to the backend and persists across page reloads.

**Tasks:** FE-007, FE-010

**Deliverables:**
- Auto-save with debounce
- Manual save via button and Ctrl+S
- Save status indicator
- Unsaved changes warning on navigation
- Error handling for save failures

**Acceptance Criteria:**
- [ ] Changes auto-save 3 seconds after the user stops typing
- [ ] Save button shows spinner while saving, checkmark after success
- [ ] "Last saved at [time]" indicator updates after each save
- [ ] "Unsaved changes" badge appears when content differs from saved version
- [ ] Browser warns before closing/navigating with unsaved changes
- [ ] Ctrl+S triggers manual save
- [ ] Save failures show toast error with retry option
- [ ] Saved content persists after page reload (re-fetch from API shows edited content)
- [ ] Save sends `PUT /api/v1/quotes/{quote_id}` with `{ content: htmlString }`

### Phase 3: Export Integration

**Goal:** Users can export edited content as PDF/DOCX from the preview panel.

**Tasks:** FE-008, BE-001, BE-002, BE-003, BE-004, BE-005

**Deliverables:**
- Export dropdown in toolbar
- Backend HTML-aware export service
- Integration tests

**Acceptance Criteria:**
- [ ] Export dropdown shows PDF and DOCX options
- [ ] Clicking export triggers file download
- [ ] Downloaded DOCX contains the edited content with correct formatting
- [ ] Downloaded PDF contains the edited content with correct formatting
- [ ] Export works for both markdown-only and HTML content
- [ ] Export shows loading indicator during generation
- [ ] Export errors display user-friendly error message

### Phase 4: Polish and Edge Cases

**Goal:** Production-ready with all edge cases handled.

**Tasks:** FE-010, XC-001, XC-002

**Deliverables:**
- Comprehensive error handling
- Performance validation
- End-to-end test coverage

**Acceptance Criteria:**
- [ ] Editor loads within 500ms for quotes up to 10,000 characters
- [ ] Auto-save does not cause visible UI jank
- [ ] All error states have user-friendly messages
- [ ] Mobile layout works (single panel with tab switching preserved)
- [ ] Keyboard shortcuts do not conflict with browser defaults

---

## 9. API Contracts

### 9.1 Save Edited Content

**Endpoint:** `PUT /api/v1/quotes/{quote_id}` (existing)

**Request:**
```json
{
  "content": "<h1>Executive Summary</h1><p>This project involves...</p><h2>Scope</h2>..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "content": "<h1>Executive Summary</h1>...",
    "updated_at": "2026-02-13T10:00:00Z",
    ...
  }
}
```

**Constraints:**
- Only quotes with `status: 'draft'` can be updated (enforced by backend)
- Content must be at least 1 character (`min_length=1`)
- Returns 400 `QUOTE_NOT_EDITABLE` if quote is not in draft status

### 9.2 Export (Existing, No Changes to Contract)

**DOCX:** `POST /api/v1/projects/{project_id}/quotes/{quote_id}/export/docx`
**PDF:** `POST /api/v1/projects/{project_id}/quotes/{quote_id}/export/pdf`

Response: Binary file stream (DOCX or PDF).

Backend change is internal only: the export service must now handle HTML content in the `quote.content` field.

---

## 10. State Management

### 10.1 Preview Panel State

```typescript
// EstimationPreviewPanel internal state
{
  mode: 'preview' | 'edit',          // Current view mode
  editorContent: string,              // Current HTML content in editor
  isSaving: boolean,                  // Save in progress
  lastSavedAt: Date | null,          // Last successful save timestamp
  hasUnsavedChanges: boolean,        // Content differs from last save
  saveError: string | null,          // Last save error message
}
```

### 10.2 State Flow on Mode Switch

**Preview to Edit:**
1. Convert current `quote.content` to HTML via `quoteContentToHtml(quote)`
2. Set `editorContent` to the HTML
3. Set `mode` to `'edit'`
4. Tiptap editor initializes with content

**Edit to Preview:**
1. If `hasUnsavedChanges`, prompt: "Save changes before switching to preview?"
2. If user confirms save, save first, then switch
3. If user discards, revert `editorContent` and switch
4. Set `mode` to `'preview'`
5. `QuoteDocument` re-renders from the (possibly updated) `quote` prop

### 10.3 State Flow on AI Refinement (from Chat)

1. `EstimationSplitView.handleQuoteUpdate(updatedQuote, changes)` fires
2. `currentQuote` state updates
3. `EstimationPreviewPanel` receives new `quote` prop
4. If `mode === 'edit'`:
   a. Convert new `quote.content` to HTML
   b. Compare with current `editorContent`
   c. If different, update editor: `editor.commands.setContent(newHtml)`
   d. Set `hasUnsavedChanges = false` (content matches server)
5. If `mode === 'preview'`:
   a. `QuoteDocument` re-renders automatically from new props

---

## 11. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Content format mismatch**: Editor saves HTML, but backend export expects markdown | High | High | BE-001 through BE-004: Add HTML detection and parsing to export service. Implement before Phase 3. |
| **Data loss on save conflict**: User edits while AI refinement overwrites content | Medium | High | Show confirmation dialog when AI update arrives during editing. Give user choice: "Accept AI changes" (replaces editor) or "Keep my edits" (ignores AI update). |
| **Auto-save race conditions**: Multiple debounced saves overlap | Medium | Medium | Use an abort controller pattern: cancel previous save request before starting new one. Only the latest content is saved. |
| **Editor performance with large documents**: Quotes over 10K characters may cause jank | Low | Medium | Test with large content in Phase 4. Tiptap is ProseMirror-based and handles large documents well. If needed, virtualize the editor viewport. |
| **Bidirectional sync complexity**: Managing state between chat, editor, and server | Medium | Medium | Clear ownership: editor owns content when in edit mode, server owns content when in preview mode. AI refinements always go through server then propagate to editor. |
| **Mobile experience**: Formatting toolbar takes too much space on small screens | Medium | Low | Collapse formatting toolbar into an overflow menu on mobile. Or only show essential formatting options (bold, italic, lists). |
| **Backend HTML content breaks existing features**: Other consumers of `quote.content` may not expect HTML | Low | Medium | The `quote-normalizer.ts` already handles content as a string for `executive_summary`. `isMarkdownOnlyContent` may need updating to also detect HTML-only content. Add `isHtmlContent()` utility. |

---

## 12. Assumptions

1. The Tiptap editor's HTML output is semantically clean (using standard tags like `<h1>`, `<p>`, `<ul>`, `<li>`, `<strong>`, `<em>`) and does not produce deeply nested or non-standard markup.
2. The existing `PUT /api/v1/quotes/{quote_id}` endpoint does not validate or transform the `content` string -- it stores it as-is. (Confirmed from code review.)
3. Only quotes in `draft` status need to be editable. Published/approved/rejected quotes are read-only. (Confirmed from code review: backend returns 400 for non-draft updates.)
4. The `quote-normalizer.ts` on the frontend will need to handle HTML content in `executive_summary` (when the editor saves HTML back and the quote is re-fetched). The `MarkdownBody` component should detect and render HTML appropriately.
5. No collaborative editing (multiple users editing simultaneously) is required in this phase. The existing Tiptap collaboration extensions (`@tiptap/extension-collaboration`, `yjs`) are already in `package.json` but will not be activated.
6. The export services on the backend can be enhanced incrementally -- Phase 3 can be delivered after Phase 1 and 2 are complete.

---

## 13. Non-Functional Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Editor initialization time | < 500ms | Time from mode switch to cursor active |
| Auto-save latency | 3s debounce + < 1s API response | Time from last keystroke to save confirmation |
| Export generation time | < 10s for DOCX, < 15s for PDF | Time from button click to download start |
| Content size support | Up to 50,000 characters | Match backend `max_length` on content |
| Browser support | Chrome, Firefox, Safari, Edge (latest 2 versions) | Manual testing |
| Accessibility | WCAG 2.1 AA | Keyboard navigation, ARIA labels on toolbar buttons, focus management on mode switch |

---

## 14. Decisions Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|----------------------|
| Save HTML to backend `content` field (not markdown) | Tiptap natively produces HTML. Converting to markdown loses formatting fidelity. Backend export can be enhanced to parse HTML. | 1. Convert to markdown with `turndown` (lossy). 2. Store both HTML and markdown (schema complexity). |
| Reuse AdvancedEditor extensions, not the component itself | The `AdvancedEditor` includes a full-page layout with header, title input, and comment sidebar that are not appropriate for inline use. Reusing just the extensions and toolbar components keeps the inline editor lightweight. | 1. Embed `AdvancedEditor` directly (too much UI chrome). 2. Make `AdvancedEditor` configurable with props (high refactor risk). |
| Auto-save with 3s debounce | Balances between saving often enough to prevent data loss and not overwhelming the API. 3 seconds is a common pattern (Google Docs uses ~2-3 seconds). | 1. No auto-save, manual only (data loss risk). 2. Save on every keystroke (API overwhelm). 3. Save on blur only (data loss between saves). |
| Show confirmation on AI refinement during editing | Prevents silent data loss when AI changes overwrite user edits. Gives user explicit control. | 1. Always accept AI changes (user loses edits). 2. Always reject AI changes during editing (AI refinement feels broken). 3. Merge changes (extremely complex). |
| HTML-aware export service (backend) over frontend markdown conversion | Keeps the backend as the single source of truth for document generation. Frontend should not be responsible for document format conversions that affect exports. | 1. Frontend converts HTML to markdown before save (lossy, splits responsibility). 2. Separate export endpoint that accepts HTML (API surface bloat). |

---

## 15. File Manifest

### New Files

| File Path | Type | Description |
|-----------|------|-------------|
| `frontend/src/components/estimate/preview/PreviewToolbar.tsx` | Component | Toolbar with mode toggle, formatting tools, save button, export dropdown |
| `frontend/src/components/estimate/preview/InlineQuoteEditor.tsx` | Component | Tiptap editor wrapper for inline editing |
| `frontend/src/components/editor/shared/ToolbarButton.tsx` | Component | Reusable toolbar button (extracted from AdvancedEditor) |
| `frontend/src/components/editor/shared/ToolbarDivider.tsx` | Component | Reusable toolbar divider (extracted from AdvancedEditor) |
| `frontend/src/components/editor/shared/index.ts` | Barrel | Exports shared editor components |
| `frontend/src/lib/quote-to-html.ts` | Utility | Converts Quote content to HTML for editor |

### Modified Files

| File Path | Changes |
|-----------|---------|
| `frontend/src/components/estimate/EstimationPreviewPanel.tsx` | Add mode state, toolbar, conditional rendering, save/export handlers |
| `frontend/src/components/estimate/EstimationSplitView.tsx` | Pass `project` prop to preview panel, add `onQuoteSaved` handler |
| `frontend/src/components/editor/AdvancedEditor/AdvancedEditor.tsx` | Import toolbar components from shared instead of defining inline |
| `frontend/src/lib/quote-normalizer.ts` | Add `isHtmlContent()` utility for detecting HTML in content strings |
| `backend/app/services/export/docx_service.py` | Add HTML detection and parsing for DOCX generation |

---

## 16. Dependency Check

### Frontend Dependencies (all already installed)

- `@tiptap/react` -- Tiptap React bindings
- `@tiptap/starter-kit` -- Core extensions (headings, lists, bold, italic, etc.)
- `@tiptap/extension-underline` -- Underline support
- `@tiptap/extension-text-align` -- Text alignment
- `@tiptap/extension-placeholder` -- Placeholder text

### Frontend Dependencies (may need to add)

- `marked` or `markdown-it` -- For converting markdown content to HTML (only needed if `quoteContentToHtml` must handle markdown-only content). Alternative: write a simple regex-based converter for the subset of markdown used (headers, bold, italic, lists, links).

### Backend Dependencies (may need to add)

- `beautifulsoup4` -- For parsing HTML content in export service. Check if already available via WeasyPrint or other dependencies. If not, add to `requirements.txt`.

### Backend Dependencies (already installed)

- `python-docx` -- DOCX generation
- `weasyprint` -- PDF generation (if PDF export exists)

---

## 17. Open Questions

These items should be clarified before implementation begins:

1. **Markdown-to-HTML conversion**: Should we add a dependency (`marked`) for robust markdown-to-HTML conversion, or is a lightweight regex-based approach sufficient for the markdown patterns the AI generates?

2. **Content format migration**: When a user first edits a markdown-content quote and saves it as HTML, all subsequent loads will get HTML. Should we store a `content_format` field (`markdown` | `html`) on the backend to make this explicit, or rely on runtime detection?

3. **Simultaneous editing guard**: If two browser tabs have the same quote open in edit mode, last-write-wins could cause data loss. Should we add an optimistic locking mechanism (e.g., `updated_at` check on save)?

4. **Comment plugin**: The existing `AdvancedEditor` has a `CommentPlugin` sidebar. Should this be included in the inline editor for future use, or explicitly excluded to keep the inline editor simple?

5. **PDF export service**: The spec mentions WeasyPrint for PDF. Is there an existing `PdfExportService` in the codebase, or does only the DOCX export exist currently? If PDF export is not yet implemented, it should be scoped as a separate task.
