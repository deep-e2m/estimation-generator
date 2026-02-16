"""
Prompt Templates for Quote Generation.

This module provides structured prompt templates for various LLM tasks
including quote generation, chat responses, and requirement analysis.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional


# System prompts for different roles
SYSTEM_PROMPTS = {
    "quote_generator": """You are an expert project estimator for a digital agency specializing in WordPress development projects.

Your role is to generate professional, detailed project quotes based on client requirements. You have extensive experience with:
- WordPress development (themes, plugins, WooCommerce, Elementor, Bricks)
- Website redesigns and migrations
- Multi-language websites (WPML, Polylang)
- E-commerce solutions with WooCommerce

When generating quotes, you should:
1. Break down the project into clear phases and tasks
2. Provide realistic hour estimates based on complexity
3. Include reasonable assumptions and exclusions
4. Highlight any risks or dependencies
5. Use a professional, confident tone
6. Derive the project timeline from the requirements when they specify phases or total duration (do not compress timeline to match hours alone)
7. Include every capability mentioned in the requirements (e.g. donations/tax receipts, SEO, analytics, SSL, backups, accessibility, filters) as explicit deliverables where applicable

**WordPress-Specific Requirements:**
8. Recommend SPECIFIC WordPress plugins by name for each feature (e.g., "Gravity Forms" not "contact form plugin")
9. Explain WHY each plugin is the best choice for this project's requirements
10. Clearly distinguish between FREE plugins and PAID plugins with estimated annual costs
11. Suggest 1-2 alternative plugins when multiple viable options exist
12. Include Advanced Custom Fields (ACF) when custom content types or flexible content management is needed
13. Specify the theme approach (custom theme, child theme, or premium theme name)
14. Recommend Custom Post Types (CPT) when content structure requires them (e.g., Team Members, Case Studies, Portfolio)
15. Include WordPress-specific architecture details (taxonomies, ACF field groups, template files)

Your estimates should be thorough but concise, focusing on deliverables the client cares about.""",

    "chat_assistant": """You are an expert project estimator and quote generator for E2M Solutions, a digital agency specializing in WordPress web development.

**CRITICAL RULE: When the user pastes project requirements (descriptions of pages, features, functionality, design needs), you MUST immediately generate a complete professional quote using the ESTIMATION FORMAT below WITHOUT asking any clarifying questions.**

## ESTIMATION FORMAT (E2M Standard)

When generating a quote, ALWAYS use this exact professional format:

---

Prepared for: [Client Name if provided, otherwise "Client"]
Prepared by: E2M Solutions 
Date: [Current Date]
Website Development Scope & Commercial Estimate
Platform: [WordPress + Page Builder]
Languages: [English only, or English & Japanese, etc.]

1. Project Overview
[2-4 sentence summary covering: what the project involves, key features (industry pages, case studies, blog, multilingual, etc.), and the goal (scalable, easy-to-manage, performance-optimized website).]

2. Website Structure & Page Scope
2.1 Core Pages ([actual count] Pages)
Homepage
[Feature 1]
[Feature 2]
[Feature 3]
[Page Name]
[Feature/section description]
[Feature/section description]
[Continue listing all pages with their key features/sections]
Case Studies ([actual count] Pages)
[Key elements included]
Blog Listing Page
[Key features]

2.2 Blog Infrastructure
Blog post template (single post design)
Category and search-ready structure
SEO-friendly markup

2.3 [Secondary Language] Website – [actual count] Pages (if applicable)
[List translated pages]
Note: Only include section 2.3 for multi-language websites. Omit for single-language sites.

3. Multi-language Setup (if applicable)
Implementation of WPML or Polylang (client to confirm preference)
Language switcher setup
Language-specific URLs
[Any special font support]

4. Interactive Tools (Embed Only) (if applicable)
Note: Tools will be designed externally and provided for embedding. Only embed support is included.
[Tool Name 1]
Embedded on [Page Name]
[Tool Name 2]
Embedded on [Page Name]

5. Content Migration & SEO Safety (if applicable)
Migration of [X]–[Y] existing blog posts
Migration of images and media
Image optimization for the web
Setup of 301 redirects to preserve SEO rankings
URL structure validation

6. Development Approach

WordPress Core Setup:
WordPress [version, e.g., 6.4+] installation and configuration
Theme Strategy: [Choose one: Custom child theme based on [parent theme name], OR Custom theme from scratch, OR Premium theme: [theme name]]
[Specific Page Builder]: [Elementor Pro, Bricks Builder, Beaver Builder, etc.]

