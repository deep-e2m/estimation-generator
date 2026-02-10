# Track 5: Advanced Editor Research & Recommendation

**Priority**: LOW (Research/Planning Phase)
**Status**: Not Started
**Est. Effort**: 12-16 hours (Research + POC)
**Dependencies**: None for research; implementation would be a separate phase

---

## Executive Summary

The current TipTap editor implementation is basic and lacks advanced features users expect from modern collaborative document editing tools. The goal is to research and recommend a better editor solution with Google Docs-like capabilities including commenting, suggestions, track changes, and real-time collaboration.

This is a **research and recommendation track**, not immediate implementation. The output will be a technical specification and proof-of-concept for a future enhancement phase.

---

## Problem Statement

### Current State: TipTap Basic Implementation

**Current Editor**: TipTap
**Features Available**:
- Basic rich text formatting (bold, italic, underline)
- Headings and paragraphs
- Lists (ordered/unordered)
- Links
- Basic collaborative editing with Y.js (if implemented)

**Missing Critical Features**:
- Commenting system
- Suggestion mode (track changes)
- Version history
- Advanced formatting options
- Inline collaboration indicators
- Mention system (@mentions)
- Task lists with assignment
- Table support
- Code blocks with syntax highlighting
- Image handling and positioning
- Document outline/table of contents

### Target State: Google Docs-Like Experience

**Required Features**:
1. **Commenting System**
   - Inline comments on selected text
   - Comment threads with replies
   - Resolve/reopen comments
   - @mentions in comments
   - Comment notifications

2. **Suggestion Mode**
   - Track insertions and deletions
   - Accept/reject suggestions
   - Suggest formatting changes
   - Author attribution
   - Timestamp tracking

3. **Real-time Collaboration**
   - Multiple cursors with user names
   - Live presence indicators
   - Conflict resolution
   - Operational transformation or CRDT

4. **Version History**
   - Automatic version snapshots
   - Named versions
   - Diff view
   - Restore to previous version

5. **Advanced Formatting**
   - Tables with cell merging
   - Images with captions and alignment
   - Code blocks with syntax highlighting
   - Embeds (videos, links, etc.)
   - Custom blocks/components

---

## Editor Options Analysis

### Option 1: Lexical (Facebook/Meta)

**Library**: `/facebook/lexical`
**Documentation**: https://lexical.dev/

#### Pros
- Built and maintained by Meta (Facebook)
- Designed from ground up for extensibility and performance
- Excellent TypeScript support
- Built-in collaborative editing support
- Modular plugin architecture
- Growing ecosystem
- Great documentation and examples
- Used in production by Meta products

#### Cons
- Relatively new (released 2022)
- Smaller ecosystem compared to ProseMirror
- Fewer third-party plugins available
- Still evolving API
- Less community content (tutorials, examples)

#### Key Features
- Rich text editing with markdown shortcuts
- Collaborative editing with Yjs integration
- Extensible node system
- Serialization/deserialization
- History management (undo/redo)
- Commenting plugin available
- Mention system
- Table support

#### Code Example - Basic Setup
```typescript
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';

const initialConfig = {
  namespace: 'QuoteEditor',
  theme: editorTheme,
  onError: (error: Error) => console.error(error),
};

function QuoteEditor() {
  return (
    <LexicalComposer initialConfig={initialConfig}>
      <RichTextPlugin
        contentEditable={<ContentEditable />}
        placeholder={<div>Start writing...</div>}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      {/* Add more plugins */}
    </LexicalComposer>
  );
}
```

#### Commenting Example
```typescript
import { CommentPlugin } from '@lexical/react/LexicalCommentPlugin';

// In your editor
<CommentPlugin
  onAddComment={(comment) => {
    // Save comment to backend
  }}
  onResolveComment={(commentId) => {
    // Mark as resolved
  }}
/>
```

#### Community & Support
- Active GitHub repository (40k+ stars)
- Regular updates and releases
- Good Discord community
- Meta actively maintaining

**Evaluation Score: 8.5/10**

---

### Option 2: ProseMirror (with Remirror or Prosekit)

**Library**: `/prosemirror/prosemirror` or `/remirror/remirror`
**Documentation**: https://prosemirror.net/, https://remirror.io/

#### Pros
- Mature, battle-tested framework (since 2015)
- Used by Atlassian, New York Times, Coda, etc.
- Extremely flexible and powerful
- Rich plugin ecosystem
- Excellent for complex use cases
- Strong collaborative editing support
- Well-documented architecture

#### Cons
- Steeper learning curve
- Lower-level API (need wrapper like Remirror)
- More boilerplate code required
- TypeScript support not as seamless
- Documentation can be dense

