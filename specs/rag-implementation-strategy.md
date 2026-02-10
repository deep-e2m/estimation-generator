# RAG Implementation Strategy

**Document Version**: 1.0
**Last Updated**: 2026-01-21
**Status**: Specification
**Classification**: Internal

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Knowledge Base Analysis](#2-current-knowledge-base-analysis)
3. [RAG Architecture](#3-rag-architecture)
4. [Knowledge Base Auto-Learning](#4-knowledge-base-auto-learning)
5. [Implementation Roadmap](#5-implementation-roadmap)
6. [Training Data Requirements](#6-training-data-requirements)

---

## 1. Executive Summary

### 1.1 Current State

**Status**: RAG system NOT implemented yet.

**Evidence**:
- pgvector extension planned but no tables created
- No embedding generation code
- No vector search implementation
- Knowledge base contains only 3 sample documents

**Required**: User needs to provide 30-50 historical quotes for effective RAG.

### 1.2 RAG Purpose

The RAG (Retrieval-Augmented Generation) system will:

1. Store historical quotes and project requirements as embeddings
2. Retrieve similar past projects during quote generation
3. Improve estimation accuracy by learning from approved quotes
4. Auto-update knowledge base when PMs approve new quotes

---

## 2. Knowledge Base Structure

### 2.1 Folder Structure (IMPORTANT)

```
/knowledge-based/
│
├── formatting/                          # OUTPUT TEMPLATES (DO NOT MODIFY)
│   ├── Prepared for_ Colony Spark.docx
│   ├── Propasal_ Women's Nonprofit Alliance.docx
│   └── Proposal to Replicate - https___www.snowillow.com_.docx
│
│   PURPOSE: These 3 DOCX files define HOW generated quotes should LOOK.
│   The LLM uses these as formatting templates for output structure,
│   sections, styling, and professional presentation.
│
├── training/                            # RAG TRAINING DATA
│   └── quotes/                          # Historical quotes for learning
│       ├── project-001-fashion-shopify.md
│       ├── project-002-restaurant-wordpress.md
│       └── ... (30-50 files needed)
│
│   PURPOSE: These files teach the RAG system about estimation patterns,
│   typical hours for tasks, and how requirements map to estimates.
│
└── guidelines/                          # Estimation rules
    └── estimation-guidelines.md
```

### 2.2 Key Distinction

| Folder | Purpose | Used By |
|--------|---------|---------|
| `formatting/` | Output templates - defines quote appearance | LLM for **formatting output** |
| `training/quotes/` | Historical data - teaches estimation | RAG for **finding similar projects** |

**The 3 DOCX files in formatting/ are NOT for RAG training.**
They define the professional format PMs expect in generated quotes.

### 2.3 Gap Analysis

| Required | Current | Status |
|----------|---------|--------|
| Output templates | 3 DOCX files | READY |
| Training quotes | 0 | CRITICAL GAP - Need 30-50 |
| Diverse project types | None | Need variety |
| Multiple platforms | None | Need WordPress, Shopify, WooCommerce |

### 2.4 Data Collection Plan

**User Action Required**:

1. Create 30-50 historical quote files in `/knowledge-based/training/quotes/`
2. Use the training data format specified in Section 2.5
3. Include communication history for projects with back-and-forth
4. Run ingestion pipeline after adding files

### 2.5 Training Data Format

**Use ONE markdown file per project** containing all context:

```markdown
# Project: [Project Name]

## Client Information
- Industry: [e.g., Fashion/Retail, Restaurant, SaaS]
- Platform: [WordPress/Shopify/WooCommerce/Custom]
- Complexity: [Low/Medium/High]
- Date: [YYYY-MM]

## Initial Requirements
[Paste the original client request or requirements document]

Example:
Client needs an online store for their fashion brand with:
- 200+ products with variants (size, color)
- Custom theme matching their brand guidelines
- Integration with Instagram shopping
- Newsletter signup with discount code

## Communication History

### Round 1 - [Date or Topic]
**PM Asked:**
- [Question 1]
- [Question 2]

**Client Response:**
- [Answer 1]
- [Answer 2]

### Round 2 - [Date or Topic]
**PM Asked:**
- [Clarifying question]

**Client Response:**
- [Client's answer with additional scope]

[Add as many rounds as needed - this helps the LLM understand
how scope evolves through client communication]

## Final Requirements Summary
After all discussions, the confirmed scope includes:
- [Final requirement 1]
- [Final requirement 2]
- [Changes from original scope]

## Final Quote

| Task | Hours | Rate | Total |
|------|-------|------|-------|
| [Task 1] | X | $100 | $X00 |
| [Task 2] | X | $100 | $X00 |
| Testing & QA | X | $100 | $X00 |
| **TOTAL** | **XX** | | **$X,XXX** |

## Assumptions & Exclusions
- [What's included]
- [What's NOT included]
- [Dependencies on client]

## Outcome (Optional but valuable)
- Status: [Approved/Rejected/Modified]
- Actual Hours: [If project completed, actual hours spent]
- Notes: [Any learnings - was estimate accurate?]
```

### 2.6 Why Include Communication History?

The back-and-forth communication is **critical** for RAG because:

1. **Scope Evolution**: Shows how initial requirements change
2. **Question Patterns**: LLM learns what questions to ask
3. **Estimation Accuracy**: Final quote reflects ALL requirements, not just initial
4. **Context Matching**: When new project has similar discussions, RAG finds better matches

**Example**: Client asks for "simple website" but communication reveals:
- Initial: "Simple 5-page website" → 20 hours estimate
- After Q&A: "Plus e-commerce, blog, multi-language" → 80 hours estimate

Without communication history, RAG might match on "simple website" and give wrong estimate.

### 2.7 File Naming Convention

```
project-[number]-[brief-description]-[platform].md

Examples:
- project-001-fashion-ecommerce-shopify.md
- project-002-restaurant-website-wordpress.md
- project-003-saas-landing-page-custom.md
- project-004-nonprofit-donation-wordpress.md
```

### 2.8 Minimum Data Requirements

| Metric | Minimum | Recommended | Ideal |
|--------|---------|-------------|-------|
| Total files | 10 | 30-50 | 100+ |
| Per platform | 3 | 10+ | 30+ |
| With communication | 30% | 50% | 70% |
| Complexity variety | All 3 levels | Balanced | Balanced |

---

## 3. RAG Architecture

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      RAG PIPELINE                                │
│                                                                  │
│  ┌────────────────┐      ┌────────────────┐      ┌───────────┐ │
│  │  Document      │─────>│  Chunking      │─────>│ Embedding │ │
│  │  Ingestion     │      │  Strategy      │      │ Generation│ │
│  │                │      │  (512 tokens)  │      │ (OpenAI)  │ │
│  └────────────────┘      └────────────────┘      └─────┬─────┘ │
│                                                          │       │
│                                                          v       │
│  ┌────────────────┐      ┌────────────────┐      ┌───────────┐ │
│  │  Retrieved     │<─────│  Vector        │<─────│ pgvector  │ │
│  │  Context       │      │  Search        │      │ Storage   │ │
│  │                │      │  (cosine sim)  │      │           │ │
│  └───────┬────────┘      └────────────────┘      └───────────┘ │
│          │                                                       │
│          v                                                       │
│  ┌────────────────┐                                             │
│  │  LLM           │  "Generate quote using these examples..."   │
│  │  Generation    │                                             │
│  │  (Gemini/GPT)  │                                             │
│  └────────────────┘                                             │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Database Schema

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Quotes table (metadata)
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    title VARCHAR(500),
    total_hours NUMERIC(10, 2),
    total_cost NUMERIC(12, 2),
    platform VARCHAR(50),  -- 'wordpress', 'shopify', 'woocommerce'
    complexity VARCHAR(20), -- 'low', 'medium', 'high'
    status VARCHAR(20),    -- 'draft', 'published', 'approved'
    content TEXT,          -- Full quote content
    requirements TEXT,     -- Original requirements
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB         -- Custom fields
);

-- Knowledge base embeddings (vector storage)
CREATE TABLE knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(50) NOT NULL,  -- 'quote', 'requirement', 'guideline'
    source_id UUID NOT NULL,           -- Reference to quotes.id, etc.
    chunk_text TEXT NOT NULL,          -- Original text chunk
    chunk_index INTEGER NOT NULL,      -- Chunk order in document
    embedding vector(1536) NOT NULL,   -- OpenAI text-embedding-3-small
    metadata JSONB,                    -- Platform, complexity, tags
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create HNSW index for fast vector search
CREATE INDEX knowledge_embeddings_embedding_idx
ON knowledge_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Metadata index for filtering
CREATE INDEX knowledge_embeddings_metadata_idx
ON knowledge_embeddings
USING gin (metadata);

-- Source type index
CREATE INDEX knowledge_embeddings_source_type_idx
ON knowledge_embeddings (source_type);
```

### 3.3 Embedding Generation

```python
# /backend/app/services/ai/embedding_service.py

import httpx
from typing import List
from app.config import settings

class EmbeddingService:
    """
    Generate embeddings using OpenRouter (OpenAI text-embedding-3-small).
    """

    EMBEDDING_MODEL = "openai/text-embedding-3-small"
    EMBEDDING_DIMENSIONS = 1536

    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = "https://openrouter.ai/api/v1"

    async def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for a single text.

        Args:
            text: Text to embed (max 8191 tokens)

        Returns:
            1536-dimensional embedding vector
        """

        # Truncate if too long
        if len(text) > 30000:  # ~8K tokens
            text = text[:30000]

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.EMBEDDING_MODEL,
            "input": text
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/embeddings",
                headers=headers,
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()

        return data["data"][0]["embedding"]

    async def generate_embeddings_batch(
        self,
        texts: List[str]
    ) -> List[List[float]]:
        """
        Generate embeddings for multiple texts (batch).

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors
        """

        # OpenRouter supports batch embeddings
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        # Truncate texts
        texts = [
            text[:30000] if len(text) > 30000 else text
            for text in texts
        ]

        payload = {
            "model": self.EMBEDDING_MODEL,
            "input": texts
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/embeddings",
                headers=headers,
                json=payload,
                timeout=60.0
            )
            response.raise_for_status()
            data = response.json()

        return [item["embedding"] for item in data["data"]]
```

### 3.4 Document Chunking Strategy

```python
# /backend/app/services/ai/chunking_service.py

from typing import List, Dict
import re

class ChunkingService:
    """
    Chunk documents for embedding generation.

    Strategy: Semantic chunking with overlap to preserve context.
    """

    CHUNK_SIZE = 512  # tokens (approx 2048 characters)
    CHUNK_OVERLAP = 50  # tokens (approx 200 characters)

    def chunk_document(
        self,
        text: str,
        metadata: Dict
    ) -> List[Dict]:
        """
        Chunk document into overlapping segments.

        Args:
            text: Document text
            metadata: Document metadata (platform, complexity, etc.)

        Returns:
            List of chunks with metadata
        """

        # Approximate tokens (1 token ≈ 4 characters)
        chunk_size_chars = self.CHUNK_SIZE * 4
        overlap_chars = self.CHUNK_OVERLAP * 4

        # Split by paragraphs first
        paragraphs = re.split(r'\n\n+', text)

        chunks = []
        current_chunk = ""
        chunk_index = 0

        for para in paragraphs:
            # If adding paragraph exceeds chunk size, save current chunk
            if len(current_chunk) + len(para) > chunk_size_chars and current_chunk:
                chunks.append({
                    "text": current_chunk.strip(),
                    "index": chunk_index,
                    "metadata": metadata
                })
                chunk_index += 1

                # Start new chunk with overlap
                overlap_text = current_chunk[-overlap_chars:] if len(current_chunk) > overlap_chars else ""
                current_chunk = overlap_text + "\n\n" + para
            else:
                current_chunk += "\n\n" + para if current_chunk else para

        # Add final chunk
        if current_chunk:
            chunks.append({
                "text": current_chunk.strip(),
                "index": chunk_index,
                "metadata": metadata
            })

        return chunks
```

### 3.5 RAG Search Service

```python
# /backend/app/services/ai/rag_service.py

from typing import List, Dict, Optional
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.knowledge_embeddings import KnowledgeEmbedding
from app.services.ai.embedding_service import EmbeddingService

class RAGService:
    """
    Retrieval-Augmented Generation service for quote generation.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.embedding_service = EmbeddingService()

    async def search_similar_quotes(
        self,
        query: str,
        platform: Optional[str] = None,
        top_k: int = 5
    ) -> List[Dict]:
        """
        Search for similar historical quotes using vector similarity.

        Args:
            query: User requirements text
            platform: Filter by platform (optional)
            top_k: Number of results to return

        Returns:
            List of similar quote chunks with metadata
        """

        # Generate query embedding
        query_embedding = await self.embedding_service.generate_embedding(query)

        # Build SQL query with optional platform filter
        filter_clause = ""
        params = {"embedding": query_embedding, "limit": top_k}

        if platform:
            filter_clause = "AND metadata->>'platform' = :platform"
            params["platform"] = platform

        # Vector similarity search using pgvector
        sql = text(f"""
            SELECT
                id,
                source_id,
                chunk_text,
                chunk_index,
                metadata,
                1 - (embedding <=> :embedding) AS similarity
            FROM knowledge_embeddings
            WHERE source_type = 'quote'
            {filter_clause}
            ORDER BY embedding <=> :embedding
            LIMIT :limit
        """)

        result = await self.db.execute(sql, params)
        rows = result.fetchall()

        return [
            {
                "id": str(row.id),
                "source_id": str(row.source_id),
                "text": row.chunk_text,
                "chunk_index": row.chunk_index,
                "metadata": row.metadata,
                "similarity": row.similarity
            }
            for row in rows
        ]

    async def build_rag_context(
        self,
        query: str,
        platform: Optional[str] = None,
        max_context_length: int = 8000
    ) -> str:
        """
        Build RAG context string from similar quotes.

        Args:
            query: User requirements
            platform: Platform filter
            max_context_length: Max characters for context

        Returns:
            Formatted context string for LLM prompt
        """

        # Search similar quotes
        similar_quotes = await self.search_similar_quotes(
            query=query,
            platform=platform,
            top_k=10  # Get more, then truncate to fit max_context_length
        )

        if not similar_quotes:
            return "No similar historical quotes found."

        # Build context
        context_parts = [
            "## Similar Historical Quotes\n",
            "Use these examples to inform your estimate:\n\n"
        ]

        current_length = len(context_parts[0]) + len(context_parts[1])

        for i, quote in enumerate(similar_quotes, 1):
            quote_text = f"### Example {i} (Similarity: {quote['similarity']:.2%})\n"
            quote_text += f"Platform: {quote['metadata'].get('platform', 'unknown')}\n"
            quote_text += f"Complexity: {quote['metadata'].get('complexity', 'unknown')}\n"
            quote_text += f"Content:\n{quote['text']}\n\n"

            if current_length + len(quote_text) > max_context_length:
                break

            context_parts.append(quote_text)
            current_length += len(quote_text)

        return "".join(context_parts)
```

---

## 4. Knowledge Base Auto-Learning

### 4.1 Auto-Update Trigger

When a PM approves a quote, automatically update the knowledge base:

```python
# /backend/app/services/ai/knowledge_update_service.py

from typing import Dict
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.ai.embedding_service import EmbeddingService
from app.services.ai.chunking_service import ChunkingService
from app.models.quotes import Quote
from app.models.knowledge_embeddings import KnowledgeEmbedding

class KnowledgeUpdateService:
    """
    Automatically update knowledge base when quotes are approved.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.embedding_service = EmbeddingService()
        self.chunking_service = ChunkingService()

    async def ingest_approved_quote(self, quote_id: str) -> int:
        """
        Ingest approved quote into knowledge base.

        Args:
            quote_id: UUID of approved quote

        Returns:
            Number of embeddings created
        """

        # Get quote
        result = await self.db.execute(
            select(Quote).where(Quote.id == quote_id)
        )
        quote = result.scalar_one_or_none()

        if not quote or quote.status != "approved":
            raise ValueError("Quote not found or not approved")

        # Extract metadata
        metadata = {
            "platform": quote.platform,
            "complexity": quote.complexity,
            "total_hours": float(quote.total_hours),
            "total_cost": float(quote.total_cost),
            "quote_id": str(quote.id)
        }

        # Chunk the quote content
        chunks = self.chunking_service.chunk_document(
            text=quote.content,
            metadata=metadata
        )

        # Generate embeddings for all chunks (batch)
        chunk_texts = [chunk["text"] for chunk in chunks]
        embeddings = await self.embedding_service.generate_embeddings_batch(
            chunk_texts
        )

        # Store in database
        embedding_records = []
        for chunk, embedding in zip(chunks, embeddings):
            record = KnowledgeEmbedding(
                source_type="quote",
                source_id=quote.id,
                chunk_text=chunk["text"],
                chunk_index=chunk["index"],
                embedding=embedding,
                metadata=chunk["metadata"]
            )
            embedding_records.append(record)

        self.db.add_all(embedding_records)
        await self.db.commit()

        return len(embedding_records)
```

### 4.2 API Endpoint for Quote Approval

```python
# /backend/app/api/v1/quotes.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db, get_current_user
from app.services.ai.knowledge_update_service import KnowledgeUpdateService
from app.models.quotes import Quote
from app.schemas.user import User

router = APIRouter(prefix="/quotes", tags=["quotes"])

@router.post("/{quote_id}/approve")
async def approve_quote(
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Approve a quote and add it to knowledge base.

    This endpoint:
    1. Marks quote as approved
    2. Chunks the quote content
    3. Generates embeddings
    4. Stores in knowledge base for future RAG
    """

    # Get quote
    result = await db.execute(
        select(Quote).where(Quote.id == quote_id)
    )
    quote = result.scalar_one_or_none()

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Update status
    quote.status = "approved"
    quote.approved_by = current_user.id
    quote.approved_at = datetime.utcnow()

    await db.commit()

    # Ingest into knowledge base (async background task)
    knowledge_service = KnowledgeUpdateService(db)
    embeddings_created = await knowledge_service.ingest_approved_quote(quote_id)

    return {
        "success": True,
        "data": {
            "quote_id": quote_id,
            "status": "approved",
            "knowledge_base_updated": True,
            "embeddings_created": embeddings_created
        }
    }
```

---

## 5. Implementation Roadmap

### Phase 1: Database Setup (Week 1)

```bash
# Create migration
alembic revision -m "Add pgvector and knowledge base tables"
```

```sql
-- Migration file
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Create tables (see section 3.2)
```

### Phase 2: Ingestion Pipeline (Week 2)

**Tasks**:
- [ ] Implement EmbeddingService
- [ ] Implement ChunkingService
- [ ] Create ingestion script for existing documents
- [ ] Test with 3 existing sample quotes

**Script**:
```python
# scripts/ingest_knowledge_base.py

import asyncio
from pathlib import Path
from app.services.ai.knowledge_update_service import KnowledgeUpdateService

async def ingest_all_documents():
    """Ingest all documents from knowledge-based folder."""

    kb_path = Path("knowledge-based/formatting")

    for doc_path in kb_path.glob("*.docx"):
        print(f"Processing {doc_path.name}...")
        # Parse DOCX
        # Create Quote record
        # Ingest embeddings
        pass

if __name__ == "__main__":
    asyncio.run(ingest_all_documents())
```

### Phase 3: RAG Search (Week 3)

**Tasks**:
- [ ] Implement RAGService
- [ ] Create search endpoint: `POST /api/v1/knowledge/search`
- [ ] Test vector similarity search
- [ ] Integrate with quote generation flow

### Phase 4: Auto-Learning (Week 4)

**Tasks**:
- [ ] Implement KnowledgeUpdateService
- [ ] Add approve quote endpoint
- [ ] Test auto-ingestion on approval
- [ ] Monitor embedding quality

### Phase 5: User Data Collection (Week 5-6)

**User Action Required**:
- [ ] Collect 30-50 historical quotes
- [ ] Clean and anonymize client data
- [ ] Upload to `/knowledge-based/formatting/`
- [ ] Run ingestion script
- [ ] Validate search quality

---

## 6. Training Data Requirements

### 6.1 Minimum Requirements

| Metric | Minimum | Recommended | Optimal |
|--------|---------|-------------|---------|
| Total Quotes | 10 | 30-50 | 100+ |
| Platforms | 1 | 3 | 3 |
| Complexity Levels | 2 | 3 | 3 |
| Total Hours Range | N/A | 10-500 | 5-1000 |

### 6.2 Quote Quality Checklist

Each quote should contain:

- [ ] Project title and description
- [ ] Detailed requirements
- [ ] Task breakdown with hours
- [ ] Platform (WordPress/Shopify/WooCommerce)
- [ ] Total hours and cost
- [ ] Assumptions and exclusions
- [ ] Date created

### 6.3 Data Preparation Guide

**For User**:

1. Gather historical quotes from past 2 years
2. Remove confidential client information:
   - Client names → "Client A", "Client B"
   - Contact info → Remove
   - Pricing agreements → Anonymize
3. Save as DOCX or PDF
4. Name files descriptively:
   - `Quote_WordPress_Ecommerce_150hrs.docx`
   - `Proposal_Shopify_CustomTheme_80hrs.pdf`
5. Place in `/knowledge-based/formatting/`
6. Run ingestion script (will be provided)

### 6.4 Expected Improvement Timeline

```
Week 0: No RAG (Cold Start)
  - Quote generation based on prompts only
  - Estimates may be generic

Week 2: 3 samples ingested
  - Limited improvement
  - Can retrieve 1-2 relevant examples

Week 4: 10 samples ingested
  - Noticeable improvement
  - Better pattern recognition

Week 6: 30 samples ingested
  - Significant improvement
  - Consistent estimates across project types

Month 3: 50+ samples + ongoing approvals
  - High quality estimates
  - Learning from PM corrections
  - Continuous improvement
```

---

## 7. Cost Estimation

### 7.1 Embedding Costs

**OpenAI text-embedding-3-small pricing**:
- $0.00002 per 1K tokens

**Cost Calculation**:
```
50 quotes × 5,000 tokens avg = 250,000 tokens
250K × $0.00002/1K = $5.00 total

Per-quote cost: $0.10
Monthly ongoing (50 new quotes): $5.00/month
```

### 7.2 Storage Costs

**PostgreSQL storage**:
```
1 embedding = 1536 dimensions × 4 bytes = 6KB
50 quotes × 10 chunks avg = 500 embeddings
500 × 6KB = 3MB

Storage cost: Negligible (<$0.01/month)
```

---

## 8. Monitoring and Quality Metrics

### 8.1 Key Metrics

```python
# Track RAG performance
metrics = {
    "rag.search.latency": Histogram(),
    "rag.search.results_count": Histogram(),
    "rag.embeddings.total": Counter(),
    "rag.embeddings.by_platform": Counter(labels=["platform"]),
    "rag.ingestion.success": Counter(),
    "rag.ingestion.failure": Counter(labels=["error_type"])
}
```

### 8.2 Quality Checks

```python
# Test RAG quality periodically
async def test_rag_quality():
    """Test RAG retrieval quality with known queries."""

    test_cases = [
        {
            "query": "WordPress site with WooCommerce and custom payment gateway",
            "expected_platform": "wordpress",
            "min_similarity": 0.7
        },
        # ... more test cases
    ]

    for test in test_cases:
        results = await rag_service.search_similar_quotes(
            query=test["query"],
            platform=test["expected_platform"]
        )

        assert len(results) > 0, "No results returned"
        assert results[0]["similarity"] >= test["min_similarity"], \
            f"Low similarity: {results[0]['similarity']}"
```

---

## Appendix: Sample RAG Context Output

```
## Similar Historical Quotes
Use these examples to inform your estimate:

### Example 1 (Similarity: 87.5%)
Platform: wordpress
Complexity: medium
Content:
Project: E-commerce website with WooCommerce
- WordPress setup and configuration: 8 hours
- WooCommerce installation and setup: 10 hours
- Custom payment gateway integration: 24 hours
- Product catalog setup (100 products): 16 hours
- Theme customization: 20 hours
Total: 78 hours

### Example 2 (Similarity: 82.3%)
Platform: wordpress
Complexity: medium
Content:
Project: Online store with subscription products
- WordPress + WooCommerce setup: 12 hours
- WooCommerce Subscriptions plugin: 16 hours
- Custom product variations: 14 hours
- Payment processing setup: 8 hours
Total: 50 hours

[... more examples ...]
```

This RAG context is then prepended to the LLM prompt for quote generation.
