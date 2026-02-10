# Track 3: Direct Quote Generation (CRITICAL)

**Priority**: CRITICAL - Highest Priority
**Status**: Not Started
**Est. Effort**: 24-32 hours
**Dependencies**: None (can start immediately)

---

## Executive Summary

Currently, when users paste requirements in chat, the AI asks clarifying questions before generating quotes. This creates friction. The system should generate quotes DIRECTLY from pasted requirements, using RAG context and historical examples to ensure accuracy without requiring back-and-forth Q&A.

Additionally, the quote output format must strictly match the established E2M Solutions template format.

---

## Problem Statement

### Current Behavior
1. User pastes project requirements in chat
2. AI responds with clarifying questions
3. User must answer questions
4. AI finally generates quote (multiple rounds)
5. Quote format is inconsistent with E2M template

### Issues
- Slows down quote generation workflow
- Creates unnecessary friction
- Reduces user productivity
- Quote format doesn't match company standards
- Hour estimates don't align with provided examples

---

## Required Changes

### 1. Quote Generation Logic Update

**Backend Changes**
- File: `/Users/deeptrivedi/estimation/backend/app/services/ai/prompts.py`
- File: `/Users/deeptrivedi/estimation/backend/app/services/ai/llm_service.py`
- File: `/Users/deeptrivedi/estimation/backend/app/api/v1/chat.py`

**Changes Required**:

#### A. Prompt Engineering Update

Update `build_quote_generation_prompt()` in `prompts.py`:

```python
def build_quote_generation_prompt(
    requirements: str,
    platform: str,
    rag_context: Optional[str] = None,
    formatting_template: Optional[str] = None,
    project_context: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, str]]:
    """
    Build the prompt for DIRECT quote generation without questions.
    """

    # CRITICAL: Add instruction to generate quote directly
    system_content = """You are an expert project estimator for E2M Solutions,
    a digital agency specializing in web development.

    IMPORTANT INSTRUCTIONS:
    - Generate quotes DIRECTLY from requirements
    - DO NOT ask clarifying questions
    - Use RAG context from similar historical projects for accuracy
    - Make reasonable assumptions based on industry standards
    - Use provided estimation parameters as reference
    - Format output EXACTLY as specified in the template

    Your role is to generate professional, detailed project quotes based on
    client requirements using historical data and industry best practices.
    """

    # Add E2M Solutions standard format
    formatting_template = E2M_QUOTE_TEMPLATE

    # Rest of function...
```

#### B. Add E2M Solutions Quote Template

Add to `prompts.py`:

```python
E2M_QUOTE_TEMPLATE = """
## REQUIRED OUTPUT FORMAT

Format the quote EXACTLY as follows:

```
Prepared for: [Client Name or "Client"]
Prepared by: E2M Solutions
Date: [Current Date in format: January 21, 2026]

[Project Type Title - e.g., "WordPress Website Development", "Shopify Store Build"]

1. Project Overview
[2-3 paragraph description of the project scope and objectives]

2. Estimated Cost & Timeline
Estimated Hours: [X to Y hours]
Timeline: [X weeks]

[Optional: Cost breakdown if hourly rate provided]

3. Scope of Work

3.1 [Phase/Section Name]
- [Deliverable 1]
- [Deliverable 2]
- [Deliverable 3]

3.2 [Phase/Section Name]
- [Deliverable 1]
- [Deliverable 2]

[Continue for all sections...]

4. Assumptions & Client Responsibilities

We assume the following for this estimate:
- [Assumption 1]
- [Assumption 2]
- [Assumption 3]
[Continue...]

Client will provide:
- [Client responsibility 1]
- [Client responsibility 2]

5. Exclusions / Out of Scope

The following items are NOT included in this estimate:
- [Exclusion 1]
- [Exclusion 2]
- [Exclusion 3]
[Continue...]

6. Next Steps

To proceed with this project:
1. Review and approve this estimate
2. [Next action item]
3. [Next action item]

Please contact us with any questions.
```

ESTIMATION REFERENCE PARAMETERS:
Use these as guidelines for hour estimates (adjust based on complexity):

- WordPress + Elementor site (20 pages): 180-200 hours
- Website branding refresh (CSS only): 15-18 hours
- Development-only continuation: 90-95 hours
- Full design + development (10 pages): 110 hours
- Redesign + Elementor migration (9 pages): 120-130 hours
- Custom WordPress (5 templates): 70-80 hours
- Shopify store (15-20 products): 60-80 hours
- WooCommerce setup (50 products): 100-120 hours
- Custom React application (5 pages): 120-150 hours
- WordPress multisite setup: 40-60 hours
- WPML multilingual (2 languages): +30-40 hours per language
"""
```

