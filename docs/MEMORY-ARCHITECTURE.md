# Juno Memory Architecture

## Overview

Juno requires sophisticated memory to:
1. Maintain context across conversations and time
2. Learn and retain each coach's brand voice
3. Remember preferences, corrections, and feedback
4. Prevent drift from the coach's authentic style

## Memory Types

### 1. Episodic Memory (What Happened)
Events, conversations, and interactions over time.

**Stored in:** PostgreSQL (structured) + Vector DB (embeddings)

**Examples:**
- "Coach asked for workout content on March 10"
- "Coach edited caption to remove emoji on March 12"
- "Coach said 'never mention competitors' on March 15"

### 2. Semantic Memory (Facts & Knowledge)
Stable facts about the coach and their business.

**Stored in:** PostgreSQL (JSON) + Vector DB (for retrieval)

**Examples:**
- Brand voice characteristics (tone, vocabulary, style)
- Business facts (niche, target audience, offers)
- Content rules ("always end with CTA", "never use 🔥 emoji")

### 3. Procedural Memory (How To Do Things)
Learned patterns and strategies that work for this coach.

**Stored in:** PostgreSQL (structured metrics) + derived insights

**Examples:**
- "Reels perform 3x better than static posts"
- "Tuesday 7pm is optimal posting time"
- "Client transformation posts get highest engagement"

---

## Technical Architecture

### Storage Layer

```
┌─────────────────────────────────────────────────────────────┐
│                      Memory System                          │
├─────────────────────┬─────────────────────┬────────────────┤
│   PostgreSQL        │    Vector DB        │    Redis       │
│   (Structured)      │    (Semantic)       │    (Cache)     │
├─────────────────────┼─────────────────────┼────────────────┤
│ • Conversations     │ • Content embeddings│ • Recent ctx   │
│ • Actions/Events    │ • Voice samples     │ • Session state│
│ • Preferences       │ • Feedback corpus   │ • Hot memories │
│ • Brand voice JSON  │ • Conversation ctx  │                │
│ • Content history   │                     │                │
└─────────────────────┴─────────────────────┴────────────────┘
```

### Vector DB Choice

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Pinecone** | Managed, fast, reliable | Cost at scale | Good for MVP |
| **Qdrant** | Self-hosted option, good performance | More ops | Good alternative |
| **Supabase pgvector** | Already using Postgres | Less optimized for vectors | Start here |
| **Chroma** | Simple, good for prototyping | Not production-ready | Dev only |

**Decision:** Start with **Supabase pgvector** (minimize new infrastructure), migrate to Pinecone if performance requires.

---

## Memory Operations

### 1. Encoding (Storing New Memories)

When events happen, encode them into memory:

```typescript
interface MemoryEncoder {
  // Immediate encoding
  encodeConversation(turn: ConversationTurn): Promise<void>;
  encodeAction(action: Action): Promise<void>;
  encodeFeedback(feedback: CoachFeedback): Promise<void>;

  // Derived encoding (batch)
  extractPreferences(conversations: Conversation[]): Promise<Preference[]>;
  updateVoiceModel(approvedContent: Content[]): Promise<VoiceModel>;
}
```

**Encoding Pipeline:**
1. Event occurs (conversation, action, feedback)
2. Store raw event in PostgreSQL
3. Generate embedding via OpenAI `text-embedding-3-small`
4. Store embedding in vector DB with metadata
5. Update derived insights (async, batched)

### 2. Retrieval (Fetching Relevant Memories)

When generating content or responding, retrieve relevant context:

```typescript
interface MemoryRetriever {
  // Semantic search
  findSimilarContent(query: string, limit: number): Promise<Content[]>;
  findRelevantConversations(context: string, limit: number): Promise<ConversationTurn[]>;
  findRelatedFeedback(content: string): Promise<Feedback[]>;

  // Structured lookup
  getPreferences(coachId: string): Promise<Preference[]>;
  getVoiceModel(coachId: string): Promise<VoiceModel>;
  getRecentContext(coachId: string, hours: number): Promise<Context>;
}
```