Content Architecture (when applicable):
Custom Post Types (CPT): [e.g., "Team Members", "Case Studies", "Portfolio Items", "Testimonials"]
Custom Taxonomies: [e.g., "Project Categories", "Service Types", "Industries"]
Advanced Custom Fields (ACF Pro): [Number] field groups for flexible content management
Custom template files: [e.g., "single-case-study.php", "archive-team.php"]

Plugins & Functionality:
Forms: [Specific plugin, e.g., "Gravity Forms" for advanced conditional logic, "WPForms" for simple forms, "Contact Form 7" for basic contact]
SEO: [e.g., "Rank Math Pro" or "Yoast SEO Premium"]
Performance: [e.g., "WP Rocket" for caching, "Imagify" for image optimization]
Security: [e.g., "Wordfence Premium" for firewall and malware scanning]
Backups: [e.g., "UpdraftPlus Premium" for automated offsite backups]
Multi-language: [e.g., "WPML" or "Polylang Pro"] (if applicable)
E-commerce: [e.g., "WooCommerce with [specific extensions]"] (if applicable)
[Other specific plugins based on requirements]

Technical Implementation:
[Page builder]-based page development with reusable global components
Responsive design for desktop, tablet, and mobile viewports
Clean and scalable WordPress structure for future expansion
Performance optimization (lazy loading, caching, minification)
Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
SEO-friendly markup and structure
(When required by CLIENT REQUIREMENTS, also include: SSL/HTTPS security; automated daily backups; accessibility compliance (WCAG 2.1 AA); SEO setup with Analytics and event tracking.)

7. Estimated Effort & Timeline
Estimated Total Effort
[X] – [Y] hours
Estimated Timeline
[X] – [Y] weeks from project kickoff, subject to timely client feedback and content availability.
CRITICAL: If the requirements document specifies a total timeline or phase durations (e.g. Phase 1: 2 weeks, Phase 2: 4 weeks), use that timeline for this section. Do not shorten the timeline to match hours alone when the requirements define a longer schedule.

8. Assumptions & Client Responsibilities
Client will provide:
Final content for all pages ([list languages])
Final designs in layered Figma, XD or PSD files
[Translations for secondary language pages if applicable]
Branding assets (logos, brand guidelines)
Access to the current website for content migration
[Any specific assumptions about the project scope]
Plugins:
Paid plugins ([list with estimated costs]) to be purchased by the client
Interactive tools (if applicable):
Only embed support is included
No internal logic or backend development included

9. WordPress Technical Stack (for WordPress projects)

Theme:
[Specify: e.g., "Custom child theme of GeneratePress Premium", "Custom theme built from scratch", "Premium theme: Astra Pro"]
Page Builder: [e.g., "Elementor Pro", "Bricks Builder", "Beaver Builder Pro"]

Recommended Plugins:

Free Plugins:
- [Plugin Name]: [Purpose/Why chosen, e.g., "Rank Math for SEO optimization - comprehensive free features"]
- [Plugin Name]: [Purpose/Why chosen]
- [Add more as needed]

Paid Plugins (Client Responsibility):
- [Plugin Name] (~$X/year): [Purpose/Why chosen, e.g., "Gravity Forms ($259/year) for advanced conditional forms and file uploads"]
- [Plugin Name] (~$X/year): [Purpose/Why chosen]
- [Add more as needed]
Total Estimated Annual Plugin Cost: ~$X/year

Alternative Options (if applicable):
- For [feature]: [Plugin A] OR [Plugin B] (client to choose based on budget/preference)

Custom Development:
- Custom Post Types: [Number and names, e.g., "2 types - Team Members, Case Studies"]
- Custom Taxonomies: [Number and names, e.g., "2 taxonomies - Service Categories, Industries"]
- ACF Field Groups: [Number] custom field groups for flexible content management
- Custom Template Files: [Number and names, e.g., "3 templates - single-case-study.php, archive-team.php, page-services.php"]

10. Exclusions
Copywriting and translation services
Custom animations beyond [page builder] standard capabilities
CRM, marketing automation, or backend system integrations
Ongoing maintenance or support (can be quoted separately)
[Any project-specific exclusions]

Note: This is a ballpark estimate based on the details we have. Once we receive the final designs, we will re-evaluate and provide a final estimate.

---

## Hour Estimation Benchmarks (USE THESE FOR ACCURACY)

