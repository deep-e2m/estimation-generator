"""
Prompt Templates for Quote Generation.

This module provides structured prompt templates for various LLM tasks
including quote generation, chat responses, and requirement analysis.
"""

from typing import Any, Dict, List, Optional


# System prompts for different roles
SYSTEM_PROMPTS = {
    "quote_generator": """You are an expert project estimator for a digital agency specializing in web development projects.

Your role is to generate professional, detailed project quotes based on client requirements. You have extensive experience with:
- WordPress development (themes, plugins, WooCommerce, Elementor, Bricks)
- Shopify development (themes, apps, Liquid)
- Custom web applications
- Website redesigns and migrations
- Multi-language websites (WPML, Polylang)
- E-commerce solutions

When generating quotes, you should:
1. Break down the project into clear phases and tasks
2. Provide realistic hour estimates based on complexity
3. Include reasonable assumptions and exclusions
4. Highlight any risks or dependencies
5. Use a professional, confident tone

Your estimates should be thorough but concise, focusing on deliverables the client cares about.""",

    "chat_assistant": """You are an expert project estimator and quote generator for E2M Solutions, a digital agency specializing in web development.

**CRITICAL RULE: When the user pastes project requirements (descriptions of pages, features, functionality, design needs), you MUST immediately generate a complete professional quote WITHOUT asking any clarifying questions.**

## Quote Generation Format

When generating a quote, ALWAYS use this exact format:

---

**Prepared for:** [Client Name if provided, otherwise "Client"]
**Prepared by:** E2M Solutions
**Date:** [Current Date]

---

## 1. Project Overview
[2-3 sentence summary of the project scope and objectives]

## 2. Estimated Hours & Timeline
- **Total Estimated Hours:** X - Y hours
- **Estimated Timeline:** X - Y weeks
- **Hourly Rate:** As per agreed terms

## 3. Scope of Work

### Phase 1: [Phase Name] (X-Y hours)
| Task | Hours |
|------|-------|
| [Task description] | X-Y |
| [Task description] | X-Y |

### Phase 2: [Phase Name] (X-Y hours)
| Task | Hours |
|------|-------|
| [Task description] | X-Y |
| [Task description] | X-Y |

[Continue for all phases]

## 4. Assumptions & Client Responsibilities
- [Assumption 1]
- [Assumption 2]
- Client will provide [specific items]

## 5. Exclusions / Out of Scope
- [Exclusion 1]
- [Exclusion 2]
- [Any items not included]

## 6. Next Steps
1. Review and approve this estimate
2. [Next step]
3. [Next step]

---

## Hour Estimation Benchmarks (USE THESE FOR ACCURACY)

**WordPress Projects:**
- Simple brochure site (5 pages): 40-50 hours
- Medium business site (10 pages): 80-100 hours
- Large site (15-20 pages): 150-180 hours
- E-commerce with WooCommerce (20 products): 120-150 hours
- Custom theme development: 60-80 hours
- Page builder (Elementor/Bricks) per page: 4-8 hours
- Complex page with animations: 8-12 hours
- Plugin customization: 10-20 hours
- Multi-language setup (WPML): 15-25 hours

**Shopify Projects:**
- Basic store setup: 40-60 hours
- Theme customization: 30-50 hours
- Full custom theme: 100-150 hours
- App integration: 5-15 hours per app

**Design Work:**
- Homepage design: 8-16 hours
- Inner page design: 4-8 hours
- Style guide creation: 8-12 hours
- Mobile responsive design: Add 30% to development

**Content & Migration:**
- Content migration per page: 1-2 hours
- SEO setup: 10-20 hours
- Analytics setup: 4-8 hours

**Testing & QA:**
- Add 10-15% of development hours for QA
- Cross-browser testing: 8-16 hours

## Behavior Rules
1. If requirements are pasted, GENERATE THE QUOTE IMMEDIATELY
2. Do NOT ask "Can you provide more details?" - just make reasonable assumptions
3. Do NOT say "I need clarification" - include assumptions in your quote
4. Be specific with hours - avoid vague ranges like "20-100 hours"
5. Break down work into clear phases with task-level estimates
6. Include everything a professional quote needs

For general questions not related to requirements, respond helpfully and conversationally.""",

    "requirement_analyzer": """You are an expert at analyzing software project requirements.

Your role is to:
1. Identify key features and functionality
2. Spot potential gaps or ambiguities
3. Categorize requirements by type (design, development, content, etc.)
4. Suggest clarifying questions
5. Assess project complexity

Be thorough and systematic in your analysis.""",
}


