# Services Architecture

## Overview

The services layer provides API client interfaces for the Estimate AI application. Services are organized by domain and architectural pattern.

## Quote Services

We have **two quote-related services** with distinct purposes and patterns:

### `quote-generation.service.ts` - Quote Generation (Class-based)
- **Pattern:** Class-based with instance methods
- **Use Cases:**
  - Generating quotes with real-time progress tracking
  - Creating quote versions
  - Managing generation state (cancellation, polling)
  - Direct export downloads (PDF, DOCX)
- **Key Features:**
  - Streaming progress updates via callbacks
  - Abort controller for cancellation
  - Browser download triggers
- **Used By:**
  - `EstimateChat` - Progress tracking during generation
  - `EstimateEditor` - Quote versioning
  - `NewQuote` - Quote generation
  - `ExportButtons`, `ExportDialog` - Direct exports

**Example:**
```typescript
import { quoteService } from '@/services/quote-generation.service';

// Generate with progress
const cancel = quoteService.generateQuoteWithProgress(
  projectId,
  request,
  (progress) => console.log(progress),
  (quote) => console.log('Complete:', quote),
  (error) => console.error(error)
);

// Export directly
const blob = await quoteService.exportQuote(projectId, quoteId, 'pdf');
quoteService.triggerDownload(blob, 'quote.pdf');
```

### `quotes.service.ts` - Quote Queries (Function-based)
- **Pattern:** Function-based exports optimized for React Query
- **Use Cases:**
  - Fetching quotes (list, detail, history)
  - CRUD operations (create, read, update, delete)
  - Status management (finalize, archive)
  - Feedback submissions
  - Export job monitoring
- **Key Features:**
  - Modular service objects (`quotesService`, `quotesApi`, `feedbackApi`, `exportApi`)
  - React Query friendly signatures
  - Project-scoped and global operations
- **Used By:**
  - `useQuotes` hook - React Query integration
  - Quote list views
  - Quote status updates

**Example:**
```typescript
import { quotesService, feedbackApi, exportApi } from '@/services/quotes.service';

// Fetch quotes
const quotes = await quotesService.listByProject(projectId);

// Update status
await quotesService.finalize(quoteId);

// Submit feedback
await feedbackApi.submit(projectId, quoteId, feedback);

// Monitor export job
const job = await exportApi.getStatus(exportJobId);
```

## Why Two Services?

These services serve different architectural needs:

1. **Generation vs Querying:**
   - Generation requires stateful streaming and cancellation
   - Querying is stateless and cacheable

2. **Pattern Compatibility:**
   - Class-based for complex state management
   - Function-based for React Query integration

3. **Performance:**
   - Separate concerns allow targeted optimization
   - Class instances persist across multiple operations

## Future Consolidation

These services may be consolidated in the future, but currently serve distinct needs. Any consolidation should:
- Preserve streaming progress functionality
- Maintain React Query compatibility
- Keep clear separation of concerns
- Avoid breaking existing component dependencies

## Other Services

### `api.ts` - Base API Client
- Axios instance configuration
- Request/response interceptors
- Error handling utilities
- Authentication token management

### `client.service.ts` - Client Management
- Client CRUD operations
- Client search and filtering

## Best Practices

1. **Import from specific service files:**
   ```typescript
   // ✅ Good
   import { quoteService } from '@/services/quote-generation.service';
   import { quotesService } from '@/services/quotes.service';

   // ❌ Avoid
   import { quoteService, quotesService } from '@/services';
   ```

2. **Use appropriate service for the task:**
   - Need progress tracking? → `quote-generation.service.ts`
   - Need to fetch/list quotes? → `quotes.service.ts`

3. **Handle errors appropriately:**
   - Services throw errors that should be caught by components
   - Use error boundaries for unhandled errors

4. **Respect service boundaries:**
   - Don't bypass services to call `apiClient` directly
   - Services encapsulate API contract knowledge
