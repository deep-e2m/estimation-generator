"""
Static knowledge documents for the RAG knowledge base.

This module embeds the contents of the markdown files from the local
`knowledge-based` folder directly into Python so that production
deployments do not need access to the filesystem copies.

It also contains organization-specific guidelines such as the
preferred WordPress stack (themes, builders, plugins) that should be
used as defaults when the client has not specified particular tools.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass(frozen=True)
class KnowledgeDocument:
    """
    Static knowledge document to be ingested into the vector store.

    Each document maps to a single logical piece of knowledge that the
    RAG layer can retrieve during quote generation.
    """

    source_id: str
    source_type: str
    content: str
    metadata: Dict[str, Any]


# ---------------------------------------------------------------------------
# Embedded markdown content from /knowledge-based
# ---------------------------------------------------------------------------


ESTIMATION_GUIDELINES_MD = r"""# Estimation Guidelines

This document defines the rules, multipliers, and standards used by the AI to generate hour estimates. Customize these guidelines to match your organization's estimation practices.

---

## Table of Contents

1. [Estimation Philosophy](#estimation-philosophy)
2. [Standard Task Categories](#standard-task-categories)
3. [Base Hour Estimates](#base-hour-estimates)
4. [Complexity Multipliers](#complexity-multipliers)
5. [Risk Buffers](#risk-buffers)
6. [Quote Structure Template](#quote-structure-template)
7. [Assumptions and Exclusions](#assumptions-and-exclusions)
8. [Review Checklist](#review-checklist)

---

## Estimation Philosophy

### Core Principles

1. **Estimate work, not duration**: Hours represent effort, not calendar time
2. **Include hidden work**: Account for meetings, code review, documentation
3. **Be transparent about uncertainty**: Use ranges or confidence levels when appropriate
4. **Learn from history**: Reference similar past projects when estimating

### Estimation Approach

We use a **bottom-up estimation** approach:
1. Break requirements into discrete tasks
2. Estimate each task individually
3. Apply complexity multipliers
4. Add risk buffer
5. Sum for total

---

## Standard Task Categories

All quotes should organize tasks into these standard categories:

### Development Categories

| Category | Code | Description |
|----------|------|-------------|
| Discovery & Planning | DISC | Requirements analysis, technical planning, architecture |
| UI/UX Design | DSGN | Wireframes, mockups, prototypes, design system |
| Frontend Development | FE | Client-side implementation, UI components |
| Backend Development | BE | Server-side logic, APIs, database |
| Integration | INT | Third-party APIs, external systems |
| Quality Assurance | QA | Testing, bug fixes, test automation |
| DevOps & Infrastructure | DEVOPS | Deployment, CI/CD, hosting setup |
| Documentation | DOC | Technical docs, user guides, API docs |
| Project Management | PM | Coordination, meetings, status updates |

### Task Naming Convention

Format: `[CATEGORY]-[Number]: [Task Description]`

Examples:
- `FE-001: Implement login form with validation`
- `BE-003: Create user authentication API endpoints`
- `QA-002: Write integration tests for checkout flow`

---

## Base Hour Estimates

Use these as starting points, then apply complexity multipliers.

### Frontend Development

| Task Type | Simple | Medium | Complex |
|-----------|--------|--------|---------|
| Static page | 2-4h | 4-8h | 8-16h |
| Form with validation | 4-6h | 8-12h | 16-24h |
| Data table/list | 4-8h | 8-16h | 16-32h |
| Dashboard widget | 4-8h | 8-16h | 16-24h |
| Interactive chart | 8-12h | 16-24h | 24-40h |
| File upload component | 4-8h | 8-16h | 16-24h |
| Rich text editor | 8-16h | 16-32h | 32-48h |
| Drag-and-drop interface | 8-16h | 16-32h | 32-56h |
| Real-time updates (WebSocket) | 8-16h | 16-24h | 24-40h |

### Backend Development

| Task Type | Simple | Medium | Complex |
|-----------|--------|--------|---------|
| CRUD API endpoint | 2-4h | 4-8h | 8-16h |
| Authentication system | 8-16h | 16-24h | 24-40h |
| File processing service | 4-8h | 8-16h | 16-32h |
| Email service integration | 4-8h | 8-16h | 16-32h |
| Payment integration | 16-24h | 24-40h | 40-60h |
| Search functionality | 8-16h | 16-32h | 32-56h |
| Report generation | 8-16h | 16-24h | 24-40h |
| Background job processing | 8-12h | 12-24h | 24-40h |
| WebSocket server | 8-16h | 16-32h | 32-48h |

### Integration

| Integration Type | Simple | Medium | Complex |
|------------------|--------|--------|---------|
| REST API (well-documented) | 4-8h | 8-16h | 16-24h |
| REST API (poor documentation) | 8-16h | 16-32h | 32-48h |
| OAuth/SSO provider | 8-12h | 12-20h | 20-32h |
| Payment gateway | 16-24h | 24-40h | 40-60h |
| CRM integration | 16-24h | 24-48h | 48-80h |
| ERP integration | 24-40h | 40-80h | 80-120h |

### Quality Assurance

| QA Activity | Percentage of Dev Hours |
|-------------|------------------------|
| Manual testing | 15-20% |
| Unit test writing | 20-30% |
| Integration test writing | 15-25% |
| E2E test writing | 20-30% |
| Bug fixing (estimated) | 15-25% |

### DevOps

| Task Type | Simple | Medium | Complex |
|-----------|--------|--------|---------|
| Basic CI/CD pipeline | 4-8h | 8-16h | 16-24h |
| Docker containerization | 4-8h | 8-16h | 16-24h |
| Cloud deployment setup | 8-16h | 16-32h | 32-48h |
| Monitoring/alerting setup | 4-8h | 8-16h | 16-24h |
| Infrastructure as Code | 8-16h | 16-32h | 32-56h |

---

## Complexity Multipliers

Apply these multipliers to base estimates based on project characteristics.

### Technical Complexity

| Factor | Multiplier | Criteria |
|--------|------------|----------|
| Greenfield (new project) | 1.0x | Starting from scratch |
| Existing codebase (good) | 1.1x | Well-documented, tested |
| Existing codebase (poor) | 1.3-1.5x | Legacy, untested, undocumented |
| Multiple integrations | +0.1x per integration | Each external system adds complexity |
| High performance requirements | 1.2-1.5x | Specific latency/throughput targets |
| High security requirements | 1.2-1.4x | PCI, HIPAA, SOC 2 compliance |
| Accessibility requirements | 1.1-1.2x | WCAG AA or AAA compliance |
| Multi-tenant architecture | 1.3-1.5x | Data isolation, tenant management |
| Offline/sync capability | 1.4-1.6x | Complex state management |

### Team/Communication Factors

| Factor | Multiplier | Criteria |
|--------|------------|----------|
| Co-located team | 1.0x | Same office, easy collaboration |
| Remote team (same timezone) | 1.05x | Minor communication overhead |
| Remote team (different timezones) | 1.1-1.2x | Async communication delays |
| New team member onboarding | +8-16h | Per new person on project |
| Client in different timezone | 1.05-1.1x | Meeting scheduling challenges |

### Requirement Clarity

| Factor | Multiplier | Criteria |
|--------|------------|----------|
| Detailed requirements | 1.0x | Clear specs, mockups, acceptance criteria |
| Moderate requirements | 1.1-1.2x | General direction, some ambiguity |
| Vague requirements | 1.3-1.5x | "Figure it out" situations |
| Requirements likely to change | 1.2-1.4x | Evolving business needs |

---

## Risk Buffers

Add buffer based on overall project risk assessment.

### Buffer Calculation

```
Total Estimate = Base Hours x Complexity Multipliers x (1 + Risk Buffer %)
```

### Recommended Buffers

| Project Type | Buffer | Justification |
|--------------|--------|---------------|
| Similar to past projects | 10-15% | Known patterns, predictable |
| New technology stack | 20-30% | Learning curve, unknowns |
| Aggressive timeline | 15-25% | Less time for iteration |
| Fixed-price contract | 20-30% | No flexibility for overruns |
| Prototype/MVP | 10-15% | Scope limited by definition |
| Enterprise project | 25-35% | More stakeholders, process |

### When to Increase Buffer

Add additional buffer (5-10%) for each:
- [ ] First-time client (unknown collaboration style)
- [ ] Unclear decision-making process
- [ ] Multiple stakeholder approvals required
- [ ] Regulatory or compliance review needed
- [ ] Holiday season or team vacation conflicts

---

## Quote Structure Template

All quotes should follow this structure:

```
[COMPANY LOGO/HEADER]

PROPOSAL: [Project Name]
Prepared for: [Client Name]
Date: [Date]
Valid until: [Date + 30 days]

---

## Executive Summary
[2-3 paragraphs summarizing the project, approach, and value proposition]

## Understanding of Requirements
[Paraphrase client's needs to confirm understanding]

## Proposed Solution
[High-level approach and technology choices]

## Scope of Work

### Phase 1: [Phase Name]
**Duration**: [X weeks]
**Deliverables**: [List]

| Task ID | Description | Hours |
|---------|-------------|-------|
| DISC-001 | Requirements workshop | X |
| FE-001 | [Task] | X |
| BE-001 | [Task] | X |
| ... | ... | ... |

**Phase 1 Subtotal**: X hours

### Phase 2: [Phase Name]
[Repeat structure]

## Timeline
[Gantt chart or milestone list]

## Investment

| Category | Hours | Rate | Amount |
|----------|-------|------|--------|
| Discovery & Planning | X | $XXX | $X,XXX |
| Design | X | $XXX | $X,XXX |
| Development | X | $XXX | $X,XXX |
| QA & Testing | X | $XXX | $X,XXX |
| Project Management | X | $XXX | $X,XXX |
| **Total** | **X** | | **$XX,XXX** |

## Payment Terms
[Payment schedule]

## Assumptions
[List all assumptions]

## Exclusions
[List what's NOT included]

## Terms & Conditions
[Standard terms or link to full document]

## Next Steps
[Call to action]

---

[SIGNATURE BLOCK]
```

---

## Assumptions and Exclusions

### Standard Assumptions (Include in Every Quote)

**Client Responsibilities:**
- Client will provide timely feedback within [X] business days
- Client will designate a single point of contact for decisions
- Client will provide access to required systems and accounts
- Content (text, images) will be provided by client unless specified

**Technical Assumptions:**
- Modern browser support only (latest 2 versions)
- Standard business hours support during development
- Development and staging environments provided
- Production deployment to client's hosting (unless specified)

**Process Assumptions:**
- Agile/iterative development approach
- Weekly status meetings included
- Up to [X] rounds of revisions per deliverable
- Change requests handled via formal change order process

### Standard Exclusions (Include in Every Quote)

**Always Exclude Unless Specified:**
- Ongoing maintenance and support (quote separately)
- Third-party software licenses
- Stock photography or premium assets
- Content creation (copywriting, photography)
- Training beyond basic handoff
- Data migration from legacy systems
- Performance optimization beyond requirements
- Security penetration testing
- Legal review of terms/privacy policy
- Translation/localization

---

## Review Checklist

Before finalizing any quote, verify:

### Completeness
- [ ] All requirements have corresponding tasks
- [ ] Discovery/planning phase included
- [ ] QA time allocated (minimum 15% of dev)
- [ ] Project management time included (10-15%)
- [ ] Documentation time included
- [ ] Deployment/DevOps time included

### Accuracy
- [ ] Base estimates match task complexity
- [ ] Appropriate complexity multipliers applied
- [ ] Risk buffer added
- [ ] Similar past projects referenced
- [ ] Hours sanity-checked against gut feel

### Clarity
- [ ] Tasks are specific and understandable
- [ ] Assumptions clearly stated
- [ ] Exclusions explicitly listed
- [ ] Timeline is realistic
- [ ] Payment terms defined

### Professionalism
- [ ] No typos or grammatical errors
- [ ] Consistent formatting throughout
- [ ] Client name spelled correctly
- [ ] Dates are accurate
- [ ] Contact information included

---

## Customization Notes

**To customize these guidelines for your organization:**

1. Update base hour estimates based on your team's velocity
2. Adjust complexity multipliers based on historical data
3. Modify quote template to match your branding
4. Add organization-specific assumptions and exclusions
5. Include your standard terms and conditions

**To improve estimates over time:**

1. Track actual hours vs. estimated hours per project
2. Identify patterns in over/under estimation
3. Update base estimates quarterly
4. Document lessons learned from each project
5. Use the feedback loop (Phase 3) to automate improvements

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | [Date] | Initial guidelines |

---

*These guidelines are used by the AI Quote Generation Assistant to produce estimates. Keep them updated to ensure accurate quote generation.*
"""


REQUIREMENTS_EXAMPLE_MD = r"""# Example Requirement Format

This document shows how to format requirements for optimal quote generation. The AI performs best when requirements are structured clearly with specific details.

---

## Template: Standard Requirement Format

```markdown
# Project: [Project Name]

## Overview
[2-3 sentence description of what needs to be built]

## Objectives
- [Primary goal 1]
- [Primary goal 2]
- [Primary goal 3]

## Scope

### In Scope
- [Feature/deliverable 1]
- [Feature/deliverable 2]
- [Feature/deliverable 3]

### Out of Scope
- [Explicitly excluded item 1]
- [Explicitly excluded item 2]

## Functional Requirements

### [Feature Area 1]
- FR-001: [Requirement description]
- FR-002: [Requirement description]

### [Feature Area 2]
- FR-003: [Requirement description]
- FR-004: [Requirement description]

## Non-Functional Requirements
- Performance: [Specific metric, e.g., "Page load < 3 seconds"]
- Security: [Requirements, e.g., "HTTPS required, data encryption at rest"]
- Accessibility: [Standard, e.g., "WCAG 2.1 AA compliance"]
- Browser Support: [List supported browsers]

## Technical Constraints
- [Constraint 1, e.g., "Must integrate with existing Salesforce instance"]
- [Constraint 2, e.g., "Must use AWS infrastructure"]

## Timeline
- Desired start date: [Date]
- Desired completion: [Date]
- Key milestones: [If any]

## Additional Context
[Any other relevant information]
```

---

## Example 1: E-Commerce Website

```markdown
# Project: GreenLeaf Organic Store - E-Commerce Website

## Overview
Build a modern e-commerce website for an organic food retailer. The site should allow customers to browse products, add items to cart, and complete purchases with credit card or PayPal.

## Objectives
- Enable online sales of organic food products
- Provide seamless mobile shopping experience
- Integrate with existing inventory management system

## Scope

### In Scope
- Product catalog with categories and search
- Shopping cart functionality
- Checkout with Stripe and PayPal integration
- User accounts with order history
- Admin panel for product management
- Basic SEO optimization
- Mobile-responsive design

### Out of Scope
- Subscription/recurring orders
- Loyalty points program
- Multi-language support
- Mobile native apps

## Functional Requirements

### Product Catalog
- FR-001: Display products in grid/list view with images, prices, and descriptions
- FR-002: Filter products by category, price range, dietary restrictions
- FR-003: Search products by name and description
- FR-004: Show product details page with multiple images, full description, nutrition info

### Shopping Cart
- FR-005: Add/remove items from cart
- FR-006: Update quantities in cart
- FR-007: Persist cart for logged-in users
- FR-008: Show cart summary in header

### Checkout
- FR-009: Guest checkout option
- FR-010: Address entry with validation
- FR-011: Shipping method selection with real-time rates
- FR-012: Payment processing via Stripe and PayPal
- FR-013: Order confirmation email

### User Accounts
- FR-014: Registration and login
- FR-015: Password reset via email
- FR-016: View order history
- FR-017: Save multiple shipping addresses

### Admin Panel
- FR-018: Add/edit/delete products
- FR-019: Manage categories
- FR-020: View and process orders
- FR-021: Basic sales reports

## Non-Functional Requirements
- Performance: Product pages load in < 2 seconds
- Security: PCI DSS compliance for payment processing
- Accessibility: WCAG 2.1 AA compliance
- Browser Support: Chrome, Firefox, Safari, Edge (latest 2 versions)

## Technical Constraints
- Must integrate with ShipStation for shipping
- Must sync inventory with existing NetSuite ERP
- Hosting on AWS preferred

## Timeline
- Desired start date: February 1, 2024
- Desired completion: April 30, 2024
- Key milestones: Beta launch by April 1 for internal testing
```

---

## Example 2: Internal Dashboard Application

```markdown
# Project: Sales Analytics Dashboard

## Overview
Create an internal dashboard for the sales team to visualize pipeline data, track KPIs, and generate reports. Data will be pulled from Salesforce CRM.

## Objectives
- Provide real-time visibility into sales pipeline
- Enable self-service reporting for sales managers
- Reduce time spent on manual report generation

## Scope

### In Scope
- Dashboard with key sales metrics
- Pipeline visualization (funnel, trends)
- Customizable date ranges
- Export to PDF/Excel
- Role-based access (Sales Rep, Manager, Executive)
- Salesforce integration

### Out of Scope
- Data entry/CRM functionality
- Forecasting/ML predictions
- Mobile app
- Real-time push notifications

## Functional Requirements

### Dashboard
- FR-001: Display total revenue, deals closed, win rate, average deal size
- FR-002: Show pipeline by stage (visual funnel)
- FR-003: Revenue trends over time (line chart)
- FR-004: Top performers leaderboard
- FR-005: Filter all views by date range, region, product line

### Reports
- FR-006: Pre-built report templates (weekly summary, monthly review)
- FR-007: Custom report builder with drag-and-drop
- FR-008: Export reports to PDF and Excel
- FR-009: Schedule automated report delivery via email

### User Management
- FR-010: SSO integration with company Okta
- FR-011: Role-based permissions (view own data vs. team vs. all)
- FR-012: Admin can manage user roles

## Non-Functional Requirements
- Performance: Dashboard loads in < 5 seconds with 100K records
- Security: SOC 2 compliant data handling
- Availability: 99.5% uptime during business hours

## Technical Constraints
- Must use existing Azure infrastructure
- Salesforce API rate limits: 15,000 calls/day
- Data refresh frequency: Every 15 minutes (not real-time)

## Timeline
- Desired start date: March 15, 2024
- Desired completion: May 31, 2024
```

---

## Example 3: Mobile App Feature Addition

```markdown
# Project: HealthTrack App - Social Features

## Overview
Add social features to existing health tracking mobile app, allowing users to connect with friends, share achievements, and participate in challenges.

## Objectives
- Increase user engagement through social features
- Improve retention via friend accountability
- Create viral growth through sharing

## Scope

### In Scope
- Friend connections (add, remove, block)
- Activity feed showing friends' achievements
- Create and join fitness challenges
- Share achievements to social media
- Privacy controls

### Out of Scope
- Direct messaging/chat
- Group video workouts
- Paid challenges or prizes
- Integration with other fitness apps

## Functional Requirements

### Friend System
- FR-001: Search users by username or email
- FR-002: Send/accept/decline friend requests
- FR-003: View friends list
- FR-004: Remove friend or block user
- FR-005: Import contacts to find existing users

### Activity Feed
- FR-006: Show chronological feed of friends' achievements
- FR-007: Like and comment on achievements
- FR-008: Filter feed by activity type
- FR-009: Pull-to-refresh

### Challenges
- FR-010: Browse public challenges
- FR-011: Create private challenge and invite friends
- FR-012: Challenge types: steps, workouts, streak
- FR-013: Real-time leaderboard within challenge
- FR-014: Achievement badges for completing challenges

### Privacy
- FR-015: Control who sees your activity (Everyone, Friends, None)
- FR-016: Hide specific activities from feed
- FR-017: Private profile option

## Non-Functional Requirements
- Performance: Feed loads in < 2 seconds
- Scalability: Support 100K concurrent users
- Platform: iOS 14+ and Android 10+

## Technical Constraints
- Must work with existing Firebase backend
- Push notifications via existing OneSignal integration
- App size increase must be < 10MB

## Timeline
- Desired start date: January 8, 2024
- Desired completion: March 8, 2024
```

---

## Tips for Writing Good Requirements

### Be Specific
- **Bad**: "The system should be fast"
- **Good**: "Page load time should be under 2 seconds on 3G connections"

### Use Measurable Criteria
- **Bad**: "Support many users"
- **Good**: "Support 10,000 concurrent users with < 500ms response time"

### Clarify Boundaries
- **Bad**: "Basic user management"
- **Good**: "User registration, login, password reset. No SSO in this phase."

### Include Context
- **Bad**: "Integrate with payment system"
- **Good**: "Integrate with Stripe for credit cards. Customer already has Stripe account. Need to support US and Canada."

### Prioritize Features
Use MoSCoW or similar:
- **Must Have**: Critical for launch
- **Should Have**: Important but not critical
- **Could Have**: Nice to have if time permits
- **Won't Have**: Explicitly out of scope for this phase

---

## Common Mistakes to Avoid

1. **Vague Scope**: "Build a website" - what kind? what features?
2. **Missing Non-Functionals**: Forgetting performance, security, accessibility
3. **No Constraints**: Not mentioning existing systems, tech stack requirements
4. **Unrealistic Timeline**: "Need full e-commerce site in 2 weeks"
5. **Missing User Roles**: Who uses this? What can each role do?
6. **No Success Criteria**: How do we know it's done and working?

---

## How This Helps Quote Generation

When you provide requirements in this format, the AI can:

1. **Identify all features** that need to be estimated
2. **Recognize complexity** based on functional requirements
3. **Apply appropriate multipliers** for non-functional requirements
4. **Account for integrations** mentioned in constraints
5. **Structure the quote** to match your requirement sections
6. **Flag missing information** that affects estimates
"""


TRAINING_FASHION_SHOPIFY_MD = r"""# Project: Fashion Brand E-commerce Store

## Client Information
- Industry: Fashion/Retail
- Platform: Shopify
- Complexity: Medium
- Date: 2024-08

## Initial Requirements

Client email:
> Hi, we're launching a new fashion brand and need an online store.
> We have about 200 products (clothing and accessories) and want
> something that looks premium and matches our brand. We'd also like
> to sell on Instagram. Budget is around $10-15k.

Key points from initial request:
- 200+ products (clothing and accessories)
- Premium look and feel
- Instagram selling capability
- Budget: $10,000 - $15,000

## Communication History

### Round 1 - Initial Discovery Call (Aug 5)

**PM Asked:**
1. Do you have brand guidelines (logo, colors, fonts)?
2. Will products have variants like size and color?
3. Do you need multi-currency for international sales?
4. Do you have product photos ready or need photography?
5. Any specific payment gateways required?

**Client Response:**
1. Yes, we have full brand guidelines from our designer
2. Yes, most items have size (XS-XL) and color variants (3-5 colors each)
3. Yes! We want USD and EUR, maybe GBP later
4. Photos are being shot now, will be ready in 2 weeks
5. We want Stripe and PayPal

### Round 2 - Feature Clarification (Aug 8)

**PM Asked:**
1. Do you need a blog section for fashion content?
2. What about size guides - standard or per-category?
3. Newsletter signup - any specific email platform?
4. Do you need customer accounts or guest checkout only?

**Client Response:**
1. Yes, definitely want a blog for styling tips and brand stories
2. Size guide per category would be great (we have 4 categories)
3. We use Klaviyo for email marketing
4. Both - customer accounts with wishlist feature

### Round 3 - Scope Addition (Aug 12)

**Client Added:**
> We forgot to mention - can you also set up a popup for
> first-time visitors with a 10% discount code? And we need
> to migrate about 15 blog posts from our old WordPress site.

**PM Response:**
- Popup with discount: Added to scope
- Blog migration (15 posts): Added to scope
- This adds approximately 8-10 hours to the estimate

## Final Requirements Summary

After all discussions, confirmed scope:

**Core Store:**
- Shopify Plus setup and configuration
- Custom theme development matching brand guidelines
- 200 products with size/color variants
- 4 product categories with filtering

**Features:**
- Multi-currency (USD, EUR)
- Instagram Shopping integration
- Klaviyo newsletter integration
- First-time visitor popup (10% discount)
- Customer accounts with wishlist
- Size guide per category (4 categories)

**Content:**
- Blog setup and migration (15 posts from WordPress)
- All product content uploaded

**Integrations:**
- Stripe payment gateway
- PayPal payment gateway
- Klaviyo email marketing
- Instagram/Meta Shopping

## Final Quote

| Task | Hours | Rate | Total |
|------|-------|------|-------|
| Shopify Setup & Configuration | 8 | $100 | $800 |
| Custom Theme Development | 40 | $100 | $4,000 |
| Product Upload (200 products w/ variants) | 24 | $100 | $2,400 |
| Multi-currency Configuration | 4 | $100 | $400 |
| Instagram Shopping Integration | 8 | $100 | $800 |
| Blog Setup & Migration (15 posts) | 6 | $100 | $600 |
| Klaviyo Newsletter Integration | 4 | $100 | $400 |
| Popup Implementation | 3 | $100 | $300 |
| Customer Accounts & Wishlist | 6 | $100 | $600 |
| Size Guide Feature (4 categories) | 8 | $100 | $800 |
| Payment Gateway Setup (Stripe + PayPal) | 4 | $100 | $400 |
| Testing & QA | 10 | $100 | $1,000 |
| Project Management | 5 | $100 | $500 |
| **TOTAL** | **130** | | **$13,000** |

## Assumptions & Exclusions

**Included:**
- Shopify monthly fee for first month
- Up to 2 rounds of design revisions
- 30 days post-launch support
- Basic SEO setup

**Excluded:**
- Product photography
- Copywriting for product descriptions
- Ongoing maintenance after 30 days
- Additional payment gateways beyond Stripe/PayPal
- Custom app development

**Client Responsibilities:**
- Provide all product images and descriptions
- Provide brand guidelines and assets
- Timely feedback (within 48 hours)
- Klaviyo account setup

## Outcome

- Status: **Approved**
- Actual Hours: 142 (12 hours over estimate)
- Variance: +9.2%

**Notes:**
- Size guide took longer than expected (custom design requests)
- Product upload was faster due to client's well-organized spreadsheet
- Client requested additional popup A/B testing (+4 hours, billed separately)
- Overall successful project, client gave referral
"""


TRAINING_RESTAURANT_WORDPRESS_MD = r"""# Project: Restaurant Website with Online Ordering

## Client Information
- Industry: Food & Beverage / Restaurant
- Platform: WordPress
- Complexity: Low-Medium
- Date: 2024-06

## Initial Requirements

Client inquiry:
> We're a family restaurant looking to update our old website.
> Need online menu, reservation system, and maybe online ordering
> for pickup. Nothing too fancy, just clean and mobile-friendly.

## Communication History

### Round 1 - Requirements Gathering (Jun 3)

**PM Asked:**
1. How many menu items approximately?
2. Do you want online ordering integrated with your POS?
3. Reservation system preference - OpenTable, Resy, or simple form?
4. Do you have photos of your food and restaurant?

**Client Response:**
1. About 45 menu items across 6 categories
2. No POS integration needed - just email notifications for orders
3. Simple form is fine, we'll manage manually
4. We have some photos, might need a few more taken

### Round 2 - Scope Confirmation (Jun 5)

**PM Asked:**
- Confirm: Online ordering for pickup only (no delivery)?
- Do you need payment processing online or pay at pickup?

**Client Response:**
- Yes, pickup only
- Pay at pickup is fine for now, keeps it simple

## Final Requirements Summary

- WordPress website (5-6 pages)
- Mobile-responsive design
- Online menu with 45 items in 6 categories
- Simple online ordering (pickup, pay at restaurant)
- Reservation request form
- Contact page with map
- Basic photo gallery

## Final Quote

| Task | Hours | Rate | Total |
|------|-------|------|-------|
| WordPress Setup & Hosting Config | 4 | $100 | $400 |
| Theme Customization | 16 | $100 | $1,600 |
| Menu Page Development | 8 | $100 | $800 |
| Online Ordering System (WooCommerce) | 12 | $100 | $1,200 |
| Reservation Form | 3 | $100 | $300 |
| Contact Page & Google Maps | 2 | $100 | $200 |
| Photo Gallery | 3 | $100 | $300 |
| Mobile Optimization | 4 | $100 | $400 |
| Testing & Launch | 4 | $100 | $400 |
| **TOTAL** | **56** | | **$5,600** |

## Assumptions & Exclusions

**Included:**
- WordPress theme license
- 1 year hosting setup
- Menu content entry
- Basic SEO

**Excluded:**
- Food photography
- Ongoing menu updates (training provided)
- POS integration
- Delivery functionality

## Outcome

- Status: **Approved**
- Actual Hours: 52 (4 hours under estimate)
- Variance: -7.1%

**Notes:**
- Client had well-organized menu spreadsheet
- Simple requirements made project smooth
- Client later requested delivery feature (separate project)
"""


# Very small placeholder docs from "existing clients" / "New clients"
REQUIREMENTS_BLANK_EXISTING_MD = "Requirements:-\n\n\nQuotes\n"
REQUIREMENTS_BLANK_NEW_MD = "Requirements:-\n\n\nQuotes\n"


# ---------------------------------------------------------------------------
# Organization-specific WordPress stack guidelines
# ---------------------------------------------------------------------------


WORDPRESS_STACK_GUIDELINES_MD = r"""# WordPress Preferred Stack and Defaults

These guidelines define the standard WordPress themes, page builders, and plugins
that our company prefers to use when estimating and planning WordPress projects.

The AI should:
- **Respect any explicit tools requested by the client**, and
- **Fall back to these defaults when the client does not specify** themes/builders/plugins.

---

## Core Principles

1. **Client choice comes first**  
   - If the client names a specific theme, builder, or plugin (for example:
     "Use Gravity Forms", "Site is already on Divi", "We want WooCommerce"),
     the AI must *not* replace it with a different default.

2. **Use our default stack when the brief is silent**  
   - When the requirements do not mention themes/builders/plugins, the AI should
     assume our standard stack defined below.

3. **Prefer stable, widely adopted tools**  
   - When suggesting tools, prioritize stability, long-term support, and
     popularity in the WordPress ecosystem.

---

## Default Theme

- **Primary default theme**: `Underscores` (a.k.a. `_s`)
  - Use this when:
    - The client does **not** specify a theme.
    - A custom-designed site is being built rather than a pre-made template.
  - Rationale:
    - Clean starter theme, minimal bloat.
    - Ideal foundation for custom design and development.

If the client explicitly names a different theme (e.g. Astra, GeneratePress,
Hello Elementor, Divi theme), always respect that choice.

---

## Preferred Page Builders

We regularly work with the following page builders:

1. **Elementor** (primary default)
2. **Divi Builder**
3. **Beaver Builder**

### Selection Rules

- If the client explicitly requests a builder (e.g. "Use Elementor", "Site is
  already built in Divi", "We prefer Beaver Builder"), **use that builder**.

- If the client does **not** mention a builder and a visual builder is a good
  fit, default to:
  1. **Elementor** as first choice, unless there is a strong reason to do
     otherwise in context.
  2. If Elementor is clearly unsuitable based on requirements, fall back to
     Divi or Beaver Builder as appropriate.

- If the brief suggests a fully custom theme without a visual builder, the AI
  may choose to use Underscores + custom templates instead of a builder.

When estimating, the AI should:
- Account for setup/configuration time for the selected builder.
- Consider builder-specific patterns (templates, global styles, theme builder,
  etc.) in the task breakdown.

---

## Preferred Plugins by Category

These are **defaults only**. If the client requests a specific plugin, or has
an existing plugin in place, the AI must respect that and should not replace it
with a different option.

### Forms

- **Primary default**: `Gravity Forms`
- **Secondary / lightweight option**: `Contact Form 7`

Selection rules:
- If client explicitly says: "Use Gravity Forms" → use Gravity Forms.
- If client explicitly says: "Use Contact Form 7" → use Contact Form 7.
- If client is silent and the project needs:
  - Complex forms, conditional logic, integrations, payments → **Gravity Forms**.
  - Very simple contact forms only → **Contact Form 7** is acceptable.

The AI must **not** switch from Gravity Forms to Contact Form 7 when the
client has clearly asked for Gravity Forms.

### E-commerce

- **Default**: `WooCommerce` for WordPress-based online stores.

Rules:
- If the client states they want WooCommerce, or already uses WooCommerce,
  always keep WooCommerce in the estimate.
- If the client simply says "online ordering" or "e-commerce" on a WordPress
  site and does not mention a specific e-commerce plugin, assume WooCommerce.

### SEO

Common SEO plugins we are comfortable with include:
- `Yoast SEO`
- `Rank Math`

Selection rules:
- If the client names a specific SEO plugin, use that one.
- If not specified, the AI can pick either Yoast SEO or Rank Math as the SEO
  plugin, based on context, and include setup/configuration time in the tasks.

### Other Common Plugin Categories

Depending on the project, the AI may also assume use of:
- Caching/performance plugins (e.g. WP Rocket, W3 Total Cache).
- Security plugins (e.g. Wordfence, iThemes Security).
- Backup plugins (e.g. UpdraftPlus).

These should only be included when relevant to the project scope, and should
never override a specific tool the client has requested.

---

## Decision Rules Summary (for the AI)

When estimating a **WordPress** project:

1. **Check for client-specified tools first**
   - If the brief or requirements explicitly mention:
     - A theme name
     - A page builder name
     - Specific plugins (forms, SEO, e-commerce, etc.)
   - → Use those exact tools in the plan and estimation.

2. **If no tools are specified by the client**
   - Theme:
     - Default to **Underscores** for custom theme builds.
   - Page builder:
     - Default to **Elementor**, unless context strongly suggests another choice.
   - Forms:
     - Default to **Gravity Forms** for anything beyond a very simple contact form.
     - Optionally use **Contact Form 7** for trivial contact forms only.
   - E-commerce:
     - Default to **WooCommerce** for WordPress-based stores.
   - SEO:
     - Choose a standard plugin such as **Yoast SEO** or **Rank Math**.

3. **Never downgrade or silently swap plugins**
   - Do not replace:
     - Gravity Forms with Contact Form 7 when Gravity Forms is requested.
     - WooCommerce with another plugin when WooCommerce is specified.
     - Elementor/Divi/Beaver with another builder when the client has chosen one.

4. **Explain assumptions briefly in the quote**
   - When defaults are used because the client did not specify tools, note this
     in the assumptions section, for example:
     - "Assumes WordPress build using Underscores starter theme and Elementor
        page builder."
     - "Assumes Gravity Forms for contact and inquiry forms where plugin is
        not specified by client."
"""


# ---------------------------------------------------------------------------
# Registry of builtin knowledge documents
# ---------------------------------------------------------------------------


BUILTIN_KNOWLEDGE_DOCUMENTS: List[KnowledgeDocument] = [
    KnowledgeDocument(
        source_id="guideline-estimation",
        source_type="guideline",
        content=ESTIMATION_GUIDELINES_MD,
        metadata={
            "category": "estimation_rules",
            "platform": "generic",
        },
    ),
    KnowledgeDocument(
        source_id="guideline-requirements-format",
        source_type="guideline",
        content=REQUIREMENTS_EXAMPLE_MD,
        metadata={
            "category": "requirements_format",
            "platform": "generic",
        },
    ),
    KnowledgeDocument(
        source_id="guideline-wordpress-stack",
        source_type="guideline",
        content=WORDPRESS_STACK_GUIDELINES_MD,
        metadata={
            "category": "platform_stack",
            "platform": "wordpress",
        },
    ),
    KnowledgeDocument(
        source_id="training-EXAMPLE-project-001-fashion-ecommerce-shopify",
        source_type="training_quote",
        content=TRAINING_FASHION_SHOPIFY_MD,
        metadata={
            "platform": "shopify",
            "project_type": "ecommerce",
            "industry": "fashion_retail",
        },
    ),
    KnowledgeDocument(
        source_id="training-EXAMPLE-project-002-restaurant-wordpress",
        source_type="training_quote",
        content=TRAINING_RESTAURANT_WORDPRESS_MD,
        metadata={
            "platform": "wordpress",
            "project_type": "restaurant_site",
            "industry": "food_beverage",
        },
    ),
    KnowledgeDocument(
        source_id="training-existing-clients-requirements-blank",
        source_type="training_quote",
        content=REQUIREMENTS_BLANK_EXISTING_MD,
        metadata={
            "category": "requirements_blank",
            "client_type": "existing",
        },
    ),
    KnowledgeDocument(
        source_id="training-new-clients-requirements-blank",
        source_type="training_quote",
        content=REQUIREMENTS_BLANK_NEW_MD,
        metadata={
            "category": "requirements_blank",
            "client_type": "new",
        },
    ),
]