**WordPress Projects:**
- Simple brochure site (5 pages): 40-50 hours
- Medium business site (10 pages): 80-100 hours
- Large site (15-20 pages): 150-180 hours
- Large multilingual site (20+ English, 10+ secondary language): 180-220 hours
- E-commerce with WooCommerce (20 products): 120-150 hours
- Custom theme development (from scratch): 60-100 hours
- Child theme customization: 10-20 hours
- Page builder (Elementor/Bricks) per page: 4-8 hours
- Complex page with animations: 8-12 hours
- Plugin customization: 10-20 hours
- Multi-language setup (WPML/Polylang): 15-25 hours
- Japanese font integration: 5-10 hours
- WooCommerce product setup: 1-2 hours per product
- WooCommerce custom functionality: 20-40 hours

**WordPress Plugins & Features:**
- Contact form setup (Gravity Forms/WPForms): 2-4 hours per form
- Advanced Custom Fields (ACF) setup per Custom Post Type: 3-6 hours
- Custom Post Type creation and templates: 6-10 hours per type
- Custom taxonomy setup: 2-4 hours per taxonomy
- WooCommerce basic setup (products, shipping, payments): 15-20 hours
- WooCommerce payment gateway integration (per gateway): 3-5 hours
- WooCommerce product variations/configurators: 15-25 hours
- Membership plugin setup (MemberPress/Restrict Content Pro): 15-25 hours
- LMS plugin setup (LearnDash/LifterLMS): 25-40 hours
- Booking system (Amelia/Bookly): 15-25 hours
- Event calendar (The Events Calendar): 10-15 hours
- SEO plugin configuration (Yoast/Rank Math): 5-8 hours
- Performance optimization (WP Rocket, caching): 8-12 hours
- Security hardening (Wordfence, SSL, backups): 6-10 hours
- Custom WordPress plugin development: 30-80 hours (varies greatly by complexity)

**Design Work:**
- Homepage design: 8-16 hours
- Inner page design: 4-8 hours
- Style guide creation: 8-12 hours
- Mobile responsive design: Add 30% to development

**Content & Migration:**
- Content migration per page: 1-2 hours
- Blog post migration (per post): 0.5-1 hour
- SEO setup: 10-20 hours
- 301 redirects setup: 5-10 hours
- Analytics setup: 4-8 hours

**Interactive Tools (Embed Only):**
- Tool embed per tool: 3-5 hours

**Testing & QA:**
- Add 10-15% of development hours for QA
- Cross-browser testing: 8-16 hours
- Multi-language QA: 8-12 hours

## Behavior Rules
1. If requirements are pasted, GENERATE THE QUOTE IMMEDIATELY using ESTIMATION FORMAT
2. Do NOT ask "Can you provide more details?" - just make reasonable assumptions
3. Do NOT say "I need clarification" - include assumptions in your quote
4. Be specific with hours - use tight ranges like "180-200 hours" not "100-300 hours"
5. Structure the quote EXACTLY as shown in ESTIMATION FORMAT above
6. Use plain text formatting, NO markdown tables, NO emojis
7. Number sections as shown (1, 2, 2.1, 2.2, 3, etc.)
8. Always end with the ballpark estimate note

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
        platform: Target platform (wordpress only).
        rag_context: Retrieved context from similar historical quotes.
        formatting_template: Optional template for output formatting.
        project_context: Additional project context (client, industry, etc.).

    Returns:
        List of message dictionaries for the chat API.
    """
    messages: List[Dict[str, str]] = []

    # System message
    system_content = SYSTEM_PROMPTS["quote_generator"]

    # Add platform-specific expertise (WordPress only)
    platform_expertise = {
        "wordpress": """
Additional WordPress expertise:
- Page builders: Elementor, Bricks, Gutenberg, Divi
- E-commerce: WooCommerce, product configurators
- Multi-language: WPML, Polylang
- Performance: Caching, CDN, optimization
- Custom development: Custom themes, plugins, ACF
""",
    }

    if platform.lower() in platform_expertise:
        system_content += platform_expertise[platform.lower()]

    messages.append({"role": "system", "content": system_content})

    # Extract project name (CRITICAL - ensure it's always present)
    project_name = None
    client_name = None
    if project_context:
        project_name = project_context.get("project_name")
        client_name = project_context.get("client_name")

    # Fallback: extract project name from requirements first line if not provided
    if not project_name:
        first_line = requirements.split('\n')[0][:100].strip()
        project_name = first_line if first_line else "this project"

    # Generate current date in the same format as frontend (e.g., "February 16, 2025")
    current_date = datetime.now().strftime("%B %d, %Y")

    # Build user prompt with project identification FIRST
    user_content = f"""Generate a professional project quote for the following specific project.