**Retrieval Strategy:**
1. **Always include:** Brand voice model, active preferences, recent context (last 24h)
2. **Semantic retrieval:** Query vector DB for relevant past content/conversations
3. **Recency weighting:** More recent memories weighted higher
4. **Relevance filtering:** Only include memories above similarity threshold

### 3. Consolidation (Compressing Old Memories)

Periodically summarize and compress old memories to manage context size:

```typescript
interface MemoryConsolidator {
  // Daily consolidation
  summarizeDay(coachId: string, date: Date): Promise<DaySummary>;

  // Weekly consolidation
  consolidateWeek(coachId: string, week: Date): Promise<WeekSummary>;

  // Monthly consolidation
  extractPatterns(coachId: string, month: Date): Promise<Pattern[]>;
  updateLongTermMemory(coachId: string): Promise<void>;
}
```

**Consolidation Schedule (Inngest crons):**
- **Daily (2am):** Summarize yesterday's conversations into key points
- **Weekly (Sunday 3am):** Consolidate daily summaries, extract patterns
- **Monthly (1st, 4am):** Update long-term voice model, archive old embeddings

### 4. Forgetting (Pruning Irrelevant Memories)

Not all memories are worth keeping:

```typescript
interface MemoryPruner {
  // Remove outdated preferences
  pruneSupersededPreferences(coachId: string): Promise<void>;

  // Archive old embeddings
  archiveOldEmbeddings(coachId: string, olderThan: Date): Promise<void>;

  // Clear contradicted information
  resolveContradictions(coachId: string): Promise<void>;
}
```

**Forgetting Rules:**
- Preferences explicitly overridden → archive old version
- Embeddings > 6 months old → archive (keep summaries)
- Contradictory information → flag for resolution, prefer recent

---

## Data Models

### Memory Tables (PostgreSQL)

```sql
-- Core memory store
CREATE TABLE memories (
  id UUID PRIMARY KEY,
  coach_id UUID REFERENCES coaches(id),
  type VARCHAR(50), -- 'episodic', 'semantic', 'procedural'
  category VARCHAR(100), -- 'conversation', 'feedback', 'preference', etc.
  content TEXT,
  metadata JSONB,
  importance FLOAT DEFAULT 0.5, -- 0-1, affects retrieval priority
  created_at TIMESTAMP,
  expires_at TIMESTAMP, -- NULL = never expires
  consolidated_into UUID REFERENCES memories(id), -- if summarized
  embedding vector(1536) -- pgvector
);

-- Preferences (structured semantic memory)
CREATE TABLE preferences (
  id UUID PRIMARY KEY,
  coach_id UUID REFERENCES coaches(id),
  category VARCHAR(100), -- 'content', 'scheduling', 'communication'
  key VARCHAR(255),
  value JSONB,
  source VARCHAR(50), -- 'explicit', 'inferred', 'default'
  confidence FLOAT, -- how sure we are this is correct
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  superseded_by UUID REFERENCES preferences(id)
);

-- Voice model (structured semantic memory)
CREATE TABLE voice_models (
  id UUID PRIMARY KEY,
  coach_id UUID REFERENCES coaches(id),
  version INT,
  tone JSONB, -- {formality: 0.7, enthusiasm: 0.8, humor: 0.3}
  vocabulary JSONB, -- {preferred: [...], avoided: [...]}
  patterns JSONB, -- {sentence_length: 'medium', emoji_usage: 'minimal'}
  sample_embeddings vector(1536)[], -- embeddings of best content
  created_at TIMESTAMP,
  active BOOLEAN DEFAULT true
);

-- Feedback tracking
CREATE TABLE feedback (
  id UUID PRIMARY KEY,
  coach_id UUID REFERENCES coaches(id),
  content_id UUID REFERENCES content(id),
  feedback_type VARCHAR(50), -- 'edit', 'approval', 'rejection', 'comment'
  original_text TEXT,
  modified_text TEXT,
  edit_embedding vector(1536), -- embedding of the diff/change
  lesson_extracted TEXT, -- AI-extracted lesson from this feedback
  created_at TIMESTAMP
);

-- Consolidated summaries
CREATE TABLE memory_summaries (
  id UUID PRIMARY KEY,
  coach_id UUID REFERENCES coaches(id),
  period_type VARCHAR(20), -- 'day', 'week', 'month'
  period_start DATE,
  period_end DATE,
  summary TEXT,
  key_events JSONB,
  patterns_observed JSONB,
  embedding vector(1536),
  created_at TIMESTAMP
);
```

