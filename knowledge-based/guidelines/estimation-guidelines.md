# Estimation Guidelines

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
| Email service integration | 4-8h | 8-12h | 12-20h |
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