#### Key Features
- Document model based on schemas
- Transaction-based updates
- Built-in collaborative editing (with prosemirror-collab)
- Plugin system for extensions
- Commands and keymaps
- Full control over document structure
- Excellent undo/redo

#### Using Remirror (React Wrapper)
```typescript
import { Remirror, useRemirror } from '@remirror/react';
import { BoldExtension, ItalicExtension } from 'remirror/extensions';

function QuoteEditor() {
  const { manager } = useRemirror({
    extensions: () => [
      new BoldExtension(),
      new ItalicExtension(),
      // Add more extensions
    ],
  });

  return (
    <Remirror manager={manager}>
      <EditorComponent />
    </Remirror>
  );
}
```

#### Using Prosekit (Modern ProseMirror Toolkit)
```typescript
import { createEditor } from 'prosekit/core';
import { ProseKit } from 'prosekit/react';

const editor = createEditor({
  defaultDoc: '<p>Start writing...</p>',
});

function QuoteEditor() {
  return (
    <ProseKit editor={editor}>
      <div className="editor-container" />
    </ProseKit>
  );
}
```

#### Community & Support
- Very mature and stable
- Large community
- Many production implementations
- Extensive documentation
- Active maintenance

**Evaluation Score: 9/10**

---

### Option 3: Slate

**Library**: `/ianstormtaylor/slate`
**Documentation**: https://docs.slatejs.org/

#### Pros
- React-first design
- Simple, intuitive API
- Full control over rendering
- Good TypeScript support
- Active community
- Many examples available

#### Cons
- Still in beta (long-running beta)
- Breaking changes in past
- Collaborative editing requires custom implementation
- Less polished than competitors
- Performance issues with large documents
- Commenting system needs custom build

#### Key Features
- React-based rendering
- Custom schema definition
- Normalization rules
- Plugin system
- History management

#### Code Example
```typescript
import { Slate, Editable } from 'slate-react';
import { createEditor } from 'slate';

function QuoteEditor() {
  const [editor] = useState(() => createEditor());
  const [value, setValue] = useState(initialValue);

  return (
    <Slate editor={editor} value={value} onChange={setValue}>
      <Editable
        renderElement={renderElement}
        renderLeaf={renderLeaf}
      />
    </Slate>
  );
}
```

#### Community & Support
- Good community engagement
- Regular updates
- Many tutorials available

**Evaluation Score: 7/10**

---

### Option 4: Enhance TipTap

**Library**: Current implementation
**Documentation**: https://tiptap.dev/

#### Pros
- Already integrated in codebase
- Good documentation
- Based on ProseMirror (inherits power)
- Easier API than raw ProseMirror
- Growing plugin ecosystem
- React components available

#### Cons
- Limited built-in commenting support
- Suggestion mode requires custom implementation or premium extension
- Some advanced features only in Pro version
- Smaller ecosystem than alternatives

#### Available Extensions
- Collaboration (with Y.js)
- Comments (Pro extension)
- Suggestion (Pro extension - track changes)
- Mention
- TaskList
- Table
- Image
- Code block with syntax highlighting

#### Code Example - Adding Features
```typescript
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Comment from '@tiptap/extension-comment';
import Mention from '@tiptap/extension-mention';

const editor = useEditor({
  extensions: [
    StarterKit,
    Collaboration.configure({
      document: ydoc,
    }),
    CollaborationCursor.configure({
      provider: websocketProvider,
    }),
    Comment.configure({
      onCommentActivated: (commentId) => {
        // Handle comment activation
      },
    }),
    Mention.configure({
      suggestion: mentionSuggestions,
    }),
  ],
});
```

#### Cost Consideration
- Core: Free and open source
- Pro Extensions (Comments, Suggestions): Subscription required
  - Solo: $99/month
  - Team: $499/month
  - Enterprise: Custom pricing

**Evaluation Score: 7.5/10** (without Pro), **8.5/10** (with Pro)

---

## Feature Comparison Matrix

