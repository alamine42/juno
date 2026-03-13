# Juno - Product Specification

> AI Chief of Staff for Coaches

## Overview

Juno is an autonomous AI business assistant built specifically for coaches (personal trainers, fitness coaches, life coaches). It handles content creation, scheduling, client communications, and business operations so coaches can focus on coaching.

### Vision
Create space and time for coaches to do what they do best—coach—by automating the business operations they don't want to deal with.

### Target Users
- Personal trainers / fitness coaches
- Life coaches / mindset coaches
- Solo practitioners running their own coaching business
- Revenue range: $50K - $500K/year

---

## Core Product Decisions

| Decision | Choice |
|----------|--------|
| Primary Interface | WhatsApp (chat-first) + Web Portal |
| Autonomy Level | Fully autonomous with guardrails |
| MVP Scope | Content creation + scheduling |
| Go-to-Market | Direct B2C to coaches |
| Personality | Encouraging business partner |
| Success Metric | 30-day retention |
| Timeline | 8 weeks to MVP |
| **Background Jobs** | **Inngest (managed)** |

---

## MVP Features

### 1. Content Creation
**Goal:** Generate high-quality, on-brand content for Instagram

- **Text content:** Captions, carousel scripts, Reels scripts, Stories copy
- **Voice learning:** Analyze existing content + onboarding questionnaire, refine via feedback loop
- **Canva integration:** Generate text, provide Canva templates for visual design
- **Content types:** Educational posts, client wins, behind-the-scenes, promotional, engagement hooks

**Not in MVP:**
- AI image generation
- TikTok/LinkedIn/other platforms
- Long-form content (blogs, newsletters)

### 2. Scheduling & Calendar
**Goal:** Manage when content goes out and when coaches are available

- **Content scheduling:** Juno proposes weekly posting schedule, coach approves/adjusts
- **Google Calendar integration:** Sync availability for client sessions
- **Posting automation:** Auto-post approved content at scheduled times
- **Optimal timing:** AI analyzes audience engagement to suggest best posting times

**Timezone & Edge Case Handling:**
- Store coach timezone explicitly (IANA format, e.g., "America/New_York")
- All scheduled times stored in UTC, converted to local for display
- DST transitions: Re-calculate scheduled times on DST change, notify coach of shifts
- Calendar sync conflicts: Last-write-wins with notification to coach
- Token expiration: Proactive refresh 7 days before expiry, alert if refresh fails

**Not in MVP:**
- Client booking/payment
- Outlook calendar
- Calendly/Cal.com integration

### 3. WhatsApp Chat Interface
**Goal:** Natural, conversational interaction with quick actions

- **Hybrid UX:** Freeform conversation + proactive suggestions with quick-reply buttons
- **Example interactions:**
  - Coach: "I need content for this week"
  - Coach: "What should I post about today?"
  - Coach: "Schedule my client sessions for next week"
  - Juno: "I've drafted 5 posts for this week. Want to review?" [Review] [Auto-approve]
- **Proactive nudges:** Juno surfaces opportunities (trending topics, engagement spikes, content gaps)
- **Deep links:** WhatsApp messages include links to web portal for rich content review

### 4. Web Portal
**Goal:** Handle OAuth flows, rich content review, and serve as WhatsApp fallback

The web portal is a lightweight companion to WhatsApp, not a full dashboard replacement.

**Core Functions:**
- OAuth flows for Instagram, Google Calendar, Canva (WhatsApp cannot handle these)
- Content preview and approval for carousels, multi-image posts
- Calendar view of scheduled content
- Activity log and audit trail browser
- Basic analytics display
- Account settings and billing management
- **Chat interface (WhatsApp fallback)**

**UX Flow:**
1. Coach signs up via web portal (email/magic link)
2. Connects Instagram, Google Calendar via OAuth
3. Links WhatsApp number (or uses web chat if WhatsApp unavailable)
4. Day-to-day interaction happens in WhatsApp (or web chat)
5. WhatsApp/web chat sends deep links to portal for rich reviews

### 5. Web Chat Fallback (If WhatsApp Delayed)
**Goal:** Provide full Juno experience without WhatsApp dependency

If WhatsApp Business API approval is delayed, the web portal includes a native chat interface:

**Features (parity with WhatsApp):**
- Real-time chat with Juno in browser
- Quick-action buttons (same as WhatsApp quick replies)
- Proactive nudges via browser notifications (with permission)
- Deep links to content review, calendar, analytics
- Mobile-responsive design for on-the-go use
- Push notifications for scheduled post confirmations

**Technical Implementation:**
- **Supabase Realtime** for real-time messaging (Vercel serverless can't hold WebSockets)
- Postgres LISTEN/NOTIFY via Supabase subscription
- Same conversation state model as WhatsApp
- Same AI orchestration layer (channel-agnostic)
- Notification opt-in during onboarding

**Why Supabase Realtime (not WebSockets):**
- Vercel serverless functions can't maintain WebSocket connections
- Supabase Realtime is included with our Postgres (Supabase) setup
- Client subscribes to `conversations` table changes
- API route writes message → triggers Supabase Realtime → client receives
- Fallback: Long-polling with 3-second intervals if Realtime fails

**UX Differences from WhatsApp:**
- Coach must open browser (no push to locked phone)
- Browser notifications less reliable than WhatsApp
- No voice messages (WhatsApp supports, web chat doesn't)
- Slight latency increase vs. WhatsApp (~500ms vs. instant)

---

## Autonomy & Guardrails

### Confidence-Based Execution
- **High confidence:** Execute automatically (routine posts, standard scheduling)
- **Medium confidence:** Execute with notification to coach
- **Low confidence:** Ask coach before proceeding

### Action-Type Rules (Always Require Approval)
- Payment-related actions
- Client cancellations
- Anything involving money
- Content mentioning specific clients by name

### Sensitive Content Detection & Handling

**The Problem:** Coaches in fitness/wellness/mindset regularly discuss weight, mental health, transformations—this is their job. Blanket flagging would block most content and negate autonomy.

**Solution:** Tiered moderation with per-coach allow-lists.

**Detection Pipeline:**

Moderation runs at **three checkpoints** to prevent bypass:
1. **On content generation:** When Juno first creates the content
2. **On every revision:** When `Content.current_revision_id` changes (coach edits)
3. **Immediately before posting:** Final gate in the PostContent job

**Tiered Classification:**
| Tier | Examples | Auto-post? |
|------|----------|------------|
| **Green (Safe)** | Workout tips, motivation, scheduling | Yes |
| **Yellow (Coaching)** | Weight loss journey, mindset shifts, transformations, general wellness | Yes, if coach has attested* |
| **Red (Regulated)** | Medical claims ("cures X"), specific diagnoses, supplement dosing, injury treatment | Never - always require approval |

*Coach attestation: During onboarding, coaches attest: "I understand I'm responsible for compliance with health/advertising regulations in my content."

**Detection Steps:**
1. **Keyword/regex scan:** Categorize content into Green/Yellow/Red tiers
2. **LLM classification:** Claude Haiku refines tier + identifies specific concerns
3. **Per-coach allow-list check:** Has coach approved this topic category before?
4. **Decision logic:**
   - Green: Auto-post per normal autonomy rules
   - Yellow + attested + no specific red flags: Auto-post
   - Yellow + not attested: Flag for review, offer attestation
   - Red: Always flag, require explicit approval
5. **Store classification:** Log tier, category, confidence, decision, and **revision_id**

**Per-Coach Topic Allow-Lists:**
- When coach approves a Yellow-tier post, offer: "Allow similar content in the future?"
- Store approved categories: `["weight_loss_journey", "mindset", "transformations"]`
- Future Yellow content in allowed categories → auto-post

**Red-Tier (Always Blocked) Examples:**
- "This supplement cures anxiety"
- "Do this exercise to fix your herniated disc"
- "I guarantee you'll lose 20 lbs"
- Specific medical/psychiatric diagnoses
- Before/after with specific weight claims

**Yellow-Tier (Coachable) Examples:**
- "My client's transformation journey"
- "Struggling with motivation? Here's what helped me..."
- "Nutrition tips for busy professionals"
- "The mental game of fitness"

**Posting Gate:**
- PostContent job checks tier + attestation + allow-list
- If Red: Block, notify coach, require explicit approval
- If Yellow without attestation: Block, request attestation
- If mismatch in revision: Re-run classification

### Recovery & Audit Trail
**Versioned Content Model:**
- Every content edit creates a new ContentRevision record
- Revisions store: rendered payload, external IDs (IG post ID), timestamps
- Undo logic: Look up previous revision, attempt rollback via API

**Undo Capabilities:**
| Action | Undo Possible? | Method |
|--------|---------------|--------|
| Scheduled post (not yet posted) | Yes | Delete from queue |
| Published post | Yes* | Delete via Instagram API |
| Published Story | No | Stories expire, cannot delete retroactively |
| Calendar event created | Yes | Delete via Google Calendar API |
| Content text edited | Yes | Restore previous revision |

*Instagram deletion may leave cached versions in feeds briefly

**Undo States (surfaced in Activity Log):**
| State | Description | User Action |
|-------|-------------|-------------|
| Undo available | Action can be reversed | Show "Undo" button |
| Undo pending | Undo in progress | Show spinner |
| Undo complete | Successfully reversed | Show "Undone" badge |
| Undo partial | Partially reversed (e.g., IG deleted but cached) | Show warning + explanation |
| Undo failed | Could not reverse (e.g., external change) | Show error + "Contact support" |
| Undo unavailable | Cannot undo (e.g., Story posted) | No button, show explanation on hover |

**Undo Limitations (surfaced in UX):**
- Stories cannot be undone after posting
- External caches may retain deleted content briefly
- Coach notified when undo is partial or impossible
- WhatsApp/web chat notifications mirror activity log states

### Silence Handling
- If coach unresponsive for 72+ hours:
  - Pause non-critical automations
  - Send check-in message via WhatsApp/web chat
  - Continue only pre-approved scheduled content
  - After 7 days: Pause all automations, send email alert

---

## Onboarding Flow

### Phase 1: Web Portal (Account Setup)
1. **Sign up:** Email + magic link authentication
2. **Goal-setting:** Quick questionnaire about business goals, challenges
3. **Instagram connection:** OAuth flow with **Business/Creator account requirement**
4. **Google Calendar:** Optional OAuth connection
5. **Phone verification:** Link WhatsApp number (or skip for web chat)

### Instagram Account Requirements
**Required for full features:** Instagram Business or Creator account linked to a Facebook Page.

**Why:** Meta Graph API only exposes historical posts, analytics, and publishing for Business/Creator accounts. Personal accounts cannot be used for auto-posting.

**Account State Machine:**
| State | Can Auto-Post? | Can Get Analytics? | Voice Learning | Available Features |
|-------|---------------|-------------------|----------------|-------------------|
| **Business/Creator** | Yes | Yes | From API | Full autonomy |
| **Personal (connected)** | No | No | Manual upload | Content generation + reminders |
| **Not connected** | No | No | Manual upload | Content generation only |

**Degraded Mode (Personal Account):**
Coaches with personal accounts can still get value:

1. **Content generation:** Juno creates posts, captions, scripts
2. **Copy-paste workflow:** Juno sends ready-to-post content via WhatsApp/web chat
3. **Posting reminders:** "Time to post! Here's your content: [text] - Copy and paste to Instagram"
4. **Manual performance tracking:** Coach tells Juno how posts performed
5. **Calendar/scheduling:** Plan content calendar, get reminders (no auto-post)

**Degraded Mode UX:**
- Clear visual indicator in web portal: "Upgrade to Business account for auto-posting"
- WhatsApp messages include: "[Copy to Instagram]" button with pre-formatted text
- Weekly nudge: "Upgrade to Business account to unlock auto-posting"
- Track conversion rate from degraded → full mode

**Onboarding UX:**
- Check account type during OAuth callback
- If personal account detected:
  - Show educational modal: "Juno works best with Business/Creator accounts"
  - Explain what they CAN do (generation, reminders) vs. CAN'T (auto-post)
  - Link to Instagram's guide for switching account types
  - Allow them to continue in degraded mode (don't block activation)
  - Allow manual content upload for voice learning

**Fallback for Voice Learning (if API unavailable):**
- Manual upload: Coach pastes 5-10 recent captions into a form
- Screenshot import: Coach uploads screenshots of posts (OCR extraction)
- Website import: If coach has a website, analyze copy from there
- Skip option: Start with generic voice, refine through feedback

### Phase 2: WhatsApp/Web Chat (Brand Discovery)
1. **Welcome message:** Juno introduces itself, confirms setup complete
2. **Brand discovery conversation:** Tone, values, target audience (conversational, not form)
3. **Content analysis:** If Instagram connected, analyze recent posts; otherwise use fallback data
4. **Quick win:** Generate 3-5 sample posts, send preview links to web portal
5. **First approval:** Coach reviews and approves/edits to train voice model

### Ongoing Learning
- Track which edits coach makes to generated content
- Note which content performs best (engagement metrics)
- Refine voice model continuously
- Periodic check-ins: "Is this still sounding like you?"

---

## Technical Architecture

### Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js (TypeScript) |
| Backend | Next.js API Routes |
| Database | PostgreSQL (Supabase) |
| Vector DB | pgvector (included in Supabase) → Pinecone (scale) |
| Realtime | Supabase Realtime (for web chat) |
| Cache | Redis (Upstash) |
| **Background Jobs** | **Inngest** |
| Hosting | Vercel |
| WhatsApp | WhatsApp Business API (direct) |
| Payments | Stripe (subscriptions + usage metering) |
| AI Models | Multi-provider (best-of-breed routing) |
| Embeddings | OpenAI text-embedding-3-small |

### Background Job Infrastructure: Inngest

**Why Inngest:**
- Zero infrastructure to manage (no Redis queues, no worker processes)
- Built-in retries, scheduling, fan-out, and dead letter handling
- Native TypeScript SDK, seamless Next.js integration
- Functions run on Vercel (same deployment target)
- Free tier (5,000 steps/month) covers MVP; Pro ($50/month) scales to 500+ coaches
- Migration path: Functions are portable if we outgrow Inngest

**Architecture:**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Vercel API     │────▶│  Inngest Cloud  │────▶│  Inngest Fn     │
│  (send event)   │     │  (orchestrate)  │     │  (on Vercel)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Job Definitions (Inngest Functions):**
| Function | Trigger | Retry Policy |
|----------|---------|--------------|
| `post-content` | Scheduled time | 3 retries, exponential backoff |
| `refresh-token` | Cron: daily, filter by expiry | 5 retries over 24 hours |
| `sync-calendar` | Cron: every 15 minutes | 3 retries |
| `check-silence` | Cron: daily at 9am coach timezone | No retry |
| `send-reminder` | Scheduled time | 3 retries |
| `process-webhook` | Event: webhook received | 5 retries |
| `report-usage` | Cron: daily at midnight UTC | 3 retries |
| `reconcile-billing` | Cron: weekly | 3 retries |
| `consolidate-memory-daily` | Cron: daily at 2am | 3 retries |
| `consolidate-memory-weekly` | Cron: Sunday 3am | 3 retries |
| `detect-drift` | Cron: weekly | No retry |

**Failure Handling:**
- Inngest provides built-in dead letter queue
- Failed functions visible in Inngest dashboard
- Alert coach via WhatsApp/email if posting fails
- Alert via email if WhatsApp/web chat delivery fails

**Cost Projection:**
| Scale | Steps/month | Cost |
|-------|-------------|------|
| 10 coaches | ~2,000 | Free |
| 50 coaches | ~10,000 | $50/mo |
| 200 coaches | ~40,000 | $50/mo |
| 500 coaches | ~100,000 | $100/mo |

**Migration Path (if needed):**
When Inngest costs exceed $200/mo, migrate high-volume jobs to Railway + BullMQ:
1. Abstract job handlers behind `JobRunner` interface
2. Keep complex workflows (multi-step, fan-out) on Inngest
3. Move simple high-volume jobs (usage reporting) to BullMQ

### AI Model Strategy
Route tasks to optimal model:
- **Content generation:** Claude (nuanced writing, brand voice)
- **Sensitive content classification:** Claude Haiku (fast, cheap)
- **Function calling/tools:** GPT-4 (reliable structured output)
- **Quick responses:** GPT-4o-mini or Claude Haiku (cost efficiency)
- **Long context analysis:** Gemini (when analyzing large content history)

### AI Orchestration
- Raw API calls with custom orchestration (no LangChain)
- Custom prompt management
- Conversation state management (channel-agnostic: WhatsApp or web chat)
- Tool/function definitions per task type

### Memory & Drift Prevention

> Full architecture: `docs/MEMORY-ARCHITECTURE.md`

Juno maintains three types of memory per coach:

**Memory Types:**
| Type | Purpose | Storage |
|------|---------|---------|
| Episodic | What happened (conversations, actions, feedback) | PostgreSQL + pgvector |
| Semantic | Facts & knowledge (brand voice, preferences, rules) | PostgreSQL JSON + pgvector |
| Procedural | Learned patterns (what content works, optimal times) | PostgreSQL metrics |

**Memory Operations:**
- **Encoding:** Store events, generate embeddings, update derived insights
- **Retrieval:** Semantic search for relevant context before each generation
- **Consolidation:** Daily/weekly summarization of old memories (Inngest crons)
- **Forgetting:** Prune superseded preferences, archive old embeddings

**Drift Prevention:**

| Strategy | How It Works |
|----------|--------------|
| Voice Anchoring | Store embeddings of first approved content as "anchor"; compare new content to anchor before posting |
| Feedback Learning | Extract lessons from coach edits; include relevant lessons in future prompts |
| Quality Monitoring | Track approval rate, edit rate, engagement trends; alert if degradation detected |
| Preference Versioning | Version all preferences; detect conflicts; prefer recent + explicit |

**Context Window Management:**
- Budget: ~2,400 tokens of memory context per request
- Always include: Voice model (300), preferences (200), recent context (400)
- Semantic retrieval: Relevant past content (500), relevant feedback (300)

**Drift Detection (weekly Inngest job):**
1. Calculate rolling quality metrics (approval rate, edit rate, engagement)
2. Compare to baseline (first month of usage)
3. If degradation >20%, trigger voice refresh flow
4. Proactive check-in: "I've noticed my suggestions need more edits. Want to do a quick voice refresh?"

### Integrations (MVP)
| Service | Method | Purpose |
|---------|--------|---------|
| Instagram | Meta Graph API | Post content, read analytics |
| WhatsApp | WhatsApp Business API | Coach communication |
| Google Calendar | Google Calendar API | Availability sync |
| Canva | Canva Connect API | Template access, design handoff |
| Stripe | Stripe API | Billing |

### Data Model (Core Entities)
```
Coach
├── id, email, phone, name
├── timezone (IANA format, e.g., "America/New_York")
├── brand_voice (JSON - tone, values, vocabulary)
├── business_goals (JSON)
├── connected_accounts[]
├── instagram_account_type (business, creator, personal, null)
├── content_attestation (boolean - attested to compliance responsibility)
├── content_attestation_at (timestamp)
├── topic_allow_list (JSON array - ["weight_loss_journey", "mindset", ...])
├── subscription_status
├── last_active_at
├── preferred_channel (whatsapp, web_chat)
└── created_at, updated_at

Content
├── id, coach_id
├── type (post, reel, story, carousel)
├── current_revision_id (FK to ContentRevision)
├── status (draft, scheduled, posted, failed, deleted)
├── scheduled_at, posted_at
├── platform (instagram)
├── external_id (Instagram post ID, nullable)
├── performance_metrics (JSON)
└── created_at, updated_at

ContentRevision
├── id, content_id
├── version (incrementing integer)
├── text, media_urls[]
├── rendered_payload (JSON - exact API payload sent)
├── created_at
└── created_by (coach or system)

ContentModeration
├── id, content_id
├── revision_id (FK to ContentRevision - tracks which revision was moderated)
├── category (health_claim, mental_health, transformation, etc.)
├── confidence_score
├── flagged (boolean)
├── reviewed_by_coach (boolean)
├── reviewed_at
└── created_at

Conversation
├── id, coach_id
├── channel (whatsapp, web_chat)
├── messages[] (role, content, timestamp)
└── context (JSON - current task, pending actions)

Action
├── id, coach_id
├── type (post, schedule, message, etc.)
├── payload (JSON)
├── status (pending, executed, undone, failed)
├── undo_status (null, pending, complete, partial, failed)
├── undo_error (nullable - explanation if partial/failed)
├── confidence_score
├── executed_at
├── undone_at
├── error_message (nullable)
└── created_at

CalendarEvent
├── id, coach_id
├── external_id (Google Calendar ID)
├── title, start, end
├── timezone
├── type (client_session, blocked, available)
├── synced_at
└── sync_status (synced, conflict, error)

UsageEvent
├── id, coach_id
├── action_id (FK, nullable)
├── event_type (post_created, ai_interaction, etc.)
├── quantity (default 1, negative for compensating events)
├── billable (boolean)
├── undo_of (FK to UsageEvent, nullable - for compensating events)
├── undo_window_expires_at (timestamp - 1 hour after creation)
├── reported_to_stripe (boolean)
├── stripe_usage_record_id (nullable)
└── created_at

OAuthToken
├── id, coach_id
├── provider (instagram, google, canva)
├── access_token (encrypted)
├── refresh_token (encrypted)
├── expires_at
├── refresh_attempted_at
└── status (active, expired, revoked)

Memory (episodic, semantic, procedural)
├── id, coach_id
├── type (episodic, semantic, procedural)
├── category (conversation, feedback, preference, pattern)
├── content (text)
├── metadata (JSON)
├── importance (float 0-1)
├── embedding (vector 1536)
├── expires_at (nullable)
├── consolidated_into (FK to Memory, nullable)
└── created_at

Preference (structured semantic memory)
├── id, coach_id
├── category (content, scheduling, communication)
├── key, value (JSON)
├── source (explicit, inferred, default)
├── confidence (float)
├── superseded_by (FK to Preference, nullable)
└── created_at, updated_at

VoiceModel (structured semantic memory)
├── id, coach_id
├── version (int)
├── tone (JSON - formality, enthusiasm, humor scores)
├── vocabulary (JSON - preferred, avoided words)
├── patterns (JSON - sentence length, emoji usage, etc.)
├── anchor_embeddings (vector[] - first approved content)
├── active (boolean)
└── created_at

Feedback (for learning from corrections)
├── id, coach_id, content_id
├── feedback_type (edit, approval, rejection, comment)
├── original_text, modified_text
├── edit_embedding (vector 1536)
├── lesson_extracted (text - AI-derived lesson)
└── created_at

MemorySummary (consolidated memories)
├── id, coach_id
├── period_type (day, week, month)
├── period_start, period_end
├── summary (text)
├── key_events (JSON)
├── patterns_observed (JSON)
├── embedding (vector 1536)
└── created_at
```

---

## Pricing Model

### Hybrid: Base Subscription + Usage

**Base tier: $49/month**
- Up to 30 posts/month
- Basic scheduling
- WhatsApp/web chat access
- 1 Instagram account

**Growth tier: $99/month**
- Up to 100 posts/month
- Advanced analytics
- Priority support
- Content calendar

**Usage overages:**
- $0.50 per additional post
- $0.10 per additional AI interaction

### Usage Metering Pipeline

**Event Flow:**
1. Action executed → Write UsageEvent (billable: true, undo_window_expires_at: now + 1 hour)
2. If action undone within 1 hour → Write compensating UsageEvent (quantity: -1, undo_of: original event)
3. If undo after 1 hour → No compensation (already past billing window)
4. Daily batch job (`report-usage`) → Aggregate unbilled events per coach where undo_window_expires_at < now
5. Report to Stripe → Create Stripe Usage Records, mark events as reported
6. Weekly job (`reconcile-billing`) → Compare UsageEvent totals with Stripe records

**Metering Rules:**
- Only "posted" content counts (not drafts or scheduled)
- Undone posts within 1 hour are not billed (compensating event)
- AI interactions counted per conversation turn, not per API call
- Failed posts are not billed (billable: false)

**Data Model Support:**
- `undo_window_expires_at`: Timestamp when 1-hour grace period ends
- `undo_of`: FK linking compensating event to original
- `billable`: False for failed actions, system events

**Reconciliation (weekly):**
- Sum UsageEvents by coach for billing period
- Compare with Stripe usage records
- Log discrepancies > 1% to alerts channel
- Generate monthly reconciliation report

**Edge Cases:**
| Scenario | Handling |
|----------|----------|
| Post succeeds, then undo within 1h | Compensating event, net zero |
| Post succeeds, undo after 1h | No compensation, coach billed |
| Post fails on first try | billable: false, no charge |
| Post fails after 2 retries, succeeds on 3rd | One billable event |
| Coach disputes charge | Support can manually create compensating event |

### Payment Implementation
- Stripe Subscriptions for base
- Stripe Usage Records for metering
- Billing portal for self-serve management

---

## Analytics & Metrics

### Coach-Facing Dashboard (Web Portal)
- **Engagement metrics:** Likes, comments, shares, saves, follower growth
- **Content performance:** Best performing posts, optimal posting times
- **Activity log:** Everything Juno has done (with undo buttons and status indicators)
- **Business metrics (future):** Leads generated, conversion tracking

### AI-Driven Insights
- "Your Reels are getting 3x more engagement than static posts"
- "Tuesday at 7pm is your best posting time"
- "You haven't posted about nutrition in 2 weeks—your audience engages well with that topic"

### Internal Metrics (Success Tracking)
- **Primary:** 30-day retention rate
- **Secondary:** Content pieces created per coach, DAU/MAU, NPS

---

## Competitive Positioning

### Primary Competitors
General AI assistants (ChatGPT, Claude)

### Differentiation
1. **Coaching-specific workflows:** Pre-built for fitness/life coaching use cases
2. **Autonomous execution:** Actually posts, schedules, follows up—not just suggestions
3. **WhatsApp-native:** Meets coaches where they are, not another app
4. **Brand voice learning:** Deeply personalized to each coach's style
5. **End-to-end:** Content + scheduling + ops in one tool

### Positioning Statement
> "Juno is the AI business partner that handles your content, scheduling, and client follow-ups so you can focus on coaching. Unlike ChatGPT, Juno doesn't just give advice—it actually does the work."

---

## Compliance & Security

### Tiered Approach
- **Standard tier:** For business/life coaches (no health data)
- **HIPAA tier (future):** For nutrition/health coaches handling PHI

### MVP Security
- Encrypted data at rest and in transit
- OAuth for all third-party connections
- OAuth tokens encrypted at rest (AES-256)
- No storage of payment credentials (Stripe handles)
- Audit logging for all actions
- Rate limiting on all API endpoints

### Token Management
- Proactive refresh: Inngest job runs daily, filters tokens expiring in 7 days
- Refresh failure: Alert coach via WhatsApp/web chat, then email
- Expired tokens: Disable automations, prompt re-auth
- Revoked tokens: Detect via API error, disable and alert

### Data Handling
- Coach owns their data
- Clear data deletion workflow
- No training on coach data without consent

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Instagram API changes/restrictions | Monitor API deprecations, build abstraction layer |
| Coaches don't trust autonomous posting | Start with "suggest + approve" mode, build trust over time |
| WhatsApp Business API approval delays | Web chat fallback fully specified and built in parallel |
| Canva API approval delays | MVP works without Canva; manual template sharing as backup |
| Content quality inconsistent | Heavy investment in prompt engineering, feedback loops |
| Scope creep in timeline | Strict MVP scope, defer all "nice to haves" |
| Token expiration causes silent failures | Proactive refresh, multiple alert channels |
| Instagram rate limits | Implement backoff, queue posts, respect limits |
| Coach edits bypass moderation | Re-run moderation on every revision and before posting |
| Personal IG accounts can't use API | Require Business/Creator account, provide conversion guide + fallbacks |

---

## MVP Milestones (8 Weeks)

### Week 1: Foundation
- [ ] Next.js project setup with TypeScript
- [ ] PostgreSQL + Redis setup
- [ ] Auth system (magic link)
- [ ] Basic data models and migrations
- [ ] **Inngest setup and first test function**
- [ ] **Apply for WhatsApp Business API approval** (start immediately)
- [ ] **Apply for Canva Connect API access** (start immediately)

### Week 2: Web Portal Core
- [ ] Web portal: signup, login, settings
- [ ] OAuth integration: Instagram (with Business/Creator account check)
- [ ] OAuth integration: Google Calendar
- [ ] Token storage and refresh infrastructure
- [ ] Fallback content ingestion UI (manual paste, screenshot upload)

### Week 3: Background Jobs + Vector Infrastructure
- [ ] Inngest functions: PostContent, RefreshToken, SyncCalendar
- [ ] Content scheduling system
- [ ] Calendar sync implementation
- [ ] **pgvector extension enabled in Supabase**
- [ ] **Embedding generation pipeline (OpenAI text-embedding-3-small)**
- [ ] **Supabase Realtime setup for web chat**
- [ ] Job monitoring dashboard (Inngest provides)

### Week 4: Content Generation + Memory
- [ ] Claude integration for content generation
- [ ] Voice learning from Instagram posts (or fallback data)
- [ ] Content preview and approval flow (web portal)
- [ ] **Tiered moderation (Green/Yellow/Red) + attestation flow**
- [ ] **Per-coach topic allow-lists**
- [ ] **Memory tables (using pgvector from Week 3)**
- [ ] **Voice model creation + anchor embeddings**
- [ ] **Start web chat fallback (using Supabase Realtime from Week 3)**
- [ ] **Degraded mode for personal IG accounts**

### Week 5: Chat Integration
- [ ] WhatsApp Business API integration (if approved)
- [ ] **Web chat interface (fallback, built regardless)**
- [ ] Conversation handling and state management (channel-agnostic)
- [ ] Deep links from chat to web portal
- [ ] Quick-reply buttons and proactive nudges

### Week 6: Instagram Posting + Undo + Memory
- [ ] Instagram posting via Graph API
- [ ] Content versioning (ContentRevision)
- [ ] Moderation re-check before posting
- [ ] Undo functionality with status states
- [ ] Posting failure handling and alerts
- [ ] **Feedback tracking (store edits with embeddings)**
- [ ] **Lesson extraction from coach edits**
- [ ] **Memory retrieval in content generation prompts**

### Week 7: Billing + Analytics
- [ ] Stripe subscription integration
- [ ] Usage metering pipeline with compensating events
- [ ] UsageEvent schema with undo tracking fields
- [ ] Reconciliation job and tests
- [ ] Basic analytics dashboard
- [ ] Activity log with undo buttons and status indicators

### Week 8: Hardening + Beta Launch
- [ ] End-to-end testing
- [ ] Error handling audit
- [ ] Security review
- [ ] Rate limiting
- [ ] **Memory consolidation jobs (daily/weekly)**
- [ ] **Drift detection baseline setup**
- [ ] **Voice anchor comparison before posting**
- [ ] Beta launch with 5-10 coaches
- [ ] Monitoring and alerting setup

### Parallel Workstreams
```
Week 1 ─────────────────────────────────────────────▶ Week 8
  │
  ├── WhatsApp API Approval (background, check weekly)
  │
  ├── Canva API Approval (background, check weekly)
  │
  ├── Web Chat Fallback (Weeks 4-5, built regardless of WhatsApp status)
  │
  └── Beta Coach Recruitment (start Week 4)
```

---

## Fallback Plans

| Integration | If Delayed | Fallback |
|-------------|------------|----------|
| WhatsApp Business API | Not approved by Week 5 | Web chat interface (same features, different channel) |
| Canva Connect API | Not approved by Week 6 | Manual template links, no deep integration |
| Instagram Graph API | Rate limited | Queue posts, reduce frequency, alert coach |
| Instagram Business account | Coach has personal account | Conversion guide + manual content upload for voice learning |

---

## Future Roadmap (Post-MVP)

### Phase 2: Expand Platform
- TikTok integration
- LinkedIn integration
- Multi-brand support

### Phase 3: Full Business Ops
- Client booking and payments
- CRM functionality
- Email/SMS outreach to clients
- Revenue tracking and attribution

### Phase 4: Scale
- Team workspaces (gym owners with multiple trainers)
- White-label for coaching platforms
- HIPAA compliance for health coaches
- Migrate high-volume jobs to BullMQ (if Inngest costs > $200/mo)

---

## Open Questions (Updated)

1. ~~**WhatsApp Business API approval:** Timeline unclear—should we have a web chat fallback for day 1?~~ **RESOLVED:** Yes, web chat fallback built in parallel.
2. ~~**Canva API access:** Requires Canva partner approval—backup plan if delayed?~~ **RESOLVED:** MVP works without Canva; manual template sharing.
3. ~~**Worker hosting:** Inngest vs Railway vs others?~~ **RESOLVED:** Inngest for MVP, migration path to BullMQ if needed.
4. **Instagram posting limits:** Need to research exact rate limits and implement backoff
5. **Beta coach recruitment:** How will we find the first 10 coaches? (Fitness influencer outreach? Paid ads? Personal network?)

---

## Success Criteria for MVP

The MVP is successful if:
- [ ] 10 coaches actively using Juno
- [ ] 70%+ 30-day retention
- [ ] Average of 20+ posts created per coach per month
- [ ] <5% of auto-posted content requires undo/correction
- [ ] NPS of 40+

---

*Last updated: March 2026*
*Status: Ready for implementation*