#### C. Update Chat Response Logic

Modify chat endpoint to detect quote generation requests:

File: `/Users/deeptrivedi/estimation/backend/app/api/v1/chat.py`

```python
async def send_chat_message(
    project_id: UUID,
    message_data: ChatMessageCreate,
    current_user: ActiveUser,
    db: DbSession,
) -> ChatSendDataResponse:
    """Send a chat message and get AI response."""

    # Detect if this is a quote generation request
    is_quote_request = detect_quote_generation_intent(message_data.content)

    if is_quote_request:
        # Use quote generation prompt with RAG
        rag_service = get_rag_service()
        rag_context = await rag_service.get_relevant_context(
            query=message_data.content,
            project_platform=project.platform,
            top_k=3
        )

        response_content = await llm_service.generate_quote(
            requirements=message_data.content,
            platform=project.platform.value,
            rag_context=rag_context,
            project_context=project_context,
        )
    else:
        # Regular chat response
        response_content = await llm_service.chat_response(...)
```

Add helper function:

```python
def detect_quote_generation_intent(message: str) -> bool:
    """
    Detect if a message contains requirements for quote generation.

    Returns True if message appears to contain project requirements
    that should trigger direct quote generation.
    """
    # Indicators of quote generation intent
    quote_indicators = [
        len(message) > 200,  # Longer messages likely contain requirements
        re.search(r'\d+\s+pages?', message, re.IGNORECASE),
        re.search(r'wordpress|shopify|woocommerce|react|vue', message, re.IGNORECASE),
        re.search(r'website|e-commerce|store|blog', message, re.IGNORECASE),
        re.search(r'we need|we want|we require|looking for', message, re.IGNORECASE),
        re.search(r'budget|timeline|deadline', message, re.IGNORECASE),
    ]

    # If 3 or more indicators match, treat as quote request
    return sum(bool(indicator) for indicator in quote_indicators) >= 3
```

---

### 2. RAG Integration Enhancement

**Ensure RAG is Working Properly**

File: `/Users/deeptrivedi/estimation/backend/app/services/ai/rag_service.py`

Verify and enhance:

1. Embeddings are being generated for all knowledge base documents
2. Vector similarity search is working
3. Context is being properly formatted and injected into prompts
4. Top 3-5 most similar historical quotes are being retrieved

**Test RAG Performance**:
```python
async def test_rag_retrieval():
    """Test that RAG retrieves relevant examples."""
    test_query = """
    WordPress website with 15 pages, e-commerce functionality,
    custom design, blog, and contact forms.
    """

    results = await rag_service.get_relevant_context(
        query=test_query,
        project_platform="wordpress",
        top_k=3
    )

    # Results should include similar WordPress projects
    assert len(results) > 0
    assert "wordpress" in results.lower()
```

---

### 3. Quote Output Validation

**Add Format Validation**

Create validator to ensure quotes match template:

File: `/Users/deeptrivedi/estimation/backend/app/services/ai/quote_validator.py` (NEW)