---

## Drift Prevention

### 1. Voice Anchoring

**Problem:** Generated content slowly diverges from coach's authentic voice.

**Solution:** Always anchor to original voice samples.

```typescript
interface VoiceAnchor {
  // Get anchor samples for content generation
  getAnchorSamples(coachId: string): Promise<{
    originalSamples: Content[];      // First approved content
    recentApproved: Content[];       // Last 10 approved without edits
    highPerforming: Content[];       // Top engagement content
  }>;

  // Check if new content matches voice
  checkVoiceAlignment(
    coachId: string,
    newContent: string
  ): Promise<{
    aligned: boolean;
    similarity: number;
    suggestions: string[];
  }>;
}
```

**Implementation:**
1. Store embeddings of first 10 approved content pieces as "anchor"
2. Before posting, compare new content embedding to anchor
3. If similarity < 0.7, flag for review or auto-adjust
4. Periodically (monthly) ask coach to review sample, re-anchor if needed

### 2. Feedback Loop Integration

**Problem:** Juno doesn't learn from corrections.

**Solution:** Track all edits, extract lessons, weight recent feedback higher.

```typescript
interface FeedbackLearner {
  // When coach edits content
  learnFromEdit(
    original: string,
    edited: string
  ): Promise<{
    lesson: string;           // "Coach prefers 'workout' over 'training'"
    category: string;         // 'vocabulary', 'tone', 'structure'
    confidence: number;
  }>;

  // Apply learned lessons
  applyLessons(
    coachId: string,
    draftContent: string
  ): Promise<string>;
}
```

**Edit Analysis Pipeline:**
1. Diff original vs. edited content
2. Use LLM to extract lesson: "What did the coach change and why?"
3. Store lesson with embedding in feedback table
4. Before generating new content, retrieve relevant lessons
5. Include lessons in prompt: "Based on past feedback, this coach prefers..."

### 3. Quality Monitoring

**Problem:** Content quality degrades over time without detection.

**Solution:** Track quality metrics, detect downward trends.

```typescript
interface QualityMonitor {
  // Track quality signals
  trackEngagement(content: Content, metrics: EngagementMetrics): Promise<void>;
  trackApprovalRate(coachId: string): Promise<number>;
  trackEditRate(coachId: string): Promise<number>;

  // Detect drift
  detectQualityDrift(coachId: string): Promise<{
    drifting: boolean;
    direction: 'improving' | 'degrading' | 'stable';
    metrics: DriftMetrics;
    recommendations: string[];
  }>;
}
```

**Quality Signals:**
| Signal | Good | Warning | Action |
|--------|------|---------|--------|
| Approval rate | >90% | <80% | Review voice model |
| Edit rate | <20% | >40% | Analyze edit patterns |
| Engagement trend | Stable/up | Down 20%+ | Review content strategy |
| Undo rate | <5% | >10% | Review autonomy rules |

**Drift Detection (weekly Inngest job):**
1. Calculate rolling averages for quality metrics
2. Compare to baseline (first month)
3. If significant degradation, alert internally
4. If severe, notify coach: "I've noticed my suggestions need more edits lately. Want to do a quick voice refresh?"

### 4. Preference Versioning

**Problem:** Preferences change over time, old preferences conflict with new ones.

**Solution:** Version preferences, detect conflicts, prefer recent.