| Feature | Lexical | ProseMirror/Remirror | Slate | TipTap | TipTap Pro |
|---------|---------|---------------------|-------|--------|------------|
| **Basic Editing** | ✅ Excellent | ✅ Excellent | ✅ Good | ✅ Excellent | ✅ Excellent |
| **TypeScript Support** | ✅ Native | ⚠️ Good | ✅ Good | ✅ Good | ✅ Good |
| **React Integration** | ✅ Official | ✅ Via Remirror | ✅ Native | ✅ Official | ✅ Official |
| **Commenting** | ✅ Built-in | ⚠️ Custom/Plugin | ❌ Custom | ❌ Pro Only | ✅ Pro Extension |
| **Suggestions/Track Changes** | ⚠️ Custom | ⚠️ Custom | ❌ Custom | ❌ Pro Only | ✅ Pro Extension |
| **Collaboration** | ✅ Yjs Integration | ✅ Built-in | ⚠️ Custom | ✅ Yjs | ✅ Yjs |
| **Version History** | ⚠️ Custom | ⚠️ Custom | ⚠️ Custom | ⚠️ Custom | ⚠️ Custom |
| **Tables** | ✅ Plugin | ✅ Plugin | ⚠️ Custom | ✅ Extension | ✅ Extension |
| **Mentions** | ✅ Plugin | ✅ Plugin | ⚠️ Custom | ✅ Extension | ✅ Extension |
| **Performance** | ✅ Excellent | ✅ Excellent | ⚠️ Good | ✅ Excellent | ✅ Excellent |
| **Documentation** | ✅ Excellent | ✅ Good | ⚠️ Fair | ✅ Excellent | ✅ Excellent |
| **Community** | ✅ Growing | ✅ Large | ⚠️ Medium | ✅ Growing | ✅ Growing |
| **Maturity** | ⚠️ New (2022) | ✅ Mature (2015) | ⚠️ Beta | ✅ Mature | ✅ Mature |
| **Cost** | ✅ Free | ✅ Free | ✅ Free | ✅ Free | ❌ Paid |
| **Learning Curve** | ⚠️ Medium | ❌ Steep | ✅ Easy | ✅ Easy | ✅ Easy |

---

## Recommendation

### Primary Recommendation: **Lexical**

**Rationale**:
1. **Best Balance**: Modern architecture with good feature coverage
2. **Cost-Effective**: All features free and open source
3. **Future-Proof**: Backed by Meta with active development
4. **Performance**: Built from ground up for speed
5. **Extensibility**: Plugin architecture for custom features
6. **TypeScript**: First-class TypeScript support
7. **React**: Official React bindings
8. **Collaboration**: Built-in support for collaborative editing

**Implementation Complexity**: Medium
**Timeline**: 2-3 weeks for full migration + feature implementation

### Alternative Recommendation: **TipTap Pro**

**Rationale**:
1. **Minimal Migration**: Already in use, just add Pro features
2. **Faster Implementation**: Familiar codebase
3. **Ready-Made Features**: Comments and suggestions out of the box
4. **Lower Risk**: No major architectural changes

**Cost**: $99-499/month depending on team size
**Implementation Complexity**: Low
**Timeline**: 1 week to add Pro features

### Budget-Conscious Option: **ProseMirror with Remirror**

**Rationale**:
1. **Free and Open Source**: No licensing costs
2. **Proven**: Used by major companies
3. **Powerful**: Most flexible for custom requirements
4. **Custom Implementation**: Build exactly what we need

**Implementation Complexity**: High
**Timeline**: 3-4 weeks (more custom code required)

---

## Implementation Roadmap

### Phase 1: Proof of Concept (1-2 weeks)

**Goal**: Validate choice with working prototype

**Tasks**:
1. Set up Lexical in isolated environment
2. Implement basic rich text editing
3. Add commenting plugin
4. Test collaborative editing
5. Performance benchmark vs current TipTap
6. Developer experience evaluation

**Deliverables**:
- Working demo with commenting
- Performance comparison report
- Integration complexity assessment
- Final go/no-go recommendation

### Phase 2: Core Migration (2-3 weeks)

**Goal**: Replace TipTap with Lexical in quote editor

**Tasks**:
1. Create Lexical editor component
2. Migrate existing formatting features
3. Implement save/load functionality
4. Add markdown export
5. Add PDF export
6. Testing and QA

**Deliverables**:
- Functional quote editor with Lexical
- Feature parity with current editor
- Unit and integration tests

### Phase 3: Advanced Features (3-4 weeks)

**Goal**: Add Google Docs-like capabilities

**Tasks**:
1. **Commenting System** (1 week)
   - Inline comment creation
   - Comment threads
   - Resolve/reopen
   - @mentions in comments

2. **Suggestions/Track Changes** (1.5 weeks)
   - Suggestion mode toggle
   - Track insertions/deletions
   - Accept/reject suggestions
   - Author attribution

3. **Real-time Collaboration** (1 week)
   - Multiple cursors
   - Presence indicators
   - WebSocket integration
   - Conflict resolution

4. **Version History** (0.5 weeks)
   - Auto-save snapshots
   - Version list UI
   - Diff view
   - Restore functionality