```python
"""Quote format and quality validation."""

import re
from typing import List, Tuple

class QuoteValidationError(Exception):
    """Raised when quote doesn't meet format requirements."""
    pass

def validate_quote_format(quote_content: str) -> Tuple[bool, List[str]]:
    """
    Validate quote matches E2M Solutions format.

    Returns:
        (is_valid, list_of_issues)
    """
    issues = []

    # Check required sections
    required_sections = [
        "Prepared for:",
        "Prepared by: E2M Solutions",
        "Date:",
        "Project Overview",
        "Estimated Cost & Timeline",
        "Estimated Hours:",
        "Timeline:",
        "Scope of Work",
        "Assumptions",
        "Exclusions",
        "Next Steps",
    ]

    for section in required_sections:
        if section not in quote_content:
            issues.append(f"Missing required section: {section}")

    # Validate hour estimate format
    if not re.search(r'Estimated Hours:\s*\d+\s*to\s*\d+\s*hours?', quote_content):
        issues.append("Hour estimate not in correct format (should be 'X to Y hours')")

    # Validate timeline format
    if not re.search(r'Timeline:\s*\d+\s*(to\s*\d+\s*)?(weeks?|days?)', quote_content):
        issues.append("Timeline not in correct format")

    # Check that hours are within reasonable ranges
    hour_match = re.search(r'Estimated Hours:\s*(\d+)\s*to\s*(\d+)', quote_content)
    if hour_match:
        min_hours = int(hour_match.group(1))
        max_hours = int(hour_match.group(2))

        if max_hours < min_hours:
            issues.append("Maximum hours less than minimum hours")

        if (max_hours - min_hours) / min_hours > 0.5:
            issues.append("Hour range too wide (>50% variance)")

    return len(issues) == 0, issues

def extract_quote_metadata(quote_content: str) -> dict:
    """Extract structured metadata from quote."""
    metadata = {}

    # Extract hours
    hour_match = re.search(r'Estimated Hours:\s*(\d+)\s*to\s*(\d+)', quote_content)
    if hour_match:
        metadata['hours_min'] = int(hour_match.group(1))
        metadata['hours_max'] = int(hour_match.group(2))
        metadata['hours_avg'] = (metadata['hours_min'] + metadata['hours_max']) / 2

    # Extract timeline
    timeline_match = re.search(r'Timeline:\s*(\d+)(?:\s*to\s*(\d+))?\s*(weeks?|days?)', quote_content)
    if timeline_match:
        metadata['timeline_min'] = int(timeline_match.group(1))
        metadata['timeline_max'] = int(timeline_match.group(2)) if timeline_match.group(2) else None
        metadata['timeline_unit'] = timeline_match.group(3)

    # Extract client name
    client_match = re.search(r'Prepared for:\s*(.+)', quote_content)
    if client_match:
        metadata['client_name'] = client_match.group(1).strip()

    return metadata
```

Integrate validation into quote generation:

```python
# In llm_service.py after quote generation
from app.services.ai.quote_validator import validate_quote_format, extract_quote_metadata

async def generate_quote(...):
    # ... generate quote ...

    # Validate format
    is_valid, issues = validate_quote_format(response_content)

    if not is_valid:
        logger.warning(f"Quote format validation failed: {issues}")
        # Optionally: Regenerate with stricter prompt

    # Extract metadata
    metadata = extract_quote_metadata(response_content)

    return QuoteGenerationResult(
        content=response_content,
        total_hours=metadata.get('hours_avg'),
        total_hours_min=metadata.get('hours_min'),
        total_hours_max=metadata.get('hours_max'),
        # ...
    )
```

---

## Implementation Checklist

### Backend Implementation

- [ ] Update `prompts.py` with E2M Solutions template
- [ ] Add direct generation instructions to system prompt
- [ ] Remove question-asking behavior from quote generation
- [ ] Create `detect_quote_generation_intent()` function
- [ ] Update chat endpoint to route quote requests to quote generator
- [ ] Create `quote_validator.py` with format validation
- [ ] Integrate validation into quote generation flow
- [ ] Test RAG context retrieval is working
- [ ] Verify historical examples are being used
- [ ] Add estimation reference parameters to prompt

### Testing & Validation

- [ ] Test with sample requirements from knowledge base
- [ ] Verify quote format matches E2M template exactly
- [ ] Verify hour estimates align with reference parameters
- [ ] Test various project types (WordPress, Shopify, Custom)
- [ ] Verify all required sections are present
- [ ] Test that no clarifying questions are asked
- [ ] Validate timeline estimates are reasonable
- [ ] Test with short vs long requirement descriptions

### Documentation

- [ ] Document new quote generation flow
- [ ] Update API documentation
- [ ] Add examples of proper quote format
- [ ] Document estimation parameters

---

## Testing Plan

### Unit Tests

**Test 1: Quote Intent Detection**
```python
def test_detect_quote_intent():
    # Should detect quote requests
    assert detect_quote_generation_intent(
        "Build a WordPress website with 20 pages, e-commerce, and blog"
    ) == True

    # Should not detect simple questions
    assert detect_quote_generation_intent(
        "What do you think about this?"
    ) == False
```

**Test 2: Quote Format Validation**
```python
def test_quote_format_validation():
    valid_quote = """
    Prepared for: ACME Corp
    Prepared by: E2M Solutions
    Date: January 21, 2026

    WordPress Website Development

    1. Project Overview
    ...

    2. Estimated Cost & Timeline
    Estimated Hours: 180 to 200 hours
    Timeline: 8 to 10 weeks
    """

    is_valid, issues = validate_quote_format(valid_quote)
    assert is_valid == True
    assert len(issues) == 0
```

