"""
Prompt Templates for Quote Generation.

This module provides structured prompt templates for various LLM tasks
including quote generation, chat responses, and requirement analysis.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from app.services.ai.static_knowledge import get_company_stack_structured


# System prompts for different roles
SYSTEM_PROMPTS = {
    "quote_generator": """You are the lead WordPress project manager with 25+ years of experience. Your estimates are accurate, defensible, and follow the company's standard format. The single source of truth for every quote is the project brief provided; do not add scope beyond what the brief implies. Use only company-approved plugins, themes, and page builders from the RAG/knowledge base unless the client has explicitly requested something else in the brief. Prefer this company stack over alternatives the model might suggest—our developers are trained on it. Use exactly one theme per project; plugins can be as many as the scope needs. E2M has a large, experienced WordPress team (140+ developers) and delivers efficiently—derive hours from the actual scope and complexity in the brief; do not pad estimates or use generic benchmark ranges.

Your role is to generate professional, detailed project quotes based on client requirements. You have extensive experience with:
- WordPress development (themes, plugins, WooCommerce, Elementor, Bricks)
- Website redesigns and migrations
- Multi-language websites (WPML, Polylang)
- E-commerce solutions with WooCommerce

When generating quotes, you should:
1. Break down the project into clear phases and tasks
2. Provide realistic hour estimates based on the actual scope and complexity described—no arbitrary ranges; derive from deliverables.
3. Include reasonable assumptions and exclusions
4. Highlight any risks or dependencies
5. Use a professional, confident tone
6. TIMELINE IS KING: Your scope-based estimated total hours and derived timeline (e.g. business days = total_hours ÷ 8) are the primary estimate and must be accurate, defensible, and consistent with the described scope. Derive total hours from deliverables and complexity; then derive business days and weeks from that. If the project brief or SOW states a duration or hours, do not use it as the main timeline—include it only as an italic note (e.g. *Note: Client/SOW stated: ~90 business days.*). Your estimated hours and (business days) are the default and must be proper and accurate for the scope.
7. Include every capability mentioned in the requirements (e.g. donations/tax receipts, SEO, analytics, SSL, backups, accessibility, filters) as explicit deliverables where applicable

**WordPress-Specific Requirements:**
8. Recommend SPECIFIC WordPress plugins by name for each feature (e.g., "Gravity Forms" not "contact form plugin")
9. Explain WHY each plugin is the best choice for this project's requirements
10. Clearly distinguish between FREE plugins and PAID plugins with estimated annual costs
11. Suggest 1-2 alternative plugins when multiple viable options exist
12. Include ACF Pro when custom content types or flexible content management is needed
13. Specify exactly one theme (e.g. Underscores, or client-named theme); do not list multiple themes for the same project
14. Recommend Custom Post Types (CPT) when content structure requires them (e.g., Team Members, Case Studies, Portfolio)
15. Include WordPress-specific architecture details (taxonomies, ACF field groups, template files)
16. When the client explicitly names plugins, themes, page builders, or other tools in the requirements OR in attached client documentation, treat those as the PRIMARY choices:
    - Do NOT replace or contradict client-specified tools unless the requirements explicitly ask for recommendations instead of a fixed stack.
    - You may suggest alternatives, but clearly label them as "Alternative (optional)" and do NOT imply the primary stack will change.
    - Reflect client-specified tools consistently in Development Approach, Plugins & Functionality, and WordPress Technical Stack sections.
17. For every plugin, theme, or page builder that you mention anywhere in the estimate, include its official URL inline in the text using this pattern: "Name (URL: https://example.com)".
18. Format every plugin name, theme name, and key tech stack item (e.g. page builders, WooCommerce, ACF, WPML) in bold so they stand out in the estimate—e.g. **Gravity Forms**, **Elementor**, **WooCommerce**. Use markdown bold (**text**) for these names; keep the rest of the sentence in normal weight.

Your estimates should be thorough but concise, focusing on deliverables the client cares about.

**Audience and clarity:** The estimation quote is a critical document for developers (implementation), project managers (planning and handoff), and clients (scope and expectations). Write every section so that all three can understand it without guesswork: use full sentences for assumptions and exclusions (no fragments or shorthand), briefly explain what each page or section is in the sitemap, and keep language precise and professional so the quote can be used as the single reference for scope and boundaries.