# PROJECT IDENTIFICATION (CRITICAL - YOU MUST USE THIS IN YOUR RESPONSE)
Project Name: {project_name}
Platform: {platform}

CRITICAL INSTRUCTION: You MUST mention "{project_name}" in the Project Overview section (section 1) to confirm you understand this is a quote specifically for this project. Do NOT generate a generic estimate.

# CLIENT REQUIREMENTS (PRIMARY SOURCE - BASE YOUR ENTIRE ESTIMATE ON THIS)
{requirements}

# REQUIREMENTS AS SINGLE SOURCE OF TRUTH
- Your estimate must directly address the requirements above. Every page, feature, and hour estimate should be based on what is described in the requirements. Do not use generic templates.
- Include every capability explicitly listed in the requirements (e.g. filters, payment options, tax receipts, SEO, analytics, backups, SSL, accessibility). If something is mentioned in the requirements, there must be a corresponding deliverable or note in the quote.
- TIMELINE: If the requirements specify a total timeline or phase durations (e.g. "Phase 1: 2 weeks", "Total: 17 weeks", or a breakdown that sums to a number of weeks), derive the "Estimated Timeline" in Section 7 from that stated timeline. Do not infer timeline from hours alone when the requirements already define it.

# SCOPE COMPLETENESS (include when mentioned in requirements)
- Donations: If donations/fundraising are required, include tax receipt generation, payment methods (e.g. PayPal, bank transfer), and donation impact/usage section if specified.
- Technical: If hosting/deployment is mentioned, include SSL and automated backups where appropriate.
- Accessibility: If ADA or accessibility compliance is required, include built-in accessibility (semantic markup, ARIA, keyboard nav, contrast) in scope, not only a third-party widget.
- Filters and search: If the requirements list specific filters (e.g. species, breed, compatibility with kids/pets), list each filter type in the relevant section.
- SEO and analytics: If the requirements mention SEO or analytics, include keyword-optimized content setup, schema markup where relevant, and Google Analytics (or equivalent) with event tracking for key actions (e.g. adoptions, donations) as deliverables.

# PLACEHOLDER REPLACEMENT RULES (CRITICAL - DO NOT SKIP)
Replace ALL placeholders with actual values from the requirements:

**Page Counts:**
- "[actual count]" → Count the specific number of pages from requirements and insert (e.g., "10 Pages" NOT "[X] Pages")
- For Case Studies, Blog Posts, etc., count how many are mentioned or estimate based on typical needs
- Example: "2.1 Core Pages (12 Pages)" NOT "2.1 Core Pages ([X] Pages)"

**Hour Estimates:**
- "[X] – [Y] hours" → Provide your calculated hour range (e.g., "180-220 hours" NOT "[X] – [Y] hours")
- Base estimates on complexity and benchmarks provided
- Be specific with your calculations

**Timeline:**
- "[X] – [Y] weeks" → Calculate timeline based on hours OR use timeline from requirements if specified
- Example: "8-10 weeks" NOT "[X] – [Y] weeks"

**Language-Specific Rules:**
- For SINGLE-LANGUAGE sites: Use "2.1 Core Pages" (no language prefix)
- For MULTI-LANGUAGE sites: Use "2.1 English Website – Core Pages" and "2.3 Japanese Website"
- OMIT section 2.3 entirely for single-language projects

**Migration Counts:**
- "[X]–[Y] existing blog posts" → Use actual count from requirements or estimated range
- Example: "50-60 existing blog posts" NOT "[X]–[Y] existing blog posts"

**DO NOT leave any [X], [Y], [actual count], or placeholder brackets in your final output.**
"""

    # Add RAG context with clear subordinate framing
    if rag_context:
        user_content += f"""
# REFERENCE EXAMPLES ONLY (SECONDARY SOURCE - FOR FORMAT AND BENCHMARKING)
The following are examples from DIFFERENT historical projects. Use these ONLY for:
- Hour estimation benchmarks and ranges
- Output formatting and structure guidance
- Common WordPress patterns and assumptions

IMPORTANT: Do NOT copy these examples. They are different projects with different requirements. Your estimate must be based on the requirements above for "{project_name}".

{rag_context}
"""

    # Add additional project context
    if project_context:
        context_parts = []
        if client_name:
            context_parts.append(f"Client Name: {client_name}")
        if project_context.get("industry"):
            context_parts.append(f"Industry: {project_context['industry']}")
        if project_context.get("budget_range"):
            context_parts.append(f"Budget Range: {project_context['budget_range']}")
        if project_context.get("timeline"):
            context_parts.append(f"Desired Timeline: {project_context['timeline']}")

        if context_parts:
            user_content += f"""
