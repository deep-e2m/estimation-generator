# Knowledge Base - AI Quote Generation Assistant

This folder contains the training data and guidelines that power the AI-based quote generation system. The quality and quantity of documents in this knowledge base directly impact the accuracy of generated estimates.

---

## Folder Structure

```
/knowledge-based
├── README.md                     # This file
├── formatting/                   # Sample quote documents for AI training
│   ├── Prepared for_ Colony Spark.docx
│   ├── Propasal_ Women's Nonprofit Alliance.docx
│   └── Proposal to Replicate - https___www.snowillow.com_.docx
├── requirements/                 # Example requirement formats
│   └── example-requirement.md
└── guidelines/                   # Estimation rules and standards
    └── estimation-guidelines.md
```

---

## How to Upload Documents

### Step 1: Prepare Your Documents

Before uploading, ensure your quote documents contain:

1. **Project Description**: Clear scope of work
2. **Line Items**: Individual tasks or deliverables
3. **Hour Estimates**: Time allocated per line item
4. **Rates** (optional): Hourly or fixed rates
5. **Total Calculations**: Sum of hours and costs

### Step 2: Supported File Formats

| Format | Extension | Recommended | Notes |
|--------|-----------|-------------|-------|
| Microsoft Word | `.docx` | Yes | Best format - preserves structure |
| PDF | `.pdf` | Yes | Good for finalized quotes |
| Plain Text | `.txt` | Acceptable | Use for simple quotes only |
| Rich Text | `.rtf` | Acceptable | Converts to plain text |
| Markdown | `.md` | Acceptable | Good for structured content |

**Note**: Legacy `.doc` files (Word 97-2003) should be converted to `.docx` for best results.

### Step 3: Place Files in Correct Folder

- **Sample Quotes**: Place in `/knowledge-based/formatting/`
- **Requirement Examples**: Place in `/knowledge-based/requirements/`
- **Guideline Documents**: Place in `/knowledge-based/guidelines/`

### Step 4: File Naming Convention

Use descriptive names that help identify the quote:

```
Good:
- Proposal_ClientName_ProjectType_2024.docx
- Quote_WebsiteRedesign_Acme_March2024.pdf
- Estimate_MobileApp_TechStartup.docx

Avoid:
- Quote1.docx
- final_v3_FINAL.pdf
- Untitled.docx
```

---

## Recommended Number of Documents

### Minimum Requirements

| Document Type | Minimum | Recommended | Optimal |
|---------------|---------|-------------|---------|
| Sample Quotes | 10 | 30-50 | 100+ |
| Requirement Examples | 3 | 10 | 20+ |
| Guideline Docs | 1 | 3 | 5+ |

### Why 30-50 Sample Quotes?

The AI learns estimation patterns from your historical quotes. With fewer than 30 samples:
- Estimates may be inconsistent
- Edge cases won't be handled well
- The model may overfit to specific project types

With 30-50 diverse samples:
- The AI recognizes patterns across project types
- Estimates become more reliable
- Different complexity levels are understood

With 100+ samples:
- Highest accuracy for diverse requirements
- Better handling of unusual requests
- More nuanced understanding of your pricing

---

## Document Quality Guidelines

### Include Diverse Project Types

Your training set should include quotes for:

- [ ] Small projects (< 40 hours)
- [ ] Medium projects (40-200 hours)
- [ ] Large projects (200+ hours)
- [ ] Different service types (design, development, consulting, etc.)
- [ ] Different industries (if applicable)
- [ ] Fixed-price and time-and-materials quotes

### What Makes a Good Training Document

**Include:**
- Clear task breakdown
- Specific hour estimates per task
- Assumptions and exclusions
- Project phases (if applicable)
- Detailed descriptions of deliverables

**Avoid:**
- Quotes with only totals (no breakdown)
- Incomplete or draft quotes
- Quotes with errors you wouldn't want replicated
- Confidential client information (see Privacy section)

### Document Formatting Tips

1. **Use Consistent Structure**: Similar section headings across quotes
2. **Clear Line Items**: One task per row in tables
3. **Explicit Hours**: Avoid ranges like "10-20 hours" - use specific numbers
4. **Categorize Tasks**: Group related tasks (Design, Development, QA, etc.)

---

## How the System Learns

### Initial Training (Phase 1)

When you first set up the system:

1. All documents in `/formatting/` are parsed
2. Text and structure are extracted
3. The AI learns your estimation patterns:
   - Task-to-hours correlations
   - Common line items for project types
   - Your typical quote structure and language
   - Pricing patterns and multipliers

### Continuous Learning (Phase 3)

After Phase 3 deployment:

1. When you edit a generated quote, changes are tracked
2. Your corrections become training signals
3. The model periodically retrains on:
   - Original requirements
   - Generated estimates
   - Your corrections
4. Accuracy improves over time

### Learning Feedback Cycle

```
Requirements -> AI Estimate -> User Edits -> Feedback Captured
                                                    |
                                                    v
                                           Model Improvement
                                                    |
                                                    v
                                           Better Estimates
```

---

## Privacy and Confidentiality

### Before Uploading

**Remove or redact:**
- Client names (replace with "Client A", "Client B")
- Contact information (emails, phone numbers, addresses)
- Proprietary pricing agreements
- Confidential project details
- Any PII (Personally Identifiable Information)

**Safe to include:**
- Project types and descriptions
- Task breakdowns and hour estimates
- Your standard rates (if not confidential)
- General assumptions and exclusions

### Data Storage

- All uploaded documents are stored securely
- Documents are only used to train YOUR instance
- Data is not shared with other users or organizations
- You can delete training data at any time

---

## Troubleshooting

### Document Not Processing

**Symptoms**: File appears in folder but isn't recognized by system

**Solutions**:
1. Check file format is supported (see Supported Formats above)
2. Ensure file isn't corrupted (can you open it locally?)
3. Convert `.doc` to `.docx`
4. Check file permissions
5. Re-upload the file

### Poor Estimation Quality

**Symptoms**: Generated estimates don't match your patterns

**Solutions**:
1. Add more diverse sample quotes (aim for 30+)
2. Ensure samples include similar project types
3. Check that hour breakdowns are clear in source docs
4. Review and update estimation guidelines
5. Provide corrections to enable learning (Phase 3)

### Inconsistent Formatting

**Symptoms**: Generated quotes have inconsistent structure

**Solutions**:
1. Standardize your sample quote formats
2. Update `/guidelines/estimation-guidelines.md` with your template
3. Use the same section headings across samples

---

## Getting Help

If you encounter issues with the knowledge base:

1. Check this README for guidance
2. Review the example files in `/requirements/` and `/guidelines/`
3. Contact system administrator
4. Submit a support ticket

---

## Quick Reference

| Action | Location |
|--------|----------|
| Add sample quotes | `/knowledge-based/formatting/` |
| Add requirement examples | `/knowledge-based/requirements/` |
| Update estimation rules | `/knowledge-based/guidelines/estimation-guidelines.md` |
| Check supported formats | This README, "Supported File Formats" section |
| Minimum samples needed | 10 (30-50 recommended) |