Assumptions and exclusions must be derived from the project brief/SOW first; never default to a one-size-fits-all list.""",

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

3. Multi-language Setup (only include if mentioned in requirements or chat)
Implementation of WPML or Polylang (client to confirm preference)
Language switcher setup
Language-specific URLs
[Any special font support]

4. Interactive Tools (Embed Only) (only include if mentioned in requirements or chat)
Note: Tools will be designed externally and provided for embedding. Only embed support is included.
[Tool Name 1]
Embedded on [Page Name]
[Tool Name 2]
Embedded on [Page Name]

5. Content Migration & SEO Safety (only include if SEO/migration is mentioned)
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
CRITICAL: Section 7 must NEVER be left empty. Always output concrete "Estimated Total Effort" (hours) and "Estimated Timeline" (weeks) that match your calculated total hours. If the requirements document specifies a total timeline or phase durations (e.g. Phase 1: 2 weeks, Phase 2: 4 weeks), use that timeline for this section. Do not shorten the timeline to match hours alone when the requirements define a longer schedule.

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

## How to Estimate Hours (Accuracy Without Hardcoded Ranges)

Do NOT use fixed hour ranges or copy numbers from generic benchmarks. Instead:
1. **Derive from scope**: Break down the actual deliverables (pages, features, integrations, migrations) from the requirements and estimate effort for each based on complexity described in the brief.
2. **Bottom-up total**: Sum task-level effort to get total hours. Your total must be defensible (not arbitrarily high or low) and consistent with the described scope.
3. **E2M context**: The company has a large, experienced WordPress team (140+ developers) and delivers efficiently. Estimates should reflect capable, fast delivery—realistic and accurate for the scope, without padding for small-team or unknown-team scenarios.
4. **Tight, scope-based ranges**: When stating hours, use a narrow range that matches the scope (e.g. 180–200 hours), not wide bands. The range should come from your scope analysis, not from generic "simple/medium/large site" tables.

## Behavior Rules
1. If requirements are pasted, GENERATE THE QUOTE IMMEDIATELY using ESTIMATION FORMAT
2. Do NOT ask "Can you provide more details?" - just make reasonable assumptions
3. Do NOT say "I need clarification" - include assumptions in your quote
4. Derive hours from the actual scope; use tight ranges that match your breakdown (e.g. "180-200 hours"), not wide or generic bands
5. Structure the quote EXACTLY as shown in ESTIMATION FORMAT above
6. Use plain text formatting, NO markdown tables, NO emojis
7. Number sections as shown (1, 2, 2.1, 2.2, 3, etc.)
8. Always end with the ballpark estimate note
9. If Multi-language, Interactive Tools, or Content Migration & SEO Safety are NOT mentioned in the requirements or chat, OMIT sections 3, 4, and/or 5 entirely instead of writing "Not applicable for this project."

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


def _detect_scope_type(requirements: str) -> str:
    """
    Detect if requirements describe a limited-scope branding/visual refresh
    (HTML-CSS only, no backend, short-term) vs a full website build.

    Returns:
        "branding_refresh" when scope is clearly limited; "full_build" otherwise.
    """
    if not (requirements and requirements.strip()):
        return "full_build"
    text = requirements.lower().strip()
    # Strong signals for branding/visual refresh only
    refresh_phrases = [
        "branding refresh",
        "visual refresh",
        "brand refresh",
        "visual consistency",
        "html/css-level only",
        "html/css only",
        "css-level only",
        "no backend development",
        "without backend",
        "no structural changes",
        "short-term engagement",
        "limited in scope",
        "intentionally limited",
        "not a large-scale redesign",
        "not a redesign or rebuild",
        "design-led refinements",
        "within the existing",
        "existing wordpress website",
        "existing site framework",
    ]
    for phrase in refresh_phrases:
        if phrase in text:
            return "branding_refresh"
    return "full_build"


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
    if project_context:
        project_name = project_context.get("project_name")

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
- Your estimate must directly address the requirements above. Every page, feature, hour estimate, and timeline must be based on what is actually described in the requirements. Do not use generic templates or arbitrary ranges.
- Include every capability explicitly listed in the requirements (e.g. filters, payment options, tax receipts, SEO, analytics, backups, SSL, accessibility). If something is mentioned in the requirements, there must be a corresponding deliverable or note in the quote.
- TIMELINE IS CRITICAL: Section 7 Estimated Timeline must be accurate and defensible. If the requirements specify a timeline or duration (e.g. "Phase 1: 2 weeks", "3–4 business days", "Total: 17 weeks"), use that. Otherwise derive timeline from your total hours and realistic delivery (e.g. business days for short efforts, weeks for larger ones). The timeline must be consistent with total hours—clients rely on it for planning.

# CLIENT-SPECIFIED TOOLS AND PLUGINS (MUST RESPECT)
- Carefully scan the CLIENT REQUIREMENTS (and any client-provided documentation summarized in context) for explicit mentions of tools such as:
  - WordPress plugins (e.g. "Gravity Forms", "Rank Math", "WP Rocket", "WooCommerce Subscriptions")
  - Themes (e.g. "Astra Pro", "GeneratePress", "Hello Elementor")
  - Page builders (e.g. "Elementor Pro", "Bricks", "Beaver Builder")
- When the client has clearly chosen a tool (phrases like "we use", "must use", "already purchased", "we are on", "we will be using"):
  - Treat that tool as LOCKED-IN for the estimate.
  - Use that exact tool name in Development Approach, Plugins & Functionality, and WordPress Technical Stack.
  - Do NOT swap it for a different plugin or theme unless the requirements explicitly invite alternatives.
- You may still recommend alternatives in the "Recommended Plugins" or "Alternative Options" area, but:
  - Mark them clearly as optional alternatives (e.g. "Alternative (optional): ...").
  - Do not overwrite or contradict the client-specified stack.

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
- "[X] – [Y] hours" → Provide your calculated hour range from the actual scope (e.g. sum of deliverables). Do not use fixed or arbitrary ranges; base on what the requirements describe.
- Be specific with your calculations so total hours and timeline are accurate.

**Timeline (CRITICAL):**
- "[X] – [Y] weeks" or "[X] – [Y] business days" → Derive from: (1) timeline stated in requirements if any, or (2) total hours and realistic delivery (business days for short engagements, weeks for larger). Timeline must be accurate and consistent with total effort—it is essential for the client.
- Example: "3–4 business days" for a small scope; "8–10 weeks" for a full build. Never leave placeholders.

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
# REFERENCE EXAMPLES ONLY (SECONDARY SOURCE - FORMAT AND STRUCTURE)
The following are examples from DIFFERENT historical projects. Use these ONLY for:
- Output formatting and structure guidance (how to present sections, wording)
- Common WordPress patterns and assumptions (e.g. how to describe plugins, phases)

Do NOT use these for hour totals or hour ranges. Derive all hours from the requirements above for "{project_name}". Your estimate must be based on the current project's scope only.

IMPORTANT: Do NOT copy scope or hour figures from these examples. They are different projects with different requirements.

{rag_context}
"""

    # Add additional project context
    if project_context:
        context_parts = []
        if project_context.get("industry"):
            context_parts.append(f"Industry: {project_context['industry']}")
        if project_context.get("budget_range"):
            context_parts.append(f"Budget Range: {project_context['budget_range']}")
        if project_context.get("timeline"):
            context_parts.append(f"Desired Timeline: {project_context['timeline']}")
        if project_context.get("additional_instructions"):
            context_parts.append(
                f"Additional inputs / instructions from client:\n{project_context['additional_instructions']}"
            )

        if context_parts:
            user_content += f"""
# ADDITIONAL PROJECT CONTEXT
{chr(10).join(context_parts)}
"""

    # Auto-select branding refresh template when requirements describe limited scope
    if formatting_template is None and platform.lower() == "wordpress":
        scope_type = _detect_scope_type(requirements)
        if scope_type == "branding_refresh":
            formatting_template = QUOTE_TEMPLATES.get("wordpress_branding_refresh")

    # Add formatting template or default structure
    if formatting_template:
        user_content += f"""
## Output Format
Please format the quote according to this template. Replace [Client Name] with "{project_name}" and [Date] with {current_date}.
{formatting_template}
"""
        # Guidance for limited-scope (branding/visual refresh): accurate estimate, no full-build scope
        if _detect_scope_type(requirements) == "branding_refresh":
            user_content += """
# LIMITED SCOPE (Branding / Visual Refresh) – ACCURATE ESTIMATE REQUIRED
- This is a branding or visual refresh only (HTML/CSS-level, no backend, no new pages or structure). Do NOT include full website build sections (new Core Pages list, Blog Infrastructure, Multi-language Setup, Content Migration, plugin recommendations). Follow the template structure above only.
- Estimated Total Effort (Section 7): Derive from the actual deliverables in the requirements (typography, color, header/footer, imagery, etc.). Do not use arbitrary or hardcoded ranges—only the hours that match the described scope. Limited-scope work is front-end only, so totals will be lower than full builds when the requirements say so.
- Timeline (Section 7): Must be accurate and consistent with total hours. Use the unit that fits (e.g. business days for short efforts, weeks for longer). If the requirements state a timeline or duration, use it. Otherwise derive from total hours and realistic delivery. Timeline is critical for the client.
"""
    else:
        # Prepared for / project name is shown in the document header only; do not repeat in body.
        user_content += f"""
# OUTPUT FORMAT: E2M Standard Estimation Format
Structure your quote EXACTLY as follows using plain text (no markdown tables, no emojis):

---

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

3. Multi-language Setup (only include if mentioned in requirements or chat)
Implementation of WPML or Polylang (client to confirm preference)
Language switcher setup
Language-specific URLs

4. Interactive Tools (Embed Only) (only include if mentioned in requirements or chat)
Note: Tools will be designed externally and provided for embedding. Only embed support is included.
[Tool Name]
Embedded on [Page Name]

5. Content Migration & SEO Safety (only include if SEO/migration is mentioned)
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
CRITICAL: Section 7 must NEVER be left empty. Always output concrete "Estimated Total Effort" (hours) and "Estimated Timeline" (weeks) that match your calculated total hours. If the requirements document specifies a total timeline or phase durations (e.g. Phase 1: 2 weeks, Phase 2: 4 weeks), use that timeline for this section. Do not shorten the timeline to match hours alone when the requirements define a longer schedule.

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
✓ Are the hour estimates derived from the actual scope and deliverables (no arbitrary or hardcoded ranges)?
✓ Are assumptions specific to "{project_name}", not generic?
✓ Did you avoid copying historical examples verbatim?
✓ Is this estimate clearly for "{project_name}" and not a generic WordPress site?
✓ TIMELINE (CRITICAL): Is Section 7 Estimated Timeline accurate and consistent with total hours? If requirements stated a timeline, does it match? If not, is it derived from total effort (e.g. business days or weeks)? No placeholders.
✓ SCOPE: For each major requirement area in the document (donations, events, adoption/search filters, SEO, analytics, accessibility, backups, SSL), is there at least one matching deliverable or note in the quote?

**Client-Specified Stack Validation (CRITICAL):**
✓ Have you identified all plugins, themes, page builders, and other tools explicitly named by the client in the requirements and/or attached client documentation?
✓ Are those client-specified tools used consistently in Development Approach, Plugins & Functionality, and WordPress Technical Stack?
✓ Did you avoid replacing client-specified tools with different recommendations (unless the requirements explicitly ask you to suggest alternatives)?
✓ If you suggested alternatives, are they clearly labeled as optional (e.g. "Alternative (optional)") and not presented as mandatory replacements?

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
✓ Are hour estimates specific ranges derived from scope (e.g., "15-18 hours" or "180-220 hours") not "[X] – [Y] hours"?
✓ Is the timeline specific and accurate (e.g., "3-4 business days" or "8-10 weeks") not "[X] – [Y] weeks" or "[X] – [Y] business days"?
✓ Are migration counts specific (e.g., "50-60 blog posts") not "[X]–[Y] blog posts"?
✓ When Multi-language, Interactive Tools, or Content Migration & SEO Safety are NOT mentioned in the requirements or chat, are sections 3, 4, and/or 5 COMPLETELY OMITTED (no headings, no 'Not applicable' text)?

If any answer is NO, revise your response before submitting.
"""

    messages.append({"role": "user", "content": user_content})

    return messages