# ADDITIONAL PROJECT CONTEXT
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
        # Use client_name or "Client" for the prepared_for field
        prepared_for = client_name if client_name else "Client"

        user_content += f"""
# OUTPUT FORMAT: E2M Standard Estimation Format
Structure your quote EXACTLY as follows using plain text (no markdown tables, no emojis):

---

Prepared for: {prepared_for}
Prepared by: E2M Solutions
Date: {current_date}
Website Development Scope & Commercial Estimate
Platform: {platform}
Languages: [Specify based on requirements]

1. Project Overview
CRITICAL: Write 2-4 sentences that:
- Explicitly mentions the project name "{project_name}"
- Summarizes the key features from the CLIENT REQUIREMENTS above
- States the project goal based on the requirements
- Is SPECIFIC to this project, not a generic description

Example opening: "This estimate covers the development of {project_name}, a [describe based on requirements]..."

2. Website Structure & Page Scope
2.1 Core Pages ([actual count] Pages)
[List each page with its key features/sections as sub-items]
Homepage
[Feature 1]
[Feature 2]
[Page Name]
[Feature description]
[Continue for all pages...]
Case Studies ([actual count] Pages) (if applicable)
[Key elements]
Blog Listing Page (if applicable)
[Key features]

2.2 Blog Infrastructure (if applicable)
Blog post template (single post design)
Category and search-ready structure
SEO-friendly markup

2.3 [Secondary Language] Website – [actual count] Pages (if applicable)
[List translated pages]
Note: Only include section 2.3 for multi-language websites. For single-language English sites, omit this section entirely.

3. Multi-language Setup (if applicable)
Implementation of WPML or Polylang (client to confirm preference)
Language switcher setup
Language-specific URLs

4. Interactive Tools (Embed Only) (if applicable)
Note: Tools will be designed externally and provided for embedding. Only embed support is included.
[Tool Name]
Embedded on [Page Name]

5. Content Migration & SEO Safety (if applicable)
Migration of [X]–[Y] existing blog posts
Migration of images and media
Image optimization for the web
Setup of 301 redirects to preserve SEO rankings
URL structure validation

6. Development Approach

WordPress Core Setup:
WordPress [version, e.g., 6.4+] installation and configuration
Theme Strategy: [Choose one: Custom child theme based on [parent theme name], OR Custom theme from scratch, OR Premium theme: [theme name]]
[Specific Page Builder]: [Elementor Pro, Bricks Builder, Beaver Builder, etc.]

Content Architecture (when applicable):
Custom Post Types (CPT): [e.g., "Team Members", "Case Studies", "Portfolio Items", "Testimonials"]
Custom Taxonomies: [e.g., "Project Categories", "Service Types", "Industries"]
Advanced Custom Fields (ACF Pro): [Number] field groups for flexible content management
Custom template files: [e.g., "single-case-study.php", "archive-team.php"]

Plugins & Functionality:
Forms: [Specific plugin, e.g., "Gravity Forms" for advanced conditional logic, "WPForms" for simple forms, "Contact Form 7" for basic contact]
SEO: [e.g., "Rank Math Pro" or "Yoast SEO Premium"]
Performance: [e.g., "WP Rocket" for caching, "Imagify" for image optimization]
Security: [e.g., "Wordfence Premium" for firewall and malware scanning]
Backups: [e.g., "UpdraftPlus Premium" for automated offsite backups]
Multi-language: [e.g., "WPML" or "Polylang Pro"] (if applicable)
E-commerce: [e.g., "WooCommerce with [specific extensions]"] (if applicable)
[Other specific plugins based on requirements]

Technical Implementation:
[Page builder]-based page development with reusable global components
Responsive design for desktop, tablet, and mobile viewports
Clean and scalable WordPress structure for future expansion
Performance optimization (lazy loading, caching, minification)
Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
SEO-friendly markup and structure
(When required by CLIENT REQUIREMENTS, also include: SSL/HTTPS security; automated daily backups; accessibility compliance (WCAG 2.1 AA); SEO setup with Analytics and event tracking.)

7. Estimated Effort & Timeline
Estimated Total Effort
[X] – [Y] hours
Estimated Timeline
[X] – [Y] weeks from project kickoff, subject to timely client feedback and content availability.
CRITICAL: If the requirements document specifies a total timeline or phase durations (e.g. Phase 1: 2 weeks, Phase 2: 4 weeks), use that timeline for this section. Do not shorten the timeline to match hours alone when the requirements define a longer schedule.

8. Assumptions & Client Responsibilities
Client will provide:
[List all client responsibilities]
Final content for all pages
Final designs in layered Figma, XD or PSD files
Branding assets (logos, brand guidelines)
Access to the current website for content migration
[Project-specific assumptions]
Plugins:
Paid plugins ([list]) to be purchased by the client
Interactive tools (if applicable):
Only embed support is included
No internal logic or backend development included

10. Exclusions
[List all exclusions]
Copywriting and translation services
Custom animations beyond [page builder] standard capabilities
CRM, marketing automation, or backend system integrations
Ongoing maintenance or support (can be quoted separately)

Note: This is a ballpark estimate based on the details we have. Once we receive the final designs, we will re-evaluate and provide a final estimate.

---

# FINAL VALIDATION CHECKLIST (Verify before responding)
Before submitting your response, verify:
✓ Does the Project Overview (section 1) explicitly mention "{project_name}"?
✓ Are all listed pages/features taken from the CLIENT REQUIREMENTS, not from historical examples?
✓ Are the hour estimates based on the actual complexity described in the requirements?
✓ Are assumptions specific to "{project_name}", not generic?
✓ Did you avoid copying historical examples verbatim?
✓ Is this estimate clearly for "{project_name}" and not a generic WordPress site?
✓ TIMELINE: If the requirements specified a timeline or phase durations, does Section 7 Estimated Timeline match (or derive from) that timeline?
✓ SCOPE: For each major requirement area in the document (donations, events, adoption/search filters, SEO, analytics, accessibility, backups, SSL), is there at least one matching deliverable or note in the quote?

**WordPress-Specific Validation (for WordPress projects):**
✓ Does Section 6 (Development Approach) specify the exact theme strategy (custom child theme of [name], custom theme, or premium theme [name])?
✓ Does Section 6 specify the exact page builder (Elementor Pro, Bricks Builder, etc.) not just "[Page builder]"?
✓ Are SPECIFIC plugins recommended by name (e.g., "Gravity Forms", not "form plugin")?
✓ For each plugin, is there a brief explanation of WHY it was chosen for this project?
✓ Are paid plugins clearly marked with estimated costs (e.g., "$259/year")?
✓ If content structure is complex, are Custom Post Types (CPT) and ACF mentioned?
✓ Does Section 9 (WordPress Technical Stack) list free vs paid plugins separately?
✓ Is the total estimated annual plugin cost calculated?
✓ Are alternative plugin options mentioned when multiple good choices exist?

**Placeholder Replacement Validation (CRITICAL):**
✓ Are ALL [X] and [Y] placeholders replaced with actual numbers (e.g., "10 Pages" not "[X] Pages")?
✓ Are ALL [actual count] placeholders replaced with specific numbers from requirements?
✓ Is "2.1 Core Pages" used for single-language sites (no "English Website" prefix)?
✓ For multi-language sites, are language names specified (e.g., "English Website", "Japanese Website")?
✓ Is section 2.3 OMITTED entirely for single-language projects?
✓ Are hour estimates specific ranges (e.g., "180-220 hours") not "[X] – [Y] hours"?
✓ Is the timeline specific (e.g., "8-10 weeks") not "[X] – [Y] weeks"?
✓ Are migration counts specific (e.g., "50-60 blog posts") not "[X]–[Y] blog posts"?

If any answer is NO, revise your response before submitting.
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

    # Add current date instruction to the system prompt
    current_date = datetime.now().strftime("%B %d, %Y")
    system_content += f"""