**Deliverables**:
- Complete collaborative editor
- Admin documentation
- User guide

### Phase 4: Polish & Optimization (1 week)

**Goal**: Production-ready deployment

**Tasks**:
1. Performance optimization
2. Mobile responsive design
3. Accessibility audit
4. Browser compatibility testing
5. Error handling and edge cases
6. Analytics integration

**Total Timeline**: 7-10 weeks

---

## Technical Architecture

### Component Structure

```
frontend/src/components/editor/
├── QuoteEditor/
│   ├── QuoteEditor.tsx           # Main Lexical editor component
│   ├── QuoteEditorToolbar.tsx    # Formatting toolbar
│   ├── QuoteEditorPlugins.tsx    # Plugin configuration
│   ├── index.ts
│   └── styles.css
├── plugins/
│   ├── CommentPlugin.tsx         # Commenting functionality
│   ├── SuggestionPlugin.tsx      # Track changes
│   ├── CollaborationPlugin.tsx   # Real-time collaboration
│   ├── VersionPlugin.tsx         # Version history
│   └── MentionPlugin.tsx         # @mentions
├── ui/
│   ├── CommentThread.tsx
│   ├── SuggestionPanel.tsx
│   ├── VersionHistory.tsx
│   └── UserPresence.tsx
└── utils/
    ├── serialization.ts          # Save/load quote content
    ├── export.ts                 # PDF/Markdown export
    └── collaboration.ts          # WebSocket helpers
```

### Backend Requirements

**New Endpoints Needed**:
```
POST   /api/v1/quotes/{quote_id}/comments
GET    /api/v1/quotes/{quote_id}/comments
PUT    /api/v1/quotes/{quote_id}/comments/{comment_id}
DELETE /api/v1/quotes/{quote_id}/comments/{comment_id}

POST   /api/v1/quotes/{quote_id}/suggestions
PUT    /api/v1/quotes/{quote_id}/suggestions/{suggestion_id}/accept
PUT    /api/v1/quotes/{quote_id}/suggestions/{suggestion_id}/reject

GET    /api/v1/quotes/{quote_id}/versions
POST   /api/v1/quotes/{quote_id}/versions
GET    /api/v1/quotes/{quote_id}/versions/{version_id}
POST   /api/v1/quotes/{quote_id}/versions/{version_id}/restore

WebSocket: /ws/quotes/{quote_id}  # For collaboration
```

**Database Schema Updates**:
```sql
-- Comments table
CREATE TABLE quote_comments (
    id UUID PRIMARY KEY,
    quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES quote_comments(id),  -- For thread
    author_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    anchor_text TEXT,  -- Selected text
    anchor_offset INTEGER,  -- Position in document
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Suggestions table
CREATE TABLE quote_suggestions (
    id UUID PRIMARY KEY,
    quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id),
    suggestion_type VARCHAR(20),  -- 'insert', 'delete', 'format'
    content_before TEXT,
    content_after TEXT,
    anchor_offset INTEGER,
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMP DEFAULT NOW()
);

-- Versions table
CREATE TABLE quote_versions (
    id UUID PRIMARY KEY,
    quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
    version_number INTEGER,
    content JSONB,  -- Full editor state
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    label VARCHAR(255)  -- Optional version name
);
```

---

## Proof of Concept Code

### Lexical Editor Setup

```typescript
// frontend/src/components/editor/QuoteEditor/QuoteEditor.tsx

import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';

import { CommentPlugin } from '../plugins/CommentPlugin';
import { CollaborationPlugin } from '../plugins/CollaborationPlugin';
import { QuoteEditorToolbar } from './QuoteEditorToolbar';

const editorConfig = {
  namespace: 'QuoteEditor',
  theme: {
    // Custom theme configuration
    ltr: 'ltr',
    rtl: 'rtl',
    paragraph: 'editor-paragraph',
    heading: {
      h1: 'editor-heading-h1',
      h2: 'editor-heading-h2',
      h3: 'editor-heading-h3',
    },
    // ... more theme options
  },
  nodes: [
    HeadingNode,
    ListNode,
    ListItemNode,
    QuoteNode,
    CodeNode,
    CodeHighlightNode,
    TableNode,
    TableCellNode,
    TableRowNode,
    AutoLinkNode,
    LinkNode,
  ],
  onError: (error: Error) => {
    console.error('Lexical Error:', error);
  },
};

interface QuoteEditorProps {
  quoteId: string;
  projectId: string;
  initialContent?: string;
  onSave?: (content: string) => void;
}

export function QuoteEditor({
  quoteId,
  projectId,
  initialContent,
  onSave,
}: QuoteEditorProps) {
  return (
    <LexicalComposer initialConfig={editorConfig}>
      <div className="quote-editor-container">
        <QuoteEditorToolbar />

        <div className="editor-inner">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="editor-content-editable" />
            }
            placeholder={
              <div className="editor-placeholder">
                Start writing your quote...
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />

          <HistoryPlugin />
          <AutoFocusPlugin />

          {/* Advanced plugins */}
          <CommentPlugin quoteId={quoteId} />
          <CollaborationPlugin quoteId={quoteId} projectId={projectId} />
        </div>
      </div>
    </LexicalComposer>
  );
}
```