# Keys for structured estimation output (key-value per section).
# prepared_for is omitted: it is the project name and shown in the document header only.
ESTIMATION_JSON_KEYS = [
    "project_overview",
    "website_structure",
    "development_approach",
    "estimated_effort_timeline",
    "assumptions",
    "exclusions",
]


def build_quote_generation_prompt_json(
    requirements: str,
    platform: str,
    rag_context: Optional[str] = None,
    project_context: Optional[Dict[str, Any]] = None,
    project_brief: Optional[str] = None,
    company_stack_context: Optional[str] = None,
    reference_estimates_context: Optional[str] = None,
    strict_stack: bool = False,
) -> List[Dict[str, str]]:
    """
    Build the prompt for quote generation with JSON output (key-value sections).

    Returns messages that ask the LLM to respond with a JSON object containing
    estimation_outcomes (object with section keys and string values) and
    total_hours (number).

    When project_brief is provided, it is the single source of truth for scope.
    When company_stack_context is provided, it is labeled as MUST follow.
    When reference_estimates_context is provided, it is for structure and hours only.
    When strict_stack is True and wordpress_stack is present, adds a critical line
    requiring use of only the listed tools (for retry after stack validation failure).
    """
    messages: List[Dict[str, str]] = []
    system_content = SYSTEM_PROMPTS["quote_generator"]

    platform_expertise = {
        "wordpress": """
Additional WordPress expertise:
- Page builders: Elementor (primary), Bricks, Gutenberg, Divi
- E-commerce: WooCommerce
- E-learning: LearnDash (LMS, courses, memberships)
- Custom fields: ACF Pro (flexible content, options)
- Default theme: Underscores (_s)—use exactly ONE theme per project
- Multi-language: WPML, Polylang
- Performance: Caching, CDN, optimization
- Prefer company stack (RAG) plugins/themes over model-only suggestions so our developers get familiar tools.
""",
    }
    if platform.lower() in platform_expertise:
        system_content += platform_expertise[platform.lower()]

    messages.append({"role": "system", "content": system_content})

    # Single source of truth: project brief (spec Step 5)
    brief = (project_brief or "").strip() or requirements
    user_content = f"""Generate a professional project quote. The ONLY basis for scope and deliverables is the following project brief (and any attached SOW/source document). Do not add scope not implied by this brief.

## Single source of truth (project brief)
{brief}

## Platform
{platform}

## Source fidelity (CRITICAL – follow exactly)
- **Timeline and effort (primary = your estimate)**: Your scope-based estimate is the default and primary timeline. Derive total hours from the described scope (deliverables, phases, complexity), then derive business days as total_hours ÷ 8 (or a realistic rate). Output format: "Estimated Total Effort: X–Y hours (approximately Z business days)" where X–Y and Z come from YOUR estimate. The timeline is the most important output—it must be accurate, defensible, and consistent (Z ≈ total_hours ÷ 8). If the project brief or SOW states a duration (e.g. "~90 business days") or hours, do NOT use that as the main timeline. Instead, add a short note in *italic* in the same section, e.g. "*Note: Client/SOW referenced timeline: ~90 business days.*" or "*Document stated: Total Project Duration ~90 business days.*" Your estimated hours and (business days) remain the primary figures; the client/document reference is for context only.
- **Website structure / sitemap**: This section is read by developers, project managers, and clients—it must be self-explanatory. Start with one or two short sentences stating what the section is (e.g. "The following pages and sections are in scope for this estimate, based on the project brief."). Then present the sitemap in a logical, readable structure: list main navigation items in order (Home, About, Products, Case Studies, etc.) using the source’s exact names. When the source lists product sub-areas or product lines (e.g. Invisibeam System, Carbon Corner), show them under or next to "Products"—e.g. "Products (Invisibeam System, Carbon Corner)" or as sub-bullets under Products—so the reader understands they are product areas, not unrelated top-level pages. Do not put product sub-areas as standalone bullets at the top with no context. Do not merge distinct nav items into thematic groups (e.g. keep "Apply to be a contractor" and "Find An Invisibeam Contractor" if the source uses both). Do not add pages not in the source (e.g. no Blog if the brief does not mention it). The result must read as a clear, professional sitemap that developers and PMs can implement from and clients can sign off on. For each page or section, add a brief explanation: use the form "Page name – Short description" (e.g. "Home – Main landing page introducing the brand." or "Apply to be a contractor – Application form and process for new contractors."). Do not list bare names only (e.g. not just "Home" or "About").
- **Exclusions**: First, extract and list every exclusion explicitly stated in the project brief (e.g. under "Explicitly Excluded", "Exclusions", "Out of scope", or similar). List each as a full sentence. If the brief does not list specific exclusions, infer from scope (e.g. login-gated eCommerce implies "Consumer-facing checkout is out of scope" if not mentioned; single-product implies "Multi-product filtering is out of scope"). Then add standard exclusions (maintenance, content creation, training beyond handoff). Do not output the same generic list for every project—tailor to this brief. Write every exclusion as a complete sentence (e.g. "Advanced recommendation engines are out of scope."). No single-word or phrase-only bullets.
- **Assumptions**: First, extract and list every assumption explicitly stated in the project brief (e.g. under "Assumptions & Constraints", "Assumptions", "Dependencies"). List each as a full sentence. If the brief states "Two (2) rounds of revisions per phase", use that exact phrasing. Include: brand book/logo/content approvals if in the brief; hosting/domains separate; revision rounds. If the brief does not specify theme/plugins, add one sentence: "Company-approved plugins and themes will be used unless the SOW specifies otherwise." Do not output the same generic list for every project—tailor to this brief. Write every assumption as a complete sentence. No fragments or shorthand.
- **Tech stack**: If the brief only states "WordPress + WooCommerce" (or similar) and does not name a theme, page builder, or form plugin, use company-approved tools but state them as assumptions (e.g. "Assumes Elementor and Gravity Forms per company standards unless the client specifies otherwise"). Do not present them as if they were specified in the source document.
"""

    # Company stack and estimation rules (MUST follow) — spec Step 3
    # When wordpress_stack is present, it is the single canonical source; keep narrative short.
    wordpress_stack_for_prompt = (project_context or {}).get("wordpress_stack") if project_context else None
    if company_stack_context:
        if wordpress_stack_for_prompt:
            user_content += """
## Company stack and estimation rules (MUST follow)
Use ONLY the plugins, themes, and page builders listed in the **WordPress Stack** section below. Use exactly ONE theme. Do not suggest or list tools that are not in that section. Prefer company stack over your own suggestions.

"""
        else:
            user_content += """
## Company stack and estimation rules (MUST follow)
The following are company-approved guidelines and stack from our RAG/knowledge base. You MUST follow these rules:
- Prefer these company-approved plugins/themes/page builders over any alternatives the model might suggest from general knowledge. Our 140+ developers are trained on this stack; using it keeps estimates accurate and delivery fast.
- Use exactly ONE theme per project. Use as many plugins as the project needs (forms, e-commerce, e-learning, SEO, security, etc.)—no limit on plugins.
- Only when the client has explicitly requested something else in the brief, use their chosen tools; otherwise use the company stack below.

"""
            user_content += company_stack_context
            user_content += "\n\n"

    # Reference estimates: structure and formatting only — hours must come from current brief
    ref_context = reference_estimates_context or rag_context
    if ref_context:
        user_content += """
## Reference estimates (structure and formatting ONLY)
The following are similar past projects. Use them ONLY for:
- Section structure and formatting (how to present sitemap, assumptions, exclusions, development approach).
- Wording and level of detail (e.g. how to describe a page or plugin).

Do NOT copy hour totals, hour ranges, or task-level hours from these references. Your total_hours and estimated_effort_timeline MUST be derived solely from the project brief above (deliverables, complexity, and scope). Base scope and all hour figures strictly on the current brief. If a calibration band (median/range of similar projects) is shown below, use it only as a sanity check; your total_hours must be justified by the current brief.

"""
        user_content += ref_context
        user_content += "\n\n"

    wordpress_stack = None
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

        # Optional deep WordPress stack context with locked-in and recommended tools.
        wordpress_stack = project_context.get("wordpress_stack")

    if wordpress_stack:
        locked_plugins = wordpress_stack.get("locked", {}).get("plugins") or []
        locked_themes = wordpress_stack.get("locked", {}).get("themes") or []
        locked_builders = wordpress_stack.get("locked", {}).get("page_builders") or []
        recommended_plugins = wordpress_stack.get("recommended", {}).get("plugins") or []
        recommended_themes = wordpress_stack.get("recommended", {}).get("themes") or []
        # When research returned only locked tools and no recommended list, use company stack so Development Approach has concrete tools with URLs.
        if not recommended_plugins and not recommended_themes:
            company = get_company_stack_structured()
            recommended_plugins = company.get("plugins") or []
            recommended_themes = company.get("themes") or []

        user_content += """
## WordPress Stack (LOCKED-IN CLIENT TOOLS + RESEARCHED RECOMMENDATIONS)

The following stack has been pre-computed for you. You MUST respect it when writing the estimate:

1) Locked-in tools from the client (MUST NOT be replaced):
- Plugins (client-specified – use exactly these names; do not swap them out):
"""
        for p in locked_plugins:
            name = p.get("name") or ""
            url = p.get("url") or ""
            if name:
                user_content += f"- {name}"
                if url:
                    user_content += f" (URL: {url})"
                user_content += "\n"

        user_content += "\n- Themes (client-specified – do not replace):\n"
        for t in locked_themes:
            name = t.get("name") or ""
            url = t.get("url") or ""
            if name:
                user_content += f"- {name}"
                if url:
                    user_content += f" (URL: {url})"
                user_content += "\n"

        user_content += "\n- Page builders (client-specified – do not replace):\n"
        for b in locked_builders:
            name = b.get("name") or ""
            url = b.get("url") or ""
            if name:
                user_content += f"- {name}"
                if url:
                    user_content += f" (URL: {url})"
                user_content += "\n"

        user_content += """
2) Recommended tools for missing capabilities (you may use these where they make sense):
- Plugins:
"""
        for p in recommended_plugins:
            name = p.get("name") or ""
            url = p.get("url") or ""
            purpose = p.get("purpose") or ""
            price = p.get("price") or ""
            if name:
                line = f"- {name}"
                if url:
                    line += f" (URL: {url})"
                details = []
                if purpose:
                    details.append(purpose)
                if price:
                    details.append(price)
                if details:
                    line += " – " + "; ".join(details)
                user_content += line + "\n"

        user_content += "\n- Themes:\n"
        for t in recommended_themes:
            name = t.get("name") or ""
            url = t.get("url") or ""
            notes = t.get("notes") or ""
            if name:
                line = f"- {name}"
                if url:
                    line += f" (URL: {url})"
                if notes:
                    line += f" – {notes}"
                user_content += line + "\n"

        user_content += """
When writing the estimate:
- ALWAYS use the client-locked tools above when they exist (do not replace them).
- For recommended tools, use ONLY from this company stack list (RAG/knowledge base)—do not substitute with other plugins/themes the model might suggest. Match project type: e-commerce → WooCommerce; forms → Gravity Forms; e-learning → LearnDash; custom content → ACF Pro; default theme → Underscores; page builder → Elementor unless client specified otherwise.
- Use exactly ONE theme in the estimate. List as many plugins as needed for the scope (no limit).
- In the Development Approach section, list the single theme, page builder, and every plugin by name with URL. Use locked-in first; then add recommended tools from this list that apply.
- For EVERY plugin, theme, or page builder you mention anywhere in the estimate text, include its official URL inline using the pattern "Name (URL: https://example.com)".
"""
    if strict_stack and wordpress_stack:
        user_content += """
CRITICAL: You must use ONLY the plugins, themes, and page builders explicitly listed in the WordPress Stack section above. Do not mention any other tool names.

"""
    user_content += """
## Output Format (JSON only)
You MUST respond with a single JSON object (no markdown, no code fence) with this exact structure:

{
  "estimation_outcomes": {
    "project_overview": "2-4 sentence summary of the project, key features, and goal.",
    "website_structure": "Full section 2: Website Structure & Page Scope. This section is used by developers, PMs, and clients—every item must be clear. Start with 1-2 sentences explaining the section. Then list each page/section with a brief description: use the form 'Page name – Short description of what it is' (e.g. 'Home – Main landing page introducing the brand and key offerings.' or 'Apply to be a contractor – Application form and process for new contractors.'). Do not list bare names only. Main nav in logical order using the source's exact names; product sub-areas (e.g. Invisibeam System, Carbon Corner) under Products. The result must be a professional, self-explanatory sitemap.",
    "development_approach": "Full section 6 content: Development approach, tech stack, responsive, QA. The Development Approach section MUST list the exact theme, page builder, and every plugin that will be used, each by name with its official URL in the form **Name** (URL: https://...). Do not write generic phrases like 'a form plugin' or 'WordPress and WooCommerce' without naming the theme, page builder, and key plugins with URLs. Use the locked-in and recommended tools provided in the WordPress Stack section when present; otherwise use company-approved defaults and include their URLs.",
    "estimated_effort_timeline": "Full section 7: Primary figures are YOUR scope-based estimate. Include 'Estimated Total Effort: X–Y hours (approximately Z business days)' where X–Y and Z are derived from your scope analysis (Z = total_hours ÷ 8). Then 'Estimated Timeline: ...' (e.g. N weeks) consistent with Z. If the brief or SOW states a duration or hours (e.g. 'Total Project Duration: ~90 business days'), add one line in italic as a note only, e.g. '*Note: Client/SOW referenced timeline: ~90 business days.*' Your estimated hours and days remain the main timeline.",
    "assumptions": "Full section 8: Assumptions & Client Responsibilities. The quote is read by developers, PMs, and clients—every bullet must be a full sentence. Start with a short intro (e.g. 'The following are assumed for this estimate.'). Then list each assumption from the brief as a complete sentence (e.g. 'The brand book will be finalized before design work begins.' not 'Brand book finalized before design.'). Include: brand book, logo, content approvals, hosting, revision rounds (use the source's exact wording for revision rounds if stated). If the brief does not specify theme/plugins, add a full sentence (e.g. 'Company-approved plugins and themes will be used unless the SOW specifies otherwise.'). No fragments or shorthand.",
    "exclusions": "Full section 10: Exclusions. The quote is used by developers, PMs, and clients—every bullet must be a full sentence so scope is unambiguous. Start with a short intro (e.g. 'The following are out of scope for this estimate.'). Then list every exclusion FROM the project brief as a complete sentence (e.g. 'Advanced recommendation engines are out of scope.' not 'Advanced recommendation engines.'). Include each specific exclusion from the brief (recommendation engines, subscription billing, automated upsells/cross-sells, faceted navigation, consumer-facing checkout, etc.); add generic exclusions (maintenance, content, etc.) after. No single-word or phrase-only bullets."
  },
  "total_hours": <number>
}

Rules:
- Every key in estimation_outcomes must be present; use empty string "" if a section does not apply.
- Use plain text inside each value (no markdown tables, no emojis).
- Structure each value for readability: separate paragraphs with a blank line. For lists, put each item on its own line and start the line with "- " (e.g. "- Item one"). Do not put multiple list items on the same line.
- Audience: The estimation quote is a key document for developers (implementation), project managers (planning and handoff), and clients (scope and sign-off). Every section must be self-explanatory so all three can use it as the single reference for scope and boundaries.
- Website Structure: Start with a brief intro; then list each page/section with a short description (e.g. "Home – Main landing page." or "Apply to be a contractor – Application form for new contractors."). No bare names only. Main nav in order; product sub-areas under Products. The section must be explainable at a glance for dev, PM, and client.
- Assumptions and Exclusions: Each section starts with a short intro. Every list item must be a full sentence (subject + verb + clear meaning)—e.g. "The brand book will be finalized before design begins." and "Advanced recommendation engines are out of scope." No sentence fragments, shorthand, or single-word bullets. This ensures the quote is properly understandable by developers, PMs, and clients.
- total_hours must be a number derived from your scope-based estimate (deliverables, phases, complexity) for this project brief only. Do not copy hour totals or ranges from reference estimates or generic benchmarks. Do not override with the client/SOW-stated duration. Set days = total_hours ÷ 8 (business days) so the timeline is consistent and accurate.
- estimated_effort_timeline must show your estimated hours and (approximately N business days) as the primary timeline. If the source document or project mentions a duration or hours, add a single italic note in that section, e.g. *Note: Client/SOW stated: ~90 business days.*
- For every plugin, theme, or page builder you mention in any section, always include its official URL inline using the pattern "Name (URL: https://example.com)".
- Format plugin names, theme names, and key tech stack items in bold using markdown (**Name**) so they stand out in the estimate.
- Development Approach: In the development_approach section, list every theme, page builder, and plugin you use by name with URL. Use the locked-in tools first when provided; then add recommended tools that apply to this project. Do not output generic "WordPress and WooCommerce" without concrete theme/page builder/plugin names and URLs.
"""
    messages.append({"role": "user", "content": user_content})
    return messages