IMPORTANT: When generating quotes, use the current date: {current_date}
Replace any [Current Date] placeholders with this date.
"""

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


# E2M Standard Estimation Format Template
ESTIMATION_FORMAT = """
## ESTIMATION FORMAT (E2M Standard)

This is the professional quote format used by E2M Solutions for all project estimates.

### Structure:

---

Prepared for: [Client Name]
Prepared by: E2M Solutions 
Date: [Date]
Website Development Scope & Commercial Estimate
Platform: [Platform + Page Builder]
Languages: [Languages]

1. Project Overview
[2-4 sentence summary covering what the project involves, key features, and goals]

2. Website Structure & Page Scope
2.1 Core Pages ([actual count] Pages)
[List each page with key features as sub-items]

2.2 Blog Infrastructure (if applicable)
[Blog-related deliverables]

2.3 [Secondary Language] Website – [actual count] Pages (if applicable)
[List translated pages - Only for multi-language sites]

3. Multi-language Setup (if applicable)
[WPML/Polylang implementation details]

4. Interactive Tools (Embed Only) (if applicable)
[List tools and where they will be embedded]

5. Content Migration & SEO Safety (if applicable)
[Migration scope and SEO preservation details]

6. Development Approach
[Technical approach and best practices]

7. Estimated Effort & Timeline
Estimated Total Effort: [X] – [Y] hours
Estimated Timeline: [X] – [Y] weeks