---

## Cost Analysis

### Option 1: Lexical (Recommended)
- **License Cost**: $0 (Open Source)
- **Development Time**: 7-10 weeks
- **Developer Cost** (@ $100/hr): $28,000 - $40,000
- **Maintenance**: Low (community maintained)
- **Total First Year**: $28,000 - $40,000

### Option 2: TipTap Pro
- **License Cost**: $499/month (Team plan)
- **Annual License**: $5,988
- **Development Time**: 1-2 weeks
- **Developer Cost** (@ $100/hr): $4,000 - $8,000
- **Total First Year**: $9,988 - $13,988
- **Year 2+**: $5,988/year recurring

### Option 3: ProseMirror/Remirror
- **License Cost**: $0 (Open Source)
- **Development Time**: 8-12 weeks
- **Developer Cost** (@ $100/hr): $32,000 - $48,000
- **Maintenance**: Medium (custom code)
- **Total First Year**: $32,000 - $48,000

**5-Year TCO Comparison**:
- Lexical: $28,000 - $40,000
- TipTap Pro: $33,928 - $37,928
- ProseMirror: $32,000 - $48,000

**Recommendation**: Lexical provides best long-term value unless immediate implementation (1-2 weeks) is critical, in which case TipTap Pro is cost-effective.

---

## Research Deliverables

### 1. Technical Specification Document
- Detailed architecture design
- Component specifications
- API requirements
- Database schema changes
- Integration points

### 2. Proof of Concept Application
- Working demo with Lexical
- Commenting functionality
- Basic collaboration
- Performance benchmarks

### 3. Migration Plan
- Step-by-step migration guide
- Risk assessment
- Rollback procedures
- Testing strategy

### 4. Cost-Benefit Analysis
- Development cost breakdown
- TCO over 5 years
- ROI projection
- Risk mitigation costs

---

## Success Criteria

1. **Feature Completeness**
   - All Google Docs-like features implemented
   - Comments with threading
   - Suggestion mode working
   - Real-time collaboration functional

2. **Performance**
   - Page load time < 2 seconds
   - Typing latency < 50ms
   - Handles documents > 10,000 words

3. **User Experience**
   - Intuitive UI
   - Mobile responsive
   - Accessible (WCAG 2.1 AA)
   - No learning curve vs current editor

4. **Developer Experience**
   - Well-documented code
   - Easy to extend
   - Good test coverage (>80%)
   - Clear upgrade path

---

## Next Steps

1. **Approval**: Get stakeholder approval for research phase
2. **POC Development**: Build proof of concept (2 weeks)
3. **Demo & Decision**: Present findings and recommendation
4. **Planning**: Create detailed implementation roadmap
5. **Resource Allocation**: Assign development team
6. **Implementation**: Execute migration plan

---

## Estimated Effort Breakdown

| Task | Hours |
|------|-------|
| Initial research and documentation | 4h |
| Lexical POC development | 16h |
| TipTap Pro evaluation | 8h |
| ProseMirror/Remirror evaluation | 8h |
| Performance testing | 4h |
| Cost-benefit analysis | 2h |
| Technical specification writing | 6h |
| Presentation preparation | 4h |
| **TOTAL RESEARCH PHASE** | **52h** |

---

## Dependencies

**None** - This is pure research that doesn't affect current system.

---

## Related Documents

- Current TipTap implementation: `/Users/deeptrivedi/estimation/frontend/src/components/editor/`
- Architecture summary: `/Users/deeptrivedi/estimation/specs/ARCHITECTURE_SUMMARY.md`
- Tech stack decisions: `/Users/deeptrivedi/estimation/specs/tech-stack.md`

---

## References

- Lexical Documentation: https://lexical.dev/
- ProseMirror Guide: https://prosemirror.net/docs/guide/
- Remirror Docs: https://remirror.io/docs/
- TipTap Docs: https://tiptap.dev/
- Slate Documentation: https://docs.slatejs.org/