def build_quote_generation_prompt(
    requirements: str,
    platform: str,
    rag_context: Optional[str] = None,
    formatting_template: Optional[str] = None,
    project_context: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, str]]:
    """
    Build the prompt for quote generation.

    Args:
        requirements: Client requirements text.
        platform: Target platform (wordpress, shopify, custom, etc.).
        rag_context: Retrieved context from similar historical quotes.
        formatting_template: Optional template for output formatting.
        project_context: Additional project context (client, industry, etc.).

    Returns:
        List of message dictionaries for the chat API.
    """
    messages: List[Dict[str, str]] = []

    # System message
    system_content = SYSTEM_PROMPTS["quote_generator"]

    # Add platform-specific expertise
    platform_expertise = {
        "wordpress": """
Additional WordPress expertise:
- Page builders: Elementor, Bricks, Gutenberg, Divi
- E-commerce: WooCommerce, product configurators
- Multi-language: WPML, Polylang
- Performance: Caching, CDN, optimization
- Custom development: Custom themes, plugins, ACF
""",
        "shopify": """
Additional Shopify expertise:
- Theme development and customization
- Liquid templating
- Shopify Apps and integrations
- Payment gateways and checkout
- Product management and inventory
""",
        "custom": """
Additional custom development expertise:
- React, Next.js, Vue.js
- Node.js, Python backend
- API development and integration
- Database design
- Cloud deployment (AWS, GCP, Azure)
""",
    }

    if platform.lower() in platform_expertise:
        system_content += platform_expertise[platform.lower()]

    messages.append({"role": "system", "content": system_content})

    # Build user prompt
    user_content = f"""Generate a professional project quote based on the following requirements.

## Client Requirements
{requirements}

## Platform
{platform}
"""

    # Add RAG context if available
    if rag_context:
        user_content += f"""
## Reference: Similar Historical Projects
The following are examples from similar projects we've completed. Use these as reference for estimation accuracy and formatting:

{rag_context}
"""

    # Add project context if available
    if project_context:
        context_parts = []
        if project_context.get("client_name"):
            context_parts.append(f"Client: {project_context['client_name']}")
        if project_context.get("industry"):
            context_parts.append(f"Industry: {project_context['industry']}")
        if project_context.get("budget_range"):
            context_parts.append(f"Budget Range: {project_context['budget_range']}")
        if project_context.get("timeline"):
            context_parts.append(f"Timeline: {project_context['timeline']}")

        if context_parts:
            user_content += f"""
## Project Context
{chr(10).join(context_parts)}
"""

    # Add formatting template or default structure
    if formatting_template:
        user_content += f"""
## Output Format
Please format the quote according to this template:
{formatting_template}
"""
    else:
        user_content += """
## Output Format
Please structure your quote with the following sections:

1. **Project Overview**
   - Brief summary of the project scope
   - Key objectives

2. **Scope of Work**
   - Detailed breakdown of deliverables
   - Organized by phase or feature area

3. **Estimated Hours**
   - Total hours: X to Y hours
   - Breakdown by phase/area (if applicable)

4. **Timeline**
   - Estimated duration: X to Y weeks
   - Key milestones (if applicable)

5. **Assumptions**
   - What is included in the estimate
   - Client responsibilities
   - Technical assumptions

6. **Out of Scope / Exclusions**
   - What is NOT included
   - Items that would require additional estimation

7. **Risks and Dependencies** (if applicable)
   - Potential blockers
   - External dependencies

Be specific with hours and avoid vague ranges. Base estimates on typical complexity for the platform.
"""

    messages.append({"role": "user", "content": user_content})

    return messages


def build_chat_response_prompt(
    messages: List[Dict[str, str]],
    project_context: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, str]]:
    """
    Build prompt for chat responses in the PM conversation.

    Args:
        messages: Conversation history.
        project_context: Optional context about the current project.

    Returns:
        List of message dictionaries for the chat API.
    """
    system_content = SYSTEM_PROMPTS["chat_assistant"]

    # Add project context to system prompt if available
    if project_context:
        context_parts = []
        if project_context.get("requirements"):
            context_parts.append(f"Current Requirements:\n{project_context['requirements']}")
        if project_context.get("platform"):
            context_parts.append(f"Platform: {project_context['platform']}")
        if project_context.get("client_name"):
            context_parts.append(f"Client: {project_context['client_name']}")
        if project_context.get("current_quote"):
            context_parts.append(f"Current Quote Status: {project_context['current_quote']}")

        if context_parts:
            system_content += f"""

## Current Project Context
{chr(10).join(context_parts)}
"""

    # Build message list
    result: List[Dict[str, str]] = [{"role": "system", "content": system_content}]

    # Add conversation history
    for msg in messages:
        # Ensure we only include role and content
        result.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", ""),
        })

    return result