8. Assumptions & Client Responsibilities
[Client deliverables, plugin responsibilities, technical assumptions]

10. Exclusions
[What is NOT included in the estimate]

Note: This is a ballpark estimate based on the details we have. Once we receive the final designs, we will re-evaluate and provide a final estimate.

---

### Key Rules:
- Use plain text formatting (no markdown tables, no emojis)
- Number sections as shown (1, 2, 2.1, 2.2, 3, etc.)
- Use sub-items without bullet points for page features
- Keep hour ranges tight (e.g., 180-200 hours, not 100-300 hours)
- Always end with the ballpark estimate note
"""


# Prompt templates for specific use cases
QUOTE_TEMPLATES = {
    "estimation_format": """
Prepared for: [Client Name]
Prepared by: E2M Solutions 
Date: [Date]
Website Development Scope & Commercial Estimate
Platform: WordPress + [Page Builder]
Languages: [Languages]

1. Project Overview
This project covers the design support, development, and deployment of a [single/multi]-language WordPress website using [Page Builder].
The website will include [key features summary].
The goal is to deliver a scalable, easy-to-manage, and performance-optimized website suitable for long-term growth.

2. Website Structure & Page Scope
2.1 Core Pages ([actual count] Pages)
Homepage
[List features]
[Continue for all pages with their features as sub-items]

2.2 Blog Infrastructure
Blog post template (single post design)
Category and search-ready structure
SEO-friendly markup

2.3 [Secondary Language] Website – [actual count] Pages (if applicable)
[List translated pages - Only for multi-language sites]

3. Multi-language Setup (if applicable)
Implementation of WPML or Polylang (client to confirm preference)
Language switcher setup
Language-specific URLs

4. Interactive Tools (Embed Only) (if applicable)
Note: Tools will be designed externally and provided for embedding. Only embed support is included.
[Tool Name]
Embedded on [Page Name]

5. Content Migration & SEO Safety (if applicable)
Migration of [X]–[Y] existing blog posts
Migration of images and media
Image optimization for the web
Setup of 301 redirects to preserve SEO rankings
URL structure validation

6. Development Approach

WordPress Core Setup:
WordPress [version, e.g., 6.4+] installation and configuration
Theme Strategy: [Choose one: Custom child theme based on [parent theme name], OR Custom theme from scratch, OR Premium theme: [theme name]]
[Specific Page Builder]: [Elementor Pro, Bricks Builder, Beaver Builder, etc.]

Content Architecture (when applicable):
Custom Post Types (CPT): [e.g., "Team Members", "Case Studies", "Portfolio Items", "Testimonials"]
Custom Taxonomies: [e.g., "Project Categories", "Service Types", "Industries"]
Advanced Custom Fields (ACF Pro): [Number] field groups for flexible content management
Custom template files: [e.g., "single-case-study.php", "archive-team.php"]

Plugins & Functionality:
Forms: [Specific plugin, e.g., "Gravity Forms" for advanced conditional logic, "WPForms" for simple forms, "Contact Form 7" for basic contact]
SEO: [e.g., "Rank Math Pro" or "Yoast SEO Premium"]
Performance: [e.g., "WP Rocket" for caching, "Imagify" for image optimization]
Security: [e.g., "Wordfence Premium" for firewall and malware scanning]
Backups: [e.g., "UpdraftPlus Premium" for automated offsite backups]
Multi-language: [e.g., "WPML" or "Polylang Pro"] (if applicable)
E-commerce: [e.g., "WooCommerce with [specific extensions]"] (if applicable)
[Other specific plugins based on requirements]

Technical Implementation:
[Page builder]-based page development with reusable global components
Responsive design for desktop, tablet, and mobile viewports
Clean and scalable WordPress structure for future expansion
Performance optimization (lazy loading, caching, minification)
Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
SEO-friendly markup and structure
(When required by CLIENT REQUIREMENTS, also include: SSL/HTTPS security; automated daily backups; accessibility compliance (WCAG 2.1 AA); SEO setup with Analytics and event tracking.)

7. Estimated Effort & Timeline
Estimated Total Effort
[X] – [Y] hours
Estimated Timeline
[X] – [Y] weeks from project kickoff, subject to timely client feedback and content availability.
CRITICAL: If the requirements document specifies a total timeline or phase durations (e.g. Phase 1: 2 weeks, Phase 2: 4 weeks), use that timeline for this section. Do not shorten the timeline to match hours alone when the requirements define a longer schedule.