```typescript
interface PreferenceManager {
  // Set preference (creates new version if exists)
  setPreference(
    coachId: string,
    key: string,
    value: any,
    source: 'explicit' | 'inferred'
  ): Promise<void>;

  // Get active preferences (most recent, non-superseded)
  getActivePreferences(coachId: string): Promise<Preference[]>;

  // Detect conflicts
  detectConflicts(coachId: string): Promise<Conflict[]>;

  // Resolve conflict (ask coach or use heuristic)
  resolveConflict(conflict: Conflict): Promise<void>;
}
```

**Conflict Resolution:**
1. Explicit > Inferred (coach said it directly)
2. Recent > Old (preferences change)
3. Specific > General ("no emojis on Mondays" > "minimal emojis")
4. If unclear, ask coach

---

## Context Window Management

### The Problem

LLM context windows are limited. We can't include everything.

### Context Budget

For a typical content generation request:
| Component | Tokens | Priority |
|-----------|--------|----------|
| System prompt | 500 | Required |
| Voice model | 300 | Required |
| Active preferences | 200 | Required |
| Recent context (24h) | 400 | Required |
| Relevant past content | 500 | High |
| Relevant feedback | 300 | High |
| Similar conversations | 200 | Medium |
| **Total** | **2,400** | |

With Claude (200k context), we have plenty of room. But for cost/speed, aim for <4k tokens of memory context.

### Retrieval Strategy

```typescript
async function buildMemoryContext(
  coachId: string,
  task: Task
): Promise<MemoryContext> {
  // Required context (always include)
  const voiceModel = await getVoiceModel(coachId);
  const preferences = await getActivePreferences(coachId);
  const recentContext = await getRecentContext(coachId, 24);

  // Semantic retrieval (based on task)
  const relevantContent = await findSimilarContent(task.description, 5);
  const relevantFeedback = await findRelatedFeedback(task.description, 3);

  // Assemble with budget
  return assembleContext({
    voiceModel,          // 300 tokens
    preferences,         // 200 tokens
    recentContext,       // 400 tokens
    relevantContent,     // 500 tokens
    relevantFeedback,    // 300 tokens
  }, MAX_TOKENS = 2000);
}
```

---

## Implementation Plan

### MVP (Week 4-5)

**Simple memory, foundation for advanced:**

1. **PostgreSQL only** (no vector DB yet)
   - Store conversations, actions, feedback
   - Store brand voice as JSON
   - Store preferences as key-value

2. **Basic retrieval**
   - Last 10 conversations in context
   - Full brand voice model in every prompt
   - All active preferences in context

3. **Simple feedback loop**
   - Track when coach edits content
   - Store edit diffs
   - Manual review of patterns (no automation)

### Post-MVP (Phase 2)

**Add vector DB and semantic retrieval:**

1. **pgvector integration**
   - Embed all content, conversations, feedback
   - Semantic search for relevant context

2. **Automated feedback learning**
   - LLM extracts lessons from edits
   - Lessons included in prompts automatically

3. **Consolidation jobs**
   - Daily/weekly memory summaries
   - Prune old embeddings

### Scale (Phase 3)

**Full memory system:**

1. **Migrate to Pinecone** (if pgvector slow)
2. **Advanced drift detection**
3. **Proactive voice refresh flows**
4. **Cross-coach pattern learning** (anonymized)

---

## Open Questions

1. **How long should raw conversations be retained?** (Privacy, storage cost)
2. **Should coaches be able to see/edit their memory?** (Transparency vs. complexity)
3. **How do we handle coach voice changes?** (Rebrand, style evolution)
4. **Should Juno proactively ask for feedback?** ("How was that caption?")

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Voice consistency | >0.8 similarity to anchor | Weekly embedding comparison |
| Preference adherence | 100% for explicit prefs | Audit log review |
| Feedback incorporation | <3 repeated corrections | Track lesson application |
| Quality stability | <10% variance in approval rate | Rolling 30-day average |
| Context relevance | >80% useful retrievals | Sample + manual review |