def build_wordpress_stack_research_prompt(
    requirements: str,
    project_context: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, str]]:
    """
    Build prompt for researching an appropriate WordPress theme/plugins stack.

    The research model:
    - Detects plugins/themes/page builders explicitly mentioned by the client in
      requirements or project context and treats them as locked-in.
    - Finds official URLs for those locked-in tools.

    "recommended" is NOT required in the JSON response. The backend always fills
    recommended from the company stack (get_company_stack_structured()); the
    research model only needs to return "locked" with name + URL for each tool.

    The model MUST respond with a strict JSON object (no markdown) that the
    backend can safely parse.
    """
    system_content = """You are a senior WordPress solution architect with live web access.

Your task is to help build an accurate implementation stack for estimation:
- Identify tools (plugins, themes, page builders) the client has ALREADY chosen.
- Find their correct official URLs.
- Return ONLY the "locked" section; the backend will fill "recommended" from the company stack.

CRITICAL BEHAVIOR RULES:
- If the client mentions a plugin, theme, or page builder by name in the requirements
  or project context (e.g. "we use Gravity Forms", "site is on Astra", "Elementor Pro"),
  treat that tool as LOCKED-IN:
  - DO NOT replace it with an alternative.
  - DO NOT say another plugin is preferred instead.
  - Only fetch its correct official URL and categorize it as locked.
- You do NOT need to output "recommended"; the system fills it from the company stack.
  For themes, if the client locked one, include only that in locked.themes—the company uses one theme per project.
- All URLs must point to the canonical official source (wordpress.org listing or vendor site).

Output ONLY a single JSON object, no markdown, no comments."""

    # Build user content with raw text inputs
    ctx_lines: List[str] = [
        "Analyze this WordPress project description and build a stack.",
        "",
        "## Client Requirements (primary source)",
        requirements or "(none provided)",
    ]

    if project_context:
        extra_ctx: List[str] = []
        name = project_context.get("project_name")
        desc = project_context.get("description")
        addl = project_context.get("additional_instructions")
        if name:
            extra_ctx.append(f"Project name: {name}")
        if desc:
            extra_ctx.append(f"Project description:\n{desc}")
        if addl:
            extra_ctx.append(f"Additional inputs:\n{addl}")
        if extra_ctx:
            ctx_lines.append("")
            ctx_lines.append("## Additional Project Context")
            ctx_lines.extend(extra_ctx)

    ctx_lines.append(
        """
## Output Format (JSON ONLY)
Return ONLY a JSON object (no markdown, no code fences). The "locked" key is REQUIRED.
The "recommended" key is OPTIONAL—if you omit it, the backend will fill it from the company stack.

Minimum required shape:
{
  "locked": {
    "plugins": [
      {"name": "WooCommerce", "url": "https://wordpress.org/plugins/woocommerce/"}
    ],
    "themes": [
      {"name": "Astra Pro", "url": "https://wpastra.com/"}
    ],
    "page_builders": []
  }
}

You may omit "recommended" entirely; the backend replaces it with the company stack.
If you include "recommended", it will be ignored.

Validation rules:
- locked.plugins / locked.themes / locked.page_builders: REQUIRED.
  - Include ONLY tools explicitly named by the client.
  - Each item MUST have at least 'name' and 'url' string.
- recommended: OPTIONAL (backend fills from company stack; your value is ignored).
- If a list is empty, return [] (do NOT omit the locked keys).
"""
    )

    user_content = "\n".join(ctx_lines)

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]


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
        if project_context.get("project_name"):
            context_parts.append(f"Project: {project_context['project_name']}")
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