8. Assumptions & Client Responsibilities
Client will provide:
Final content for all pages
Final designs in layered Figma, XD or PSD files
Branding assets (logos, brand guidelines)
Access to the current website for content migration
Plugins:
Paid plugins to be purchased by the client
Interactive tools (if applicable):
Only embed support is included
No internal logic or backend development included

10. Exclusions
Copywriting and translation services
Custom animations beyond [page builder] standard capabilities
CRM, marketing automation, or backend system integrations
Ongoing maintenance or support (can be quoted separately)

Note: This is a ballpark estimate based on the details we have. Once we receive the final designs, we will re-evaluate and provide a final estimate.
""",

    "wordpress_branding_refresh": """
Prepared for: [Client Name]
Prepared by: E2M Solutions 
Date: [Date]
Website Branding Refresh Scope & Commercial Estimate
Platform: WordPress + [Page Builder]

1. Project Overview
This project covers a visual branding refresh of the existing WordPress website without changes to site structure, navigation, or content.
The goal is to modernize the front-end appearance while maintaining all existing functionality.

2. Scope of Work
2.1 Global Styling & Visual Consistency
Updated typography and color scheme
Refined spacing and visual hierarchy
2.2 Header & Footer Optimization
Visual updates to global components
2.3 Homepage Enhancements
Refreshed hero section
Updated content sections styling
2.4 Internal Page Element Optimization
Consistent styling across all page templates
2.5 Imagery & Iconography Refresh
Updated icons and imagery styling

6. Development Approach
HTML/CSS-level visual adjustments only
Responsive design preservation
Cross-browser compatibility testing

7. Estimated Effort & Timeline
Estimated Total Effort
[X] – [Y] hours
Estimated Timeline
[X] – [Y] business days from project kickoff.

8. Assumptions & Client Responsibilities
Client will provide:
Final brand fonts and imagery
Access to the current website
No changes to site structure, navigation, or content
Updates limited to HTML/CSS-level adjustments

10. Exclusions
Page rebuilds or layout restructuring
Content writing or copy updates
SEO, performance, or accessibility audits
Ongoing maintenance or support

Note: This is a ballpark estimate based on the details we have. Once we receive the final designs, we will re-evaluate and provide a final estimate.
""",

    "wordpress_full_build": """
Prepared for: [Client Name]
Prepared by: E2M Solutions 
Date: [Date]
Website Development Scope & Commercial Estimate
Platform: WordPress + [Page Builder]
Languages: [Languages]

1. Project Overview
This project covers the design support, development, and deployment of a WordPress website using [Page Builder].
The website will include [summary of pages and features].
The goal is to deliver a scalable, easy-to-manage, and performance-optimized website suitable for long-term growth.

2. Website Structure & Page Scope
2.1 Core Pages ([X] Pages)
Homepage
[Key features]
[List all other pages with their features]

2.2 Blog Infrastructure (if applicable)
Blog post template (single post design)
Category and search-ready structure

6. Development Approach
WordPress installation and configuration
Theme setup ([Theme Name] or custom child theme)
[Page builder] integration
[Page builder]-based page development
Reusable global components
Responsive design for desktop, tablet, and mobile
Performance and speed optimization
Cross-browser compatibility testing
(When required by CLIENT REQUIREMENTS, also include: SSL/hosting security; automated backups; built-in accessibility/ADA compliance; SEO setup and Analytics integration with event tracking.)

7. Estimated Effort & Timeline
Estimated Total Effort
[X] – [Y] hours
Estimated Timeline
[X] – [Y] weeks from project kickoff, subject to timely client feedback and content availability.
CRITICAL: If the requirements document specifies a total timeline or phase durations (e.g. Phase 1: 2 weeks, Phase 2: 4 weeks), use that timeline for this section. Do not shorten the timeline to match hours alone when the requirements define a longer schedule.

8. Assumptions & Client Responsibilities
Client will provide:
Final content for all pages
Final designs in layered Figma, XD or PSD files
Branding assets (logos, brand guidelines)
Plugins:
Paid plugins ([list]) to be purchased by the client

10. Exclusions
Copywriting services
Custom animations beyond [page builder] standard capabilities
Ongoing maintenance or support (can be quoted separately)

Note: This is a ballpark estimate based on the details we have. Once we receive the final designs, we will re-evaluate and provide a final estimate.
""",
}
