# Example Requirement Format

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