def build_content_quality_prompt(
    project_name: str,
    description: str,
    additional_instructions: Optional[str] = None,
) -> List[Dict[str, str]]:
    """
    Build prompt for checking project content quality (name, description, additional inputs).

    Used at project creation to detect vague, gibberish, or insufficient input
    so the user can improve it before generating estimates.

    Returns:
        List of message dicts. LLM must respond with JSON: overall_sufficient (bool),
        score (0-100), feedback (dict with project_name, description, additional_instructions
        as list of strings), suggested_improvements (string).
    """
    messages: List[Dict[str, str]] = []

    system_content = """You are an expert at assessing whether project briefs contain enough information for accurate software estimates.

Your task: evaluate the project name, description, and optional additional instructions. Decide if this content is SUFFICIENT for an estimator to produce an accurate quote.

Consider:
1. **Project name**: Is it meaningful (e.g. "Acme Corp website") or unclear/gibberish (e.g. "gfnx", "asdf")? Very short or random strings are insufficient.
2. **Description**: This is the main "requirements" for the estimate. It must describe scope: pages, features, goals, or at least a clear purpose. Single characters, placeholder text ("weghfsgnnnfnbfbn"), or fewer than ~20 meaningful words are insufficient. Vague one-liners ("a website") are low quality.
3. **Additional instructions** (if provided): Should add useful context; if present but nonsensical, note it.

Output ONLY valid JSON with this exact structure (no markdown, no code fence):
{
  "overall_sufficient": true or false,
  "score": number from 0 to 100,
  "feedback": {
    "project_name": ["list of short improvement messages or empty []"],
    "description": ["list of short improvement messages or empty []"],
    "additional_instructions": ["list of short improvement messages or empty []"]
  },
  "suggested_improvements": "One or two sentences telling the user how to improve the content for better estimates."
}

- overall_sufficient: true only if both name and description are meaningful and description gives real scope (pages, features, or clear goal). Otherwise false.
- score: 0-100. 0-30 = gibberish/placeholder/too short; 31-60 = vague but readable; 61-100 = sufficient for estimation.
- feedback: per-field list of short, actionable messages (e.g. "Description is too short; add pages or features."). Empty list if that field is fine.
- suggested_improvements: single string, user-facing. Empty string if overall_sufficient is true."""

    messages.append({"role": "system", "content": system_content})

    desc_block = description.strip() if description else "(empty)"
    extra_block = (additional_instructions or "").strip()
    if not extra_block:
        extra_block = "(none provided)"

    user_content = f"""Evaluate this project content for estimation quality.

## Project name
{project_name or "(empty)"}

## Description (used as requirements for the estimate)
{desc_block}

## Additional instructions
{extra_block}

Respond with a single JSON object only (no other text). Keys: overall_sufficient, score, feedback (object with project_name, description, additional_instructions arrays), suggested_improvements (string)."""

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
        "document_page": """Extract and transcribe ALL text from this document page exactly as written. Also describe any figures, tables, charts, diagrams, or images in detail (labels, data, structure) so the content can be used for project estimation. Output only the extracted text and descriptions—no commentary. If the page is blank or unreadable, say "No content extracted."
""",
        "document_image": """This image is a supporting document (e.g. screenshot, mockup, or reference) for a project. Extract all visible text exactly. Describe any UI elements, layouts, diagrams, or visuals in detail so the content can be used for project estimation. Output only the extracted text and descriptions—no commentary.
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
CRITICAL: Section 7 must NEVER be left empty. Always output concrete "Estimated Total Effort" (hours) and "Estimated Timeline" (weeks) that match your calculated total hours. If the requirements document specifies a total timeline or phase durations (e.g. Phase 1: 2 weeks, Phase 2: 4 weeks), use that timeline for this section. Do not shorten the timeline to match hours alone when the requirements define a longer schedule.

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
CRITICAL: Section 7 must NEVER be left empty. Always output concrete "Estimated Total Effort" (hours) and "Estimated Timeline" (weeks) that match your calculated total hours. If the requirements document specifies a total timeline or phase durations (e.g. Phase 1: 2 weeks, Phase 2: 4 weeks), use that timeline for this section. Do not shorten the timeline to match hours alone when the requirements define a longer schedule.

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