def build_requirement_analysis_prompt(
    requirements: str,
    platform: Optional[str] = None,
) -> List[Dict[str, str]]:
    """
    Build prompt for analyzing and extracting requirements.

    Args:
        requirements: Raw requirements text from client.
        platform: Optional target platform for context.

    Returns:
        List of message dictionaries for the chat API.
    """
    messages: List[Dict[str, str]] = []

    messages.append({
        "role": "system",
        "content": SYSTEM_PROMPTS["requirement_analyzer"],
    })

    user_content = f"""Analyze the following project requirements and provide a structured breakdown.

## Requirements
{requirements}
"""

    if platform:
        user_content += f"""
## Target Platform
{platform}
"""

    user_content += """
## Analysis Required
Please provide:

1. **Feature Breakdown**
   - List all identified features/functionality
   - Categorize by type (design, frontend, backend, integration, content)

2. **Complexity Assessment**
   - Overall complexity: Simple / Medium / Complex
   - Rationale for assessment

3. **Ambiguities and Gaps**
   - List any unclear requirements
   - Identify missing information

4. **Clarifying Questions**
   - Questions to ask the client
   - Prioritize by importance

5. **Technical Considerations**
   - Potential challenges
   - Recommended approaches

6. **Estimated Effort Range**
   - Rough hours range (e.g., 40-60 hours)
   - Confidence level in estimate
"""

    messages.append({"role": "user", "content": user_content})

    return messages


def build_clarification_prompt(
    requirements: str,
    existing_questions: Optional[List[str]] = None,
) -> List[Dict[str, str]]:
    """
    Build prompt for generating clarification questions.

    Args:
        requirements: Current requirements text.
        existing_questions: Questions already asked.

    Returns:
        List of message dictionaries for the chat API.
    """
    messages: List[Dict[str, str]] = []

    system_content = """You are an expert at identifying gaps in project requirements and asking insightful clarifying questions.

Focus on questions that will:
1. Reduce estimation risk
2. Clarify scope boundaries
3. Identify technical constraints
4. Understand client expectations

Keep questions concise and focused. Prioritize the most impactful questions."""

    messages.append({"role": "system", "content": system_content})

    user_content = f"""Based on these requirements, generate 3-5 clarifying questions to ask the client.

## Requirements
{requirements}
"""

    if existing_questions:
        user_content += f"""
## Questions Already Asked
{chr(10).join(f"- {q}" for q in existing_questions)}

Generate NEW questions that haven't been asked yet.
"""

    user_content += """
## Output Format
Provide questions in this format:
1. [Question] - [Why this matters for estimation]
2. [Question] - [Why this matters for estimation]
...

Focus on questions that will most reduce estimation uncertainty."""

    messages.append({"role": "user", "content": user_content})

    return messages


def build_quote_refinement_prompt(
    original_quote: str,
    feedback: str,
    requirements: str,
) -> List[Dict[str, str]]:
    """
    Build prompt for refining an existing quote based on feedback.

    Args:
        original_quote: The original generated quote.
        feedback: PM or client feedback on the quote.
        requirements: Original requirements for context.

    Returns:
        List of message dictionaries for the chat API.
    """
    messages: List[Dict[str, str]] = []

    messages.append({
        "role": "system",
        "content": SYSTEM_PROMPTS["quote_generator"],
    })

    user_content = f"""Refine this quote based on the provided feedback.

## Original Requirements
{requirements}

## Original Quote
{original_quote}

## Feedback
{feedback}

## Instructions
Please provide a revised quote that addresses the feedback while maintaining professional quality.
Clearly indicate what has changed from the original quote.
"""

    messages.append({"role": "user", "content": user_content})

    return messages


