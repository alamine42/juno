# Juno Knowledge Base Architecture

## Overview

Coaches can share files, notes, and structured data with Juno. This "knowledge base" serves as Juno's reference library for content generation, client management, and business operations.

**Key distinction:**
- **Memory:** What Juno learns/infers from interactions
- **Knowledge Base:** Explicit documents the coach uploads for reference

---

## Content Types

### 1. Quick Notes
Short text snippets the coach wants Juno to remember.

**Examples:**
- "My signature sign-off is 'Keep pushing forward!'"
- "Never mention competitor XYZ"
- "My client John prefers morning sessions"

**Storage:** Direct text in database, embedded for retrieval.

### 2. Documents
Longer-form reference materials.

**Types:**
- Brand guidelines (PDF, Google Docs)
- Content calendars (spreadsheets)
- Program descriptions
- Bio / About Me copy
- Terms of service / legal disclaimers

**Storage:** File in Supabase Storage, text extracted and chunked for RAG.

### 3. Media Assets
Visual content for use in posts.

**Types:**
- Logos (PNG, SVG)
- Professional photos
- Client transformation photos (with permission)
- Video clips for Reels
- Testimonial screenshots

**Storage:** File in Supabase Storage, metadata + AI description in database.

### 4. Structured Data
Queryable business information.

**Types:**
- Client list (name, goals, history, preferences)
- Program catalog (name, description, price, duration)
- Pricing sheet
- FAQ database
- Testimonials

**Storage:** Normalized database tables, text fields embedded for search.

---

## Data Model

```sql
-- Knowledge base items (files, notes, docs)
CREATE TABLE knowledge_items (
  id UUID PRIMARY KEY,
  coach_id UUID REFERENCES coaches(id),

  -- Classification
  type VARCHAR(50), -- 'note', 'document', 'media', 'structured'
  category VARCHAR(100), -- 'brand', 'client', 'program', 'content', 'legal'

  -- Content
  title VARCHAR(255),
  description TEXT,
  content TEXT, -- For notes, extracted text for docs

  -- File storage (if applicable)
  file_path VARCHAR(500), -- Supabase Storage path
  file_type VARCHAR(50), -- 'pdf', 'png', 'mp4', etc.
  file_size INTEGER,

  -- AI processing
  extracted_text TEXT, -- OCR / PDF extraction
  ai_description TEXT, -- Vision model description for images
  embedding vector(1536),

  -- Metadata
  tags TEXT[], -- ['brand', 'logo', 'primary']
  pinned BOOLEAN DEFAULT false, -- Always include in context

  -- Content consent controls
  usable_in_content BOOLEAN DEFAULT true, -- Can this item be used in generated content?
  contains_client_pii BOOLEAN DEFAULT false, -- Does this contain client names/photos?
  requires_explicit_approval BOOLEAN DEFAULT false, -- Must coach approve each use?

  -- Access control
  visibility VARCHAR(20) DEFAULT 'private', -- 'private', 'shared' (future: team)

  -- Timestamps
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  last_accessed_at TIMESTAMP
);

-- Structured client data
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  coach_id UUID REFERENCES coaches(id),

  -- Basic info
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),

  -- Coaching context
  goals TEXT,
  challenges TEXT,
  preferences JSONB, -- {communication: 'text', session_time: 'morning'}
  notes TEXT,

  -- History
  start_date DATE,
  status VARCHAR(50), -- 'active', 'paused', 'completed'

  -- For RAG
  searchable_text TEXT GENERATED ALWAYS AS (
    name || ' ' || COALESCE(goals, '') || ' ' || COALESCE(notes, '')
  ) STORED,
  embedding vector(1536),

  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Program catalog
CREATE TABLE programs (
  id UUID PRIMARY KEY,
  coach_id UUID REFERENCES coaches(id),

  name VARCHAR(255),
  description TEXT,
  duration VARCHAR(100), -- '8 weeks', '3 months'
  price DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',

  -- Details
  includes TEXT[], -- ['weekly check-ins', 'meal plans', 'workout videos']
  ideal_for TEXT, -- Target audience description
  testimonials TEXT[],

  -- For RAG
  embedding vector(1536),

  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Testimonials (standalone for easy reference)
CREATE TABLE testimonials (
  id UUID PRIMARY KEY,
  coach_id UUID REFERENCES coaches(id),
  client_id UUID REFERENCES clients(id), -- Optional link

  client_name VARCHAR(255), -- May differ from client record (privacy)
  content TEXT,
  result TEXT, -- "Lost 20 lbs in 8 weeks"
  program_id UUID REFERENCES programs(id),

  -- Media
  image_path VARCHAR(500), -- Before/after, screenshot
  video_path VARCHAR(500),

  -- Permissions
  approved_for_posting BOOLEAN DEFAULT false,

  -- For RAG
  embedding vector(1536),

  created_at TIMESTAMP
);
```