### Integration Tests

**Test 3: End-to-End Quote Generation**
```python
async def test_e2e_quote_generation():
    requirements = """
    We need a WordPress website for our fashion brand.
    - 15 pages including homepage, about, blog
    - E-commerce with WooCommerce
    - Custom design matching our brand
    - Integration with Mailchimp
    - Mobile responsive
    """

    result = await llm_service.generate_quote(
        requirements=requirements,
        platform="wordpress",
    )

    # Verify quote structure
    assert "Prepared by: E2M Solutions" in result.content
    assert "Estimated Hours:" in result.content
    assert result.total_hours_min is not None
    assert result.total_hours_max is not None
    assert 100 <= result.total_hours_min <= 250  # Reasonable range
```

**Test 4: RAG Context Usage**
```python
async def test_rag_context_used():
    requirements = "WordPress site with 20 pages and Elementor"

    result = await llm_service.generate_quote(
        requirements=requirements,
        platform="wordpress",
    )

    # Hours should align with reference: 180-200 hours for similar projects
    assert 150 <= result.total_hours_min <= 220
```

---

## Success Criteria

1. When requirements are pasted in chat, quote is generated DIRECTLY
2. NO clarifying questions are asked by the AI
3. Quote format matches E2M Solutions template 100%
4. Hour estimates align with provided reference parameters (±20%)
5. All required sections are present and properly formatted
6. RAG context from historical quotes is being used
7. Validation catches format issues
8. Response time is under 10 seconds for quote generation

---

## Risks & Mitigation

### Risk 1: Inaccurate Estimates Without Questions
**Mitigation**: Use RAG to retrieve similar historical projects and base estimates on proven data

### Risk 2: Format Compliance
**Mitigation**: Implement strict format validation and auto-reject non-compliant quotes

### Risk 3: Over/Under Estimation
**Mitigation**:
- Provide explicit hour ranges from historical data
- Use reference parameters in prompt
- Monitor actual vs estimated hours over time

### Risk 4: Missing Critical Requirements
**Mitigation**:
- Make reasonable industry-standard assumptions
- Clearly document assumptions in quote
- List exclusions explicitly

---

## Future Enhancements

1. **Confidence Scoring**: Add confidence score to estimates based on requirement clarity
2. **Auto-Save as Draft**: Save generated quote as draft in Quotes tab
3. **One-Click Quote**: Add "Generate Quote" button in chat UI
4. **Quote Versioning**: Allow regeneration with different parameters
5. **Export Integration**: Direct export to PDF/DOCX from chat

---

## File Changes Summary

### New Files
- `/Users/deeptrivedi/estimation/backend/app/services/ai/quote_validator.py`

### Modified Files
- `/Users/deeptrivedi/estimation/backend/app/services/ai/prompts.py`
  - Add E2M_QUOTE_TEMPLATE constant
  - Update system prompt to prevent questions
  - Add estimation reference parameters

- `/Users/deeptrivedi/estimation/backend/app/services/ai/llm_service.py`
  - Integrate quote validation
  - Extract metadata from quotes

- `/Users/deeptrivedi/estimation/backend/app/api/v1/chat.py`
  - Add detect_quote_generation_intent()
  - Route quote requests to quote generator
  - Integrate RAG context

---

## Estimated Effort Breakdown

| Task | Hours |
|------|-------|
| Update prompts and template | 4h |
| Implement intent detection | 3h |
| Create quote validator | 4h |
| Update chat routing logic | 3h |
| RAG integration verification | 2h |
| Unit tests | 4h |
| Integration tests | 4h |
| Manual testing with examples | 4h |
| Documentation | 2h |
| Buffer for iterations | 6h |
| **TOTAL** | **32h** |

---

## Dependencies

**None** - This track can be implemented immediately and independently.

---

## Related Documents

- `/Users/deeptrivedi/estimation/knowledge-based/training/quotes/` - Historical quote examples
- `/Users/deeptrivedi/estimation/knowledge-based/guidelines/estimation-guidelines.md` - Estimation rules
- `/Users/deeptrivedi/estimation/specs/rag-implementation-strategy.md` - RAG architecture