def build_vision_analysis_prompt(
    context: str,
    analysis_type: str = "ui_mockup",
) -> str:
    """
    Build prompt for vision/image analysis.

    Args:
        context: Description of what to analyze.
        analysis_type: Type of analysis (ui_mockup, design_file, screenshot).

    Returns:
        Prompt string for vision models.
    """
    prompts = {
        "ui_mockup": f"""Analyze this UI mockup/design and provide:

1. **Components Identified**
   - List all UI components visible
   - Note any interactive elements

2. **Complexity Assessment**
   - Estimate development complexity (Simple/Medium/Complex)
   - Note any custom components needed

3. **Technical Requirements**
   - Animations or interactions needed
   - Responsive considerations
   - Accessibility requirements

4. **Development Estimate**
   - Rough hours to implement
   - Key development challenges

Context: {context}
""",
        "design_file": f"""Analyze this design file and extract:

1. **Design Elements**
   - Typography used
   - Color palette
   - Spacing patterns

2. **Component Library**
   - Reusable components identified
   - Unique/custom elements

3. **Implementation Notes**
   - CSS/styling approach
   - Animation requirements
   - Asset requirements

Context: {context}
""",
        "screenshot": f"""Analyze this screenshot and provide:

1. **Current State Assessment**
   - What the page/feature does
   - Current functionality

2. **Improvement Opportunities**
   - UX improvements
   - Technical improvements

3. **Comparison Notes**
   - If this is a reference site, note key features to replicate
   - Estimate effort to achieve similar quality

Context: {context}
""",
    }

    return prompts.get(analysis_type, prompts["ui_mockup"])


def format_rag_context(
    similar_quotes: List[Dict[str, Any]],
    max_length: int = 8000,
) -> str:
    """
    Format retrieved similar quotes into RAG context.

    Args:
        similar_quotes: List of similar quote dictionaries from RAG search.
        max_length: Maximum character length for context.

    Returns:
        Formatted context string.
    """
    if not similar_quotes:
        return ""

    context_parts: List[str] = []
    current_length = 0

    for i, quote in enumerate(similar_quotes, 1):
        quote_text = f"""
### Reference Project {i}
**Platform**: {quote.get('platform', 'Unknown')}
**Project Type**: {quote.get('project_type', 'Unknown')}
**Total Hours**: {quote.get('total_hours', 'N/A')}
**Similarity Score**: {quote.get('similarity_score', 0):.2f}

**Summary**:
{quote.get('summary', 'No summary available')}

**Key Details**:
{quote.get('content', '')[:1500]}
"""
        part_length = len(quote_text)

        if current_length + part_length > max_length:
            # Truncate or skip remaining quotes
            break

        context_parts.append(quote_text)
        current_length += part_length

    return "\n---\n".join(context_parts)


# Prompt templates for specific use cases
QUOTE_TEMPLATES = {
    "wordpress_branding_refresh": """
## Quote Structure for WordPress Branding Refresh

### Project Overview
Brief description of the branding refresh scope.

### Scope of Work
A. Global Styling & Visual Consistency
B. Header & Footer Optimization
C. Homepage Enhancements
D. Internal Page Element Optimization
E. Imagery & Iconography Refresh

### Deliverables
- Updated front-end visual styles
- Refined global components
- QA and responsive testing

### Estimated Hours
X to Y hours

### Timeline
X to Y business days

### Assumptions
- No changes to site structure, navigation, or content
- Updates limited to HTML/CSS-level adjustments
- Client will provide final brand fonts and imagery

### Out of Scope
- Page rebuilds or layout restructuring
- Content writing or copy updates
- SEO, performance, or accessibility audits
""",

    "wordpress_full_build": """
## Quote Structure for WordPress Full Build

### Project Overview
Summary of the website build including platform and key features.

### Website Structure
- List of pages with brief descriptions

### Design Phase (if applicable)
- Design hours breakdown

### Development Phase
- Setup and configuration
- Page development
- Plugin integration
- Content migration (if applicable)

### Estimated Total Hours
X to Y hours

### Estimated Timeline
X to Y weeks

### Assumptions
- Client provides final content
- Client provides final designs (if design not included)
- Listed plugins to be purchased by client

### Exclusions
- Copywriting services
- Custom animations beyond standard capabilities
- Ongoing maintenance
""",

    "shopify_store": """
## Quote Structure for Shopify Store

### Project Overview
E-commerce store summary and platform details.

### Store Configuration
- Theme setup and customization
- Product setup
- Payment and shipping configuration

### Design & Development
- Homepage
- Collection pages
- Product pages
- Cart and checkout customization
- Additional pages

### Integrations
- Apps and third-party integrations

### Estimated Hours
X to Y hours

### Timeline
X to Y weeks

### Assumptions
- Client provides product data
- Standard Shopify checkout
- Theme-based customization

### Out of Scope
- Custom Shopify app development
- Product photography
- Marketing automation setup
""",
}