---

## Upload Flows

### Via WhatsApp/Web Chat

**Image upload:**
```
Coach: [sends image]
Juno: Got it! What is this image?
      [Logo] [Client photo] [Product] [Other]
Coach: [Logo]
Juno: Saved as your logo. I'll use it when creating branded content.
      Want to add any notes? (e.g., "use on dark backgrounds")
Coach: Primary logo, use on light backgrounds
Juno: ✓ Saved: Primary logo (use on light backgrounds)
```

**Document upload:**
```
Coach: [sends PDF]
Juno: I see a PDF: "Brand_Guidelines_2024.pdf"
      What type of document is this?
      [Brand Guide] [Program Info] [Legal] [Other]
Coach: [Brand Guide]
Juno: Processing your brand guide...
      ✓ Extracted 12 pages of guidelines. I'll reference these when creating content.
      Key things I noticed:
      - Primary colors: #2563EB, #10B981
      - Tone: Professional but approachable
      - Avoid: Medical claims, competitor mentions

      Does this look right?
```

**Quick note:**
```
Coach: Remember that my client Sarah prefers evening check-ins
Juno: ✓ Noted: Sarah prefers evening check-ins.
      I'll keep this in mind when scheduling or creating content about client interactions.
```

### Via Web Portal

**File Manager Interface:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Knowledge Base                                    [+ Upload]    │
├─────────────────────────────────────────────────────────────────┤
│ 📁 Brand Assets                                                 │
│   ├── 📄 Brand_Guidelines_2024.pdf          Pinned ⭐           │
│   ├── 🖼️ Logo_Primary.png                                      │
│   └── 🖼️ Logo_Dark.png                                         │
│                                                                 │
│ 📁 Programs                                                     │
│   ├── 📄 8-Week Transformation                                  │
│   └── 📄 Monthly Coaching                                       │
│                                                                 │
│ 📁 Clients (12)                                                 │
│   ├── 👤 Sarah M. - Active                                      │
│   └── 👤 John D. - Active                                       │
│                                                                 │
│ 📝 Quick Notes (5)                                              │
│   └── "Always end posts with 'Keep pushing forward!'"          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Auto-Context Retrieval

When Juno generates content or responds to a request, it automatically pulls relevant knowledge base items.

### Retrieval Pipeline

```
1. Task Analysis
   └── Extract intent, entities, topics from coach request
   └── Determine task type: content_generation, internal_reference, coach_response

2. Query Knowledge Base
   ├── Pinned items (always included)
   ├── Semantic search (embed task, find similar items)
   ├── Entity matching (client names, program names)
   └── Category matching (brand → brand assets)

3. Consent Filter (CRITICAL for content generation)
   ├── If task is content_generation:
   │   ├── Exclude items where usable_in_content = false
   │   ├── Exclude items where contains_client_pii = true (unless explicitly requested)
   │   ├── Flag items where requires_explicit_approval = true → ask coach before using
   │   └── Cross-check with moderation tier (Yellow/Red items get extra scrutiny)
   └── If task is internal_reference or coach_response:
       └── Include all relevant items (coach is the audience, not public)

4. Rank & Filter
   ├── Relevance score (embedding similarity)
   ├── Recency boost (recently accessed items)
   ├── Type priority (brand guide > random note)
   └── Context budget (max ~1000 tokens for KB)

5. Include in Prompt
   └── Format items as structured context for LLM
   └── Mark any items that need coach confirmation before public use
```

**Consent-Aware Retrieval Examples:**

| Task Type | Item | usable_in_content | Action |
|-----------|------|-------------------|--------|
| "Create post about Sarah's progress" | clients.sarah | false (default for clients) | Exclude from content, ask coach for approval |
| "Create post about 8-week program" | programs.8_week | true | Include in content |
| "Create post using this testimonial" | testimonials.john | true + approved_for_posting | Include only if both flags true |
| "Tell me about Sarah's goals" (internal) | clients.sarah | false | Include (coach is audience) |

### Retrieval Examples

**Task:** "Create a post about my 8-week program"
```
Retrieved:
- programs.8_week_transformation (description, price, includes)
- testimonials.recent_transformation (2 relevant)
- knowledge_items.brand_guide (tone, colors - pinned)
```

**Task:** "Follow up with Sarah about her progress"
```
Retrieved:
- clients.sarah (goals, preferences, notes)
- knowledge_items.note ("Sarah prefers evening check-ins")
- clients.sarah.recent_sessions (from calendar)
```

**Task:** "Write a caption for this client photo"
```
Retrieved:
- knowledge_items.brand_guide (tone, disclaimers)
- knowledge_items.transformation_guidelines (how to post before/afters)
- testimonials.approved (for inspiration)
```

### Context Formatting

```typescript
interface KnowledgeContext {
  // Always included
  pinned: KnowledgeItem[];

  // Task-relevant
  relevant: {
    item: KnowledgeItem;
    relevance_score: number;
    reason: string; // "Matched 'program' entity"
  }[];

  // Structured data
  clients?: Client[];
  programs?: Program[];
  testimonials?: Testimonial[];
}

function formatForPrompt(context: KnowledgeContext): string {
  return `
## Reference Materials

### Brand Guidelines (Always Apply)
${context.pinned.find(p => p.category === 'brand')?.content}

### Relevant Context
${context.relevant.map(r => `
**${r.item.title}** (${r.reason})
${r.item.content}
`).join('\n')}

### Data
${context.clients ? `Clients mentioned: ${formatClients(context.clients)}` : ''}
${context.programs ? `Programs: ${formatPrograms(context.programs)}` : ''}
  `;
}
```

---

## File Processing Pipeline

### Images
```
Upload → Store in Supabase Storage
       → Generate AI description (Claude Vision)
       → Extract EXIF metadata
       → Create embedding from description
       → Store metadata in knowledge_items
```

### PDFs
```
Upload → Store in Supabase Storage
       → Extract text (pdf-parse or Supabase Edge Function)
       → Chunk into ~500 token segments
       → Generate embedding per chunk
       → Store with chunk references
```

### Text Notes
```
Input → Store directly in content field
      → Generate embedding
      → Extract entities (client names, etc.)
      → Auto-categorize if possible
```

### Structured Data (Clients, Programs)
```
Input → Validate schema
      → Store in normalized tables
      → Generate searchable_text
      → Generate embedding
```

---

## Sync & Freshness

### Pinned Items
- Brand guide, core values, key rules
- Always included in context (no retrieval needed)
- Coach can pin/unpin via web portal
- Maximum 5 pinned items (context budget)

### Access Tracking
- Track `last_accessed_at` when item is retrieved
- Surface "stale" items: "You haven't referenced your pricing sheet in 3 months. Still accurate?"
- Suggest archiving unused items

### Version History
- Documents can be re-uploaded (new version)
- Keep previous versions for 30 days
- Show diff on re-upload: "Your brand guide has changed. Key updates: [list]"

---

## Privacy & Security

### Content Consent Model

Every knowledge base item has consent flags that control how it can be used:

| Flag | Default | Purpose |
|------|---------|---------|
| `usable_in_content` | true (false for clients) | Can be included in generated posts |
| `contains_client_pii` | auto-detected | Contains client names, photos, or personal info |
| `requires_explicit_approval` | false | Coach must approve each use in content |

**Default Consent by Type:**
| Item Type | usable_in_content | contains_client_pii | requires_explicit_approval |
|-----------|-------------------|---------------------|---------------------------|
| Brand assets | true | false | false |
| Programs | true | false | false |
| Quick notes | true | auto-detect | false |
| Client records | **false** | **true** | **true** |
| Testimonials | true | true | **true** (unless approved_for_posting) |
| Transformation photos | true | **true** | **true** |

**Consent Override Flow:**
When coach explicitly mentions a client in a content request:
1. Surface warning: "This will include Sarah's name in a public post. Confirm?"
2. If confirmed, temporarily allow for this specific request
3. Log the explicit approval for audit trail
4. Do NOT change default consent flags

### Client Data
- Client information is sensitive (PII)
- `usable_in_content` defaults to false for all client records
- `contains_client_pii` auto-detected via entity extraction
- Client names in content → flag for review, require explicit approval
- Anonymize in analytics/logs

### Media Assets
- Transformation photos: `requires_explicit_approval = true` by default
- Track consent per image via `approved_for_posting` flag
- Before/after posts → always require approval (Yellow tier in moderation)

### File Storage
- Supabase Storage with RLS (Row Level Security)
- Files only accessible by coach_id owner
- Signed URLs for temporary access (expire in 1 hour)
- Encryption at rest

---

## Implementation Plan

### Week 4 (with Memory)
- [ ] knowledge_items table + basic CRUD
- [ ] Note upload via chat (text only)
- [ ] Web portal file manager (basic)

### Week 5-6
- [ ] Image upload + AI description
- [ ] PDF upload + text extraction
- [ ] clients/programs/testimonials tables
- [ ] Auto-context retrieval in content generation

### Week 7
- [ ] Structured data entry UI (clients, programs)
- [ ] Pinning + access tracking
- [ ] Retrieval optimization

### Post-MVP
- [ ] Google Drive / Dropbox sync
- [ ] Canva integration (pull brand assets)
- [ ] Version history
- [ ] Team sharing (when workspaces added)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| KB items per coach | 10+ | Average after 30 days |
| Retrieval relevance | >80% useful | Sample + coach feedback |
| Content accuracy | <5% factual errors | Audit of generated content |
| Usage frequency | 50%+ of requests use KB | Track retrieval per request |
