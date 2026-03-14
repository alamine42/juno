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
- Token expiration: Proactive refresh 7 days before expiry, alert if refresh fails

**Per-Coach Timezone Scheduling (DST-Safe):**
- Inngest crons run globally (UTC), not per-timezone
- **Two-path scheduling ensures no missed posts:**

**Path A: Immediate Timer (on approval)**
- When coach approves a post → immediately create Inngest timer
- Calculate UTC from local time + timezone at approval moment
- Fire `inngest.send({ runAt: utcTimestamp })` with the timer
- Store `inngest_event_id` on Content record for tracking

**Path B: Sweep Validation (backup + DST correction)**
- `scheduler-sweep` runs every 10 minutes (not hourly)
- Queries posts where local time is within next 30 minutes
- For each post: Check if Inngest timer exists and is correct
- If no timer or DST shifted the time → create/update timer
- Ensures posts scheduled minutes ahead are never missed

**Content posts stored with local time:**
  1. Coach approves post for "Tuesday 9am" → Store as `scheduled_local_time` + `scheduled_date` + `scheduled_timezone` (snapshot at approval)
  2. **Immediately** fire Inngest timer (Path A) if within 2 hours
  3. Sweep validates and corrects if needed (Path B)
  4. **Clarification on 2-hour limit:** Coaches CAN schedule posts for any future date (weekly calendar). The 2-hour limit applies only to *materializing Inngest timers*—we don't create timers for posts >2 hours away. The sweep continuously materializes timers as posts enter the 2-hour window.
  5. **Timezone snapshot:** `scheduled_timezone` is captured at approval time and never changes. If coach travels or updates their profile timezone, already-scheduled posts are unaffected.
- For per-coach events (reminders, silence checks): Same pattern - store local + timezone snapshot, materialize UTC just-in-time

**Calendar Sync Conflict Resolution:**
- Fetch current calendar state with ETags before writing
- Detect overlaps between incoming changes and existing events
- Conflict states: `synced`, `pending_review`, `conflict_detected`, `error`
- On conflict: Hold pending changes, surface in WhatsApp/portal as "needs attention"
- Coach resolves: "Keep mine", "Accept external", or "Merge" (shift times)
- Never silently overwrite client sessions

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
- Client subscribes to `conversation_messages` table INSERT events (append-only)
- API route writes message → triggers Supabase Realtime → client receives
- Lightweight: Only new messages streamed, not entire conversation history
- Fallback: Long-polling with 3-second intervals if Realtime fails

**UX Differences from WhatsApp:**
- Coach must open browser (no push to locked phone)
- Browser notifications less reliable than WhatsApp
- No voice messages (WhatsApp supports, web chat doesn't)
- Slight latency increase vs. WhatsApp (~500ms vs. instant)

**Cross-Channel Consistency (Multi-Channel Sync):**
When coach uses both WhatsApp and web chat:
- **Single conversation:** Both channels read/write same `conversation_messages` table
- **Monotonic ordering:** Messages have auto-increment ID; always display in ID order
- **Channel attribution:** Each message stores `channel` (whatsapp/web_chat) for context
- **Idempotency keys:** Prevent duplicate messages from webhook retries
  - Each message stores `channel_message_id` (e.g., WhatsApp's `wamid`, web chat UUID)
  - Unique constraint: `UNIQUE(coach_id, channel, channel_message_id)`
  - On webhook retry, INSERT with ON CONFLICT DO NOTHING
  - This prevents race conditions where same message is inserted twice
- **Read state sync:** `last_read_message_id` per channel; unread count calculated per channel
- **Proactive nudge deduplication:**
  - Nudges stored in `pending_nudges` table with `sent_via` channel
  - Once sent on any channel, mark as delivered
  - Never send same nudge twice across channels
- **Active channel detection:** Track `last_active_channel` + `last_active_at`
  - If coach active on web chat in last 5 min, suppress WhatsApp nudge
  - If no activity, prefer WhatsApp (higher delivery rate)
- **Handoff indicators:** Show "sent via web chat" / "sent via WhatsApp" badges

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
1. **Keyword/regex scan:** Categorize text content into Green/Yellow/Red tiers
2. **Media moderation (images/carousels):**
   - Run OCR on all images, slides, and screenshots
   - Extract text → feed into same keyword/LLM pipeline
   - Vision model check for before/after imagery, sensitive photos
   - Flag: Regulated claims embedded in images bypass text-only checks
3. **LLM classification:** Claude Haiku refines tier + identifies specific concerns
4. **Per-coach allow-list check:** Has coach approved this topic category before?
5. **Decision logic:**
   - Green: Auto-post per normal autonomy rules
   - Yellow + attested + no specific red flags: Auto-post
   - Yellow + not attested: Flag for review, offer attestation
   - Red: Always flag, require explicit approval
6. **Store classification:** Log tier, category, confidence, decision, and **revision_id**

**Media Moderation Details:**
- OCR via Claude Vision (batch images, extract all text)
- Before/after detection: Flag transformation photos for Yellow tier minimum
- Testimonial screenshots: Extract claims, apply same tiering
- Canva templates: Render to image, OCR, then classify
- Cost: ~$0.002 per image (Vision API), acceptable for trust/safety

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

**Fail-Closed Moderation (Safety Default):**
- If OCR/Vision API fails (timeout, quota, outage): **Block posting**, do not fail open
- If LLM classification fails: **Block posting**, alert coach
- If any moderation stage exceeds SLA (>30 seconds): **Block posting**, retry later
- Blocked posts surface in activity log with "Moderation unavailable - manual review required"
- Coach can manually approve blocked posts via web portal
- Never auto-post content that hasn't passed all moderation stages

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

**Degraded Mode UX (Capability-Aware UI):**
- **Capability flags per coach:** `can_auto_post`, `can_fetch_analytics`, `can_schedule`
- **UI adapts to capabilities:**
  - Hide "Schedule Post" button → Show "Set Reminder" instead
  - Hide "Auto-approve all" → Show "Copy All to Clipboard"
  - Replace "Scheduled" status → "Reminder Set for Tuesday 9am"
  - Disable automation toggles with explanation tooltip
- **Chat responses are capability-aware:**
  - Instead of: "I'll post this Tuesday at 9am"
  - Say: "Since you're on a personal account, I'll remind you to post Tuesday at 9am"
- **Visual indicators:**
  - Banner in web portal: "Upgrade to Business account for auto-posting" with one-click upgrade flow
  - WhatsApp messages include: "[Copy to Instagram]" button with pre-formatted text
  - Inline "Why can't I auto-post?" help link
- **Upgrade prompts:**
  - Weekly nudge: "Upgrade to Business account to unlock auto-posting"
  - Post-reminder: "Want me to post automatically next time? [Upgrade Account]"
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
| `scheduler-sweep` | Cron: every 10 minutes | 3 retries |
| `check-silence` | Event: triggered by scheduler-sweep per coach | No retry |
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

**Inngest Outage Fallback (Single Point of Failure Mitigation):**
- All pending actions stored in `pending_jobs` table before sending to Inngest
- Store `desired_execution_at` (original intended timestamp) on each job
- Mark job as `dispatched` when Inngest accepts, `completed` when done
- Health check: Vercel cron (every 5 min) checks Inngest API status
- If Inngest unhealthy for >15 minutes:
  1. Pause autonomous posting (mark coach for manual mode)
  2. Alert coaches: "Auto-posting paused, manual posting available"
  3. Surface "Post Now" button in web portal for pending content
  4. Queue jobs in DB with original timestamps preserved
- **Recovery with catch-up logic:**
  1. On Inngest healthy, query all `pending` jobs from DB
  2. For each missed job (where `desired_execution_at < now`):
     - If missed by <2 hours AND coach pre-approved: Execute immediately (backfill)
     - If missed by <2 hours AND not pre-approved: Ask coach "Post now or reschedule?"
     - If missed by >2 hours: Notify coach, offer reschedule to next optimal slot
  3. For future jobs: Re-dispatch to Inngest normally
  4. Surface recovery summary: "3 posts were delayed, 2 posted now, 1 needs your input"
- Monitoring: Alert ops team if Inngest down >30 minutes

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

### Knowledge Base (Shared Files & Notes)

> Full architecture: `docs/KNOWLEDGE-BASE.md`

Coaches can share files, notes, and structured data with Juno. This serves as Juno's reference library.

**Content Types:**
| Type | Examples | Storage |
|------|----------|---------|
| Quick Notes | "My sign-off is 'Keep pushing!'" | Database + embedding |
| Documents | Brand guides, program descriptions | Supabase Storage + extracted text |
| Media | Logos, client photos, videos | Supabase Storage + AI description |
| Structured Data | Clients, programs, testimonials | Normalized tables + embeddings |

**Upload Methods:**
- **WhatsApp/Web Chat:** Send file, Juno asks for context, categorizes and stores
- **Web Portal:** File manager with folders, tagging, pinning, editing

**Auto-Context Retrieval:**
When generating content, Juno automatically pulls relevant items:
1. Pinned items (always included - brand guide, core rules)
2. Semantic search (embed task, find similar items)
3. Entity matching (client names, program names mentioned)
4. Category matching (content task → brand assets)

**Context Budget:** ~1,000 tokens for knowledge base items per request

**Privacy:**
- Client PII never auto-posted without approval
- Transformation photos require explicit consent
- Files encrypted at rest, RLS enforced

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
├── scheduled_local_time (TIME - e.g., "09:00", for DST-safe scheduling)
├── scheduled_date (DATE - e.g., "2026-03-17")
├── scheduled_at (TIMESTAMP - computed UTC, updated by scheduler-sweep)
├── posted_at
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
├── started_at, last_message_at
└── context (JSON - current task, pending actions)

ConversationMessage (normalized for scale + realtime)
├── id, conversation_id
├── role (user, assistant, system)
├── content (text)
├── metadata (JSON - buttons, attachments, etc.)
├── created_at
└── deleted_at (nullable - for GDPR "forget")

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
├── etag (for conflict detection)
├── title, start, end
├── timezone
├── type (client_session, blocked, available)
├── synced_at
├── sync_status (synced, pending_review, conflict_detected, error)
├── conflict_data (JSON - nullable, stores conflicting event details)
└── resolved_at (nullable - when coach resolved conflict)

UsageEvent
├── id, coach_id
├── action_id (FK, nullable)
├── event_type (post_created, ai_interaction, etc.)
├── quantity (default 1, negative for compensating events)
├── billable (boolean)
├── undo_of (FK to UsageEvent, nullable - for compensating events)
├── undo_window_expires_at (timestamp - 1 hour after creation)
├── reporting_status (pending, reporting, reported, failed)
├── idempotency_key (UUID - same as event id, used for Stripe dedup)
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

KnowledgeItem (shared files & notes)
├── id, coach_id
├── type (note, document, media, structured)
├── category (brand, client, program, content, legal)
├── title, description, content
├── file_path (Supabase Storage path, nullable)
├── file_type, file_size
├── extracted_text (OCR/PDF extraction)
├── ai_description (vision model description for images)
├── embedding (vector 1536)
├── tags (text array)
├── pinned (boolean - always include in context)
├── usable_in_content (boolean - can be used in generated posts)
├── contains_client_pii (boolean - auto-detected, contains personal info)
├── requires_explicit_approval (boolean - coach must approve each use)
├── last_accessed_at
└── created_at, updated_at

Client (structured data)
├── id, coach_id
├── name, email, phone
├── goals, challenges, preferences (JSON)
├── notes
├── start_date, status (active, paused, completed)
├── embedding (vector 1536)
└── created_at, updated_at

Program (structured data)
├── id, coach_id
├── name, description
├── duration, price, currency
├── includes (text array)
├── ideal_for, testimonials (text array)
├── embedding (vector 1536)
└── created_at, updated_at

Testimonial (for content)
├── id, coach_id, client_id (optional)
├── client_name (display name)
├── content, result
├── program_id (optional)
├── image_path, video_path
├── approved_for_posting (boolean)
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
1. Action executed → Write UsageEvent (billable: true, undo_window_expires_at: now + 1 hour, reporting_status: pending)
2. If action undone within 1 hour → Write compensating UsageEvent (quantity: -1, undo_of: original event)
3. If undo after 1 hour → No compensation (already past billing window)
4. Daily batch job (`report-usage`) → Aggregate unbilled events per coach where undo_window_expires_at < now
5. Mark events as `reporting_status: reporting` before calling Stripe
6. Report to Stripe → Use `idempotency_key` (event UUID) to prevent double-charging on retry
7. On success → Mark events as `reporting_status: reported`, store `stripe_usage_record_id`
8. On failure → Mark as `reporting_status: failed`, retry on next run
9. Weekly job (`reconcile-billing`) → Compare UsageEvent totals with Stripe records

**Metering Rules:**
- Only "posted" content counts (not drafts or scheduled)
- Undone posts within 1 hour are not billed (compensating event)
- AI interactions counted per conversation turn, not per API call
- Failed posts are not billed (billable: false)

**Quota Tracking (Base Plan Allowances):**
- Each subscription tier has included quantities: Base = 30 posts/month, Growth = 100 posts/month
- Track `quota_used` per coach per billing period (reset on subscription renewal)
- `billable_overage = max(0, total_usage - plan_allowance)`
- Only report overage to Stripe, not included usage
- Display quota status in web portal: "23/30 posts used this month"
- Proactive nudge when approaching limit: "You've used 27 of 30 included posts"

**Data Model Support:**
- `undo_window_expires_at`: Timestamp when 1-hour grace period ends
- `undo_of`: FK linking compensating event to original
- `billable`: False for failed actions, system events
- `CoachQuota`: { coach_id, period_start, period_end, posts_used, ai_interactions_used }

**Reconciliation (weekly):**
- Sum UsageEvents by coach for billing period
- Subtract plan allowance to compute overages
- Compare with Stripe usage records
- Log discrepancies > 1% to alerts channel

**Post-Window Dispute Workflow (after 1-hour grace period):**
Real-world disputes happen after the undo window closes. Handle gracefully:

1. **Dispute initiation:**
   - Coach contacts support or clicks "Dispute Charge" in activity log
   - Create `BillingDispute` record: `{ usage_event_id, reason, status: 'open', created_at }`

2. **Dispute statuses:** `open` → `under_review` → `approved` | `denied`

3. **If dispute approved:**
   - Write compensating UsageEvent with `dispute_id` reference
   - If already reported to Stripe: Create Stripe credit/adjustment
   - Store `stripe_credit_id` on dispute record for audit trail
   - Notify coach: "Your dispute was approved, credit applied"

4. **If dispute denied:**
   - Add `resolution_notes` explaining why
   - Notify coach with explanation + escalation path

5. **Data model additions:**
   ```
   BillingDispute: id, coach_id, usage_event_id, reason, status,
                  resolution_notes, stripe_credit_id, created_at, resolved_at
   ```

6. **UX for disputes:**
   - Activity log shows "Dispute" button for past charges (up to 30 days)
   - Dispute form: Select charge, describe issue, submit
   - Status visible in billing section: "Dispute pending" / "Credit applied"

7. **Reconciliation handles disputes:**
   - `reconcile-billing` job includes dispute credits in totals
   - Ensures Stripe records match UsageEvents + BillingDispute credits
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

### Multi-Tenancy & Data Isolation

**Row-Level Security (RLS):**
Every table enforces tenant isolation at database level:
```sql
CREATE POLICY "coach_isolation" ON content FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "coach_isolation" ON conversations FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "coach_isolation" ON knowledge_items FOR ALL USING (coach_id = auth.uid());
-- Applied to ALL coach-scoped tables
```

**Defense in Depth:**
| Layer | Protection |
|-------|------------|
| Database | RLS policies on every table (even if app has bugs) |
| API | Validate `coach_id` matches JWT on every request |
| Cache | Redis keys namespaced: `coach:{id}:*` |
| Background Jobs | Jobs scoped to single `coach_id`, never batched across coaches |
| LLM Prompts | Context loaded per-coach, never mixed |

**Cross-Pollination Prevention:**
- Vector search queries always include `WHERE coach_id = $1`
- Memory consolidation runs per-coach in isolated transactions
- Embedding queries filtered before similarity calculation
- Logging scrubs PII; uses IDs only

**Personalized Agent Identity:**
Each coach can customize their agent:
- `agent_name` (default: "Juno", customizable)
- `agent_personality` (additional persona traits)
- Agent "remembers" coach via loaded context on each request

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

**Timeline Reality Check:**
This is an aggressive timeline for a solo founder. Priorities if behind schedule:
1. **Must ship:** Chat + content generation + manual posting (copy-paste workflow)
2. **Should ship:** Auto-posting + basic scheduling + moderation
3. **Can defer to post-MVP:** Knowledge base uploads, analytics dashboard, memory consolidation

**De-risking strategy:**
- Week 1-4: Build end-to-end slice (chat → content → manual post)
- Week 5-6: Add automation layer (scheduling, auto-post)
- Week 7-8: Hardening + billing (defer analytics if needed)

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

### Week 4: Content Generation + Memory + Knowledge Base
- [ ] Claude integration for content generation
- [ ] Voice learning from Instagram posts (or fallback data)
- [ ] Content preview and approval flow (web portal)
- [ ] **Tiered moderation (Green/Yellow/Red) + attestation flow**
- [ ] **Per-coach topic allow-lists**
- [ ] **Memory tables (using pgvector from Week 3)**
- [ ] **Voice model creation + anchor embeddings**
- [ ] **KnowledgeItem table + basic CRUD**
- [ ] **Note upload via chat (text only)**
- [ ] **Web portal file manager (basic)**
- [ ] **Start web chat fallback (using Supabase Realtime from Week 3)**
- [ ] **Degraded mode for personal IG accounts**

### Week 5: Chat Integration
- [ ] WhatsApp Business API integration (if approved)
- [ ] **Web chat interface (fallback, built regardless)**
- [ ] Conversation handling and state management (channel-agnostic)
- [ ] Deep links from chat to web portal
- [ ] Quick-reply buttons and proactive nudges

### Week 6: Instagram Posting + Undo + Knowledge Base
- [ ] Instagram posting via Graph API
- [ ] Content versioning (ContentRevision)
- [ ] Moderation re-check before posting
- [ ] Undo functionality with status states
- [ ] Posting failure handling and alerts
- [ ] **Feedback tracking (store edits with embeddings)**
- [ ] **Lesson extraction from coach edits**
- [ ] **Image/PDF upload + processing (AI description, text extraction)**
- [ ] **Client/Program/Testimonial tables**
- [ ] **Auto-context retrieval in content generation**
- [ ] **Pinning + access tracking**

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

## Agent Skills Architecture

Juno's capabilities are organized as discrete, composable skills. Each skill has defined inputs, outputs, side effects, and risk levels. Skills can be chained together to accomplish complex tasks.

### Design Philosophy

Coaches are **solo founders running service businesses**. They need:
- **Marketing** to get clients
- **Sales** to close clients
- **Operations** to serve clients
- **Strategy** to grow sustainably

Skills are sourced from proven frameworks:
- [Marketing Skills](https://github.com/coreyhaines31/marketingskills) - 40+ conversion & growth skills
- [Lenny Skills](https://github.com/RefoundAI/lenny-skills) - 86 product/business skills from Lenny's Podcast

### Skill Categories Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           JUNO SKILL ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        STRATEGY & PLANNING                            │  │
│  │  Vision • Goals/OKRs • Roadmap • Competitive Analysis • Positioning  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│          ┌─────────────────────────┼─────────────────────────┐             │
│          │                         │                         │             │
│          ▼                         ▼                         ▼             │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐       │
│  │  MARKETING   │         │    SALES     │         │  OPERATIONS  │       │
│  │              │         │              │         │              │       │
│  │ • Content    │         │ • Pipeline   │         │ • Clients    │       │
│  │ • SEO        │         │ • Outreach   │         │ • Programs   │       │
│  │ • Paid Ads   │         │ • Proposals  │         │ • Calendar   │       │
│  │ • Email      │         │ • Follow-up  │         │ • Payments   │       │
│  │ • Social     │         │ • Objections │         │ • Delivery   │       │
│  └──────────────┘         └──────────────┘         └──────────────┘       │
│          │                         │                         │             │
│          └─────────────────────────┼─────────────────────────┘             │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      MEASUREMENT & LEARNING                           │  │
│  │  Analytics • A/B Testing • Feedback • Retrospectives • Optimization  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         INTEGRATIONS LAYER                            │  │
│  │  Google Workspace • Stripe • Instagram • WhatsApp • Canva            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Skill Definition Schema

```typescript
interface Skill {
  name: string;                    // Unique identifier
  category: SkillCategory;         // Strategy, Marketing, Sales, etc.
  description: string;             // For LLM to understand when to use
  parameters: JSONSchema;          // Structured input
  returns: JSONSchema;             // Structured output

  // Execution control
  requires_approval: boolean;      // Coach must confirm?
  confidence_threshold: number;    // Auto-execute above this (0-1)
  risk_level: 'none' | 'low' | 'medium' | 'high' | 'critical';
  undo_capable: boolean;           // Can be reversed?

  // Dependencies
  required_integrations: string[]; // ['instagram', 'stripe', etc.]
  required_scopes: string[];       // OAuth scopes needed
  depends_on_skills: string[];     // Other skills this may call

  // Metadata
  side_effects: string[];          // What external systems it touches
  mvp_priority: 'mvp' | 'post-mvp' | 'future';
  estimated_tokens: number;        // Typical token usage
}
```

---

### 1. STRATEGY & PLANNING SKILLS

| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `define_vision` | Create compelling business direction | None | Post-MVP | None |
| `set_okrs` | Establish quarterly objectives/key results | None | Post-MVP | Google Docs |
| `working_backwards` | Amazon-style outcome-first planning | None | Post-MVP | None |
| `problem_definition` | Clarify problems before solutions | None | MVP | None |
| `competitive_analysis` | Analyze competitor strategies | None | Post-MVP | None |
| `positioning_messaging` | Craft differentiated positioning | None | Post-MVP | None |
| `positioning_angles` | Find compelling selling angles | None | MVP | None |
| `pricing_strategy` | Design pricing models | None | Post-MVP | Stripe |
| `prioritize_roadmap` | Decide what to focus on | None | Post-MVP | None |
| `planning_under_uncertainty` | Plan when outcomes unclear | None | Future | None |
| `evaluating_tradeoffs` | Make better decisions | None | Post-MVP | None |
| `brand_voice_extract` | Extract voice from existing content | None | MVP | Instagram |

**MVP Strategy Skills:** `problem_definition`, `positioning_angles`, `brand_voice_extract`

---

### 2. MARKETING SKILLS

#### Content Creation (MVP Priority)
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `generate_caption` | Instagram captions with coach voice | None | MVP | None |
| `generate_carousel` | Multi-slide educational content | None | MVP | Canva |
| `generate_reel_script` | Short-form video scripts | None | MVP | None |
| `generate_story_sequence` | Connected Stories content | None | MVP | None |
| `repurpose_content` | Transform content across formats | None | MVP | None |
| `suggest_topics` | Generate content ideas | None | MVP | None |
| `humanize_content` | Remove AI-sounding patterns | None | MVP | None |

#### Publishing (MVP Priority)
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `schedule_post` | Queue for future publishing | Low | MVP | Instagram, Inngest |
| `publish_now` | Immediate publish | Medium | MVP | Instagram |
| `delete_post` | Remove published content | High | MVP | Instagram |
| `get_post_status` | Check publishing state | None | MVP | Instagram |

#### SEO & Discovery
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `keyword_research` | Find content opportunities | None | Post-MVP | None |
| `ai_seo` | Optimize for AI search engines | None | Future | None |
| `seo_content` | SEO-optimized long-form | None | Future | Google Docs |
| `find_trending_topics` | Current trends in niche | None | Post-MVP | None |
| `find_hashtags` | Research relevant hashtags | None | MVP | Instagram |

#### Email Marketing
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `email_sequence` | Build automated email flows | Low | Post-MVP | Gmail |
| `draft_email` | Compose email | None | Post-MVP | Gmail |
| `send_email` | Send email | Medium | Post-MVP | Gmail |
| `cold_email` | B2B outreach sequences | Low | Future | Gmail |
| `lead_magnet` | Create list-building assets | None | Post-MVP | Google Docs |
| `newsletter` | Email newsletter content | None | Post-MVP | Gmail |

#### Paid & Distribution
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `paid_ads_strategy` | Ad campaign planning | None | Future | Meta Ads |
| `ad_creative` | Generate ad variations | None | Future | None |
| `launch_strategy` | Product launch planning | None | Post-MVP | None |
| `launch_marketing` | Execute launch sequence | Medium | Post-MVP | Multiple |

#### Conversion Optimization
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `page_cro` | Landing page optimization | None | Future | None |
| `signup_flow_cro` | Registration optimization | None | Future | None |
| `direct_response_copy` | Copy that converts | None | Post-MVP | None |

#### Growth & Retention
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `designing_growth_loops` | Build viral mechanics | None | Future | None |
| `retention_engagement` | Reduce churn strategies | None | Post-MVP | None |
| `churn_prevention` | Save cancellations | Low | Post-MVP | Stripe |
| `referral_program` | Word-of-mouth setup | Low | Future | Stripe |

**MVP Marketing Skills:** `generate_caption`, `generate_carousel`, `generate_reel_script`, `generate_story_sequence`, `repurpose_content`, `suggest_topics`, `humanize_content`, `schedule_post`, `publish_now`, `delete_post`, `get_post_status`, `find_hashtags`

---

### 3. SALES SKILLS

#### Pipeline Management
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `qualify_lead` | Assess lead fit | None | Post-MVP | None |
| `move_pipeline_stage` | Update lead status | Low | Post-MVP | None |
| `get_pipeline_status` | View sales funnel | None | Post-MVP | None |
| `forecast_revenue` | Project future income | None | Post-MVP | Stripe |

#### Outreach & Follow-up
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `draft_dm_response` | Reply to inquiries | None | MVP | Instagram |
| `send_dm` | Send direct message | Medium | Post-MVP | Instagram |
| `send_pricing` | Share program info | Low | Post-MVP | None |
| `create_follow_up` | Generate follow-up message | None | Post-MVP | None |
| `send_follow_up` | Execute follow-up | Medium | Post-MVP | Instagram, Gmail |
| `schedule_discovery_call` | Book sales calls | Low | Post-MVP | Google Calendar |

#### Proposals & Closing
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `create_proposal` | Custom proposals | None | Post-MVP | Google Docs |
| `send_proposal` | Deliver proposal | Medium | Post-MVP | Gmail |
| `handle_objection` | Overcome hesitations | None | Post-MVP | None |
| `founder_sales` | Close first customers | None | Post-MVP | None |

**MVP Sales Skills:** `draft_dm_response`

---

### 4. CLIENT OPERATIONS SKILLS

#### Client Management
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `onboard_client` | Start client journey | Medium | Post-MVP | Multiple |
| `send_check_in` | Proactive check-ins | Low | Post-MVP | WhatsApp, Gmail |
| `log_progress` | Track client metrics | Low | Post-MVP | Google Sheets |
| `get_client_history` | Retrieve client context | None | Post-MVP | None |
| `update_client_goals` | Modify objectives | Low | Post-MVP | None |
| `flag_at_risk` | Identify struggling clients | None | Post-MVP | None |
| `suggest_intervention` | Recommend re-engagement | None | Post-MVP | None |
| `celebrate_milestone` | Acknowledge wins | Low | Post-MVP | WhatsApp, Instagram |

#### Session Management
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `schedule_session` | Book coaching session | Low | MVP | Google Calendar |
| `reschedule_session` | Move existing session | Medium | MVP | Google Calendar |
| `cancel_session` | Cancel with policy check | High | MVP | Google Calendar |
| `send_session_reminder` | Pre-session nudge | Low | Post-MVP | WhatsApp |
| `send_session_recap` | Post-session summary | Low | Post-MVP | Gmail |

#### Program Delivery
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `generate_workout` | Create workout plans | None | Post-MVP | None |
| `generate_meal_plan` | Create nutrition plans | None | Post-MVP | None |
| `send_weekly_plan` | Deliver program content | Medium | Post-MVP | WhatsApp, Gmail |
| `adjust_program` | Modify based on feedback | Low | Post-MVP | None |
| `answer_program_question` | Explain exercise/nutrition | None | Post-MVP | WhatsApp |

**MVP Client Ops Skills:** `schedule_session`, `reschedule_session`, `cancel_session`

---

### 5. PAYMENTS & BILLING SKILLS (Stripe Integration)

| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `create_invoice` | Generate invoice | Medium | MVP | Stripe |
| `send_invoice` | Deliver via email | Medium | MVP | Stripe, Gmail |
| `get_payment_status` | Check payment state | None | MVP | Stripe |
| `send_payment_reminder` | Chase overdue | Medium | Post-MVP | Stripe, Gmail |
| `create_subscription` | Set up recurring billing | High | Post-MVP | Stripe |
| `pause_subscription` | Temporary hold | High | Post-MVP | Stripe |
| `cancel_subscription` | End billing | Critical | Post-MVP | Stripe |
| `process_refund` | Issue refunds | Critical | Post-MVP | Stripe |
| `calculate_revenue` | Revenue reporting | None | MVP | Stripe |
| `get_mrr` | Monthly recurring revenue | None | Post-MVP | Stripe |
| `log_expense` | Track expenses | Low | Future | Google Sheets |

**MVP Billing Skills:** `create_invoice`, `send_invoice`, `get_payment_status`, `calculate_revenue`

---

### 6. CALENDAR & SCHEDULING SKILLS (Google Calendar)

| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `get_availability` | Find open slots | None | MVP | Google Calendar |
| `create_event` | Add calendar entry | Low | MVP | Google Calendar |
| `update_event` | Modify calendar entry | Medium | MVP | Google Calendar |
| `delete_event` | Remove calendar entry | High | MVP | Google Calendar |
| `find_conflicts` | Detect scheduling overlaps | None | MVP | Google Calendar |
| `suggest_reschedule` | Find alternative times | None | Post-MVP | Google Calendar |
| `block_time` | Reserve personal time | Low | Post-MVP | Google Calendar |
| `set_working_hours` | Define availability | Low | Post-MVP | None |
| `sync_external_calendar` | Pull external events | Medium | Post-MVP | Google Calendar |

**MVP Calendar Skills:** `get_availability`, `create_event`, `update_event`, `delete_event`, `find_conflicts`

---

### 7. COMMUNICATION SKILLS (Google Workspace)

#### Email (Gmail)
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `draft_email` | Compose email | None | Post-MVP | Gmail |
| `send_email` | Send email | Medium | Post-MVP | Gmail |
| `search_email` | Find emails | None | Post-MVP | Gmail |
| `summarize_thread` | Digest conversation | None | Post-MVP | Gmail |
| `batch_email` | Send to multiple | High | Future | Gmail |

#### Documents (Google Docs)
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `create_document` | New doc | Low | Post-MVP | Google Docs |
| `edit_document` | Modify doc | Low | Post-MVP | Google Docs |
| `share_document` | Share with client | Medium | Post-MVP | Google Docs |
| `generate_contract` | Client agreement | Low | Post-MVP | Google Docs |

#### Sheets (Google Sheets)
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `create_spreadsheet` | New sheet | Low | Post-MVP | Google Sheets |
| `update_spreadsheet` | Add data | Low | Post-MVP | Google Sheets |
| `generate_report` | Report from data | None | Post-MVP | Google Sheets |

#### Messaging
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `send_whatsapp` | Send WhatsApp message | Medium | MVP | WhatsApp |
| `send_reminder` | Time-triggered nudge | Low | MVP | WhatsApp, Inngest |
| `ask_question` | Request coach input | None | MVP | WhatsApp |
| `present_options` | Show choices | None | MVP | WhatsApp |

**MVP Communication Skills:** `send_whatsapp`, `send_reminder`, `ask_question`, `present_options`

---

### 8. ANALYTICS & MEASUREMENT SKILLS

| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `get_post_performance` | Single post metrics | None | MVP | Instagram |
| `get_growth_metrics` | Follower trends | None | Post-MVP | Instagram |
| `identify_top_content` | Best performers | None | MVP | Instagram |
| `compare_content` | A/B comparison | None | Post-MVP | Instagram |
| `find_best_posting_time` | Optimal schedule | None | Post-MVP | Instagram |
| `ab_test_setup` | Design experiments | None | Future | None |
| `generate_weekly_report` | Performance summary | None | Post-MVP | Multiple |
| `get_client_metrics` | Client progress dashboard | None | Post-MVP | None |
| `measuring_pmf` | Product-market fit | None | Future | None |

**MVP Analytics Skills:** `get_post_performance`, `identify_top_content`

---

### 9. LEARNING & IMPROVEMENT SKILLS

| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `run_retrospective` | Learn from past | None | Future | None |
| `gather_testimonials` | Collect social proof | None | Post-MVP | WhatsApp |
| `analyze_churn` | Why clients leave | None | Post-MVP | None |
| `suggest_improvements` | Recommendations | None | Post-MVP | None |
| `conducting_user_interviews` | Discovery prep | None | Future | None |
| `analyzing_user_feedback` | Synthesize feedback | None | Post-MVP | None |

---

### Skill Execution Engine

#### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SKILL EXECUTION ENGINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Coach Request (WhatsApp/Web)                                              │
│        │                                                                     │
│        ▼                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                        INTENT CLASSIFIER                             │  │
│   │   • Parse natural language request                                   │  │
│   │   • Identify required skills                                         │  │
│   │   • Check coach capabilities/integrations                            │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│        │                                                                     │
│        ▼                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                        SKILL PLANNER                                 │  │
│   │   • Decompose into skill chain                                       │  │
│   │   • Resolve dependencies                                             │  │
│   │   • Estimate confidence per step                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│        │                                                                     │
│        ▼                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                     APPROVAL GATE                                    │  │
│   │   • Check cumulative risk level                                      │  │
│   │   • If confidence < threshold → ask coach                            │  │
│   │   • If risk = critical → always ask                                  │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│        │                                                                     │
│        ├──────────────────────┬────────────────────┐                        │
│        ▼                      ▼                    ▼                        │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│   │ Auto-Execute │    │Execute+Notify│    │  Ask First   │                 │
│   │ (conf > 0.8) │    │(0.5 < c < 0.8)│   │ (c < 0.5)    │                 │
│   └──────────────┘    └──────────────┘    └──────────────┘                 │
│        │                      │                    │                        │
│        └──────────────────────┼────────────────────┘                        │
│                               ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                      SKILL EXECUTOR                                  │  │
│   │   • Execute skill with parameters                                    │  │
│   │   • Handle retries and errors                                        │  │
│   │   • Log to audit trail                                               │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│        │                                                                     │
│        ▼                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                     RESULT HANDLER                                   │  │
│   │   • Format response for coach                                        │  │
│   │   • Queue follow-up skills if needed                                 │  │
│   │   • Update memory with outcome                                       │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Skill Chain Example

```typescript
// Coach: "Create content about my 8-week program for this week"

const skillChain = {
  request: "Create content about my 8-week program for this week",
  plan: [
    { skill: "search_documents", params: { query: "8-week program" }, confidence: 1.0 },
    { skill: "find_testimonial", params: { program: "8-week" }, confidence: 0.9 },
    { skill: "recall_preference", params: { key: "posting_frequency" }, confidence: 1.0 },
    { skill: "generate_caption", params: { topic: "8-week", type: "promotional" }, confidence: 0.85, repeat: 5 },
    { skill: "present_options", params: { message: "Here are 5 posts for this week" }, confidence: 1.0 }
  ],
  cumulative_risk: "low",
  requires_approval: false,  // All skills are low/no risk
  estimated_tokens: 2500
};
```

#### Rollback & Undo

For skill chains with side effects:

```typescript
interface SkillExecution {
  execution_id: string;
  skill_chain: SkillStep[];
  executed_steps: {
    step_index: number;
    skill: string;
    result: any;
    undo_action?: UndoAction;  // How to reverse this step
    executed_at: timestamp;
  }[];
  status: 'planning' | 'executing' | 'completed' | 'failed' | 'rolled_back';
}

// If step 3 fails, rollback steps 2, 1 in reverse order
async function rollback(execution: SkillExecution) {
  for (const step of execution.executed_steps.reverse()) {
    if (step.undo_action) {
      await executeUndo(step.undo_action);
    }
  }
}
```

---

### Risk Classification & Approval Matrix

| Risk Level | Confidence Threshold | Approval Required | Examples |
|------------|---------------------|-------------------|----------|
| **None** | 0.0 (always auto) | Never | `generate_caption`, `get_availability`, `search_documents` |
| **Low** | 0.5 | If confidence < 0.5 | `schedule_post`, `send_check_in`, `create_event` |
| **Medium** | 0.8 | If confidence < 0.8 | `publish_now`, `send_dm`, `send_invoice` |
| **High** | 1.0 (always ask) | Always | `delete_post`, `cancel_session`, `delete_event` |
| **Critical** | 1.0 + confirmation | Always + confirm | `cancel_subscription`, `process_refund` |

---

### Integration Dependencies

#### Google Workspace
```typescript
const googleWorkspace = {
  gmail: {
    scopes: ['gmail.compose', 'gmail.readonly', 'gmail.send'],
    skills: ['draft_email', 'send_email', 'search_email', 'batch_email', 'summarize_thread']
  },
  calendar: {
    scopes: ['calendar.events', 'calendar.readonly'],
    skills: ['get_availability', 'create_event', 'update_event', 'delete_event',
             'find_conflicts', 'schedule_session', 'reschedule_session', 'cancel_session']
  },
  docs: {
    scopes: ['documents', 'drive.file'],
    skills: ['create_document', 'edit_document', 'share_document', 'generate_contract']
  },
  sheets: {
    scopes: ['spreadsheets', 'drive.file'],
    skills: ['create_spreadsheet', 'update_spreadsheet', 'generate_report', 'log_progress']
  }
};
```

#### Stripe
```typescript
const stripe = {
  scopes: ['invoices', 'subscriptions', 'customers', 'payment_intents', 'usage_records'],
  skills: [
    'create_invoice', 'send_invoice', 'get_payment_status', 'send_payment_reminder',
    'create_subscription', 'pause_subscription', 'cancel_subscription',
    'process_refund', 'calculate_revenue', 'get_mrr', 'forecast_revenue'
  ],
  webhooks: ['invoice.paid', 'invoice.payment_failed', 'customer.subscription.updated']
};
```

#### Instagram (Meta Graph API)
```typescript
const instagram = {
  scopes: ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement'],
  skills: [
    'publish_now', 'schedule_post', 'delete_post', 'get_post_status',
    'get_post_performance', 'get_growth_metrics', 'identify_top_content',
    'draft_dm_response', 'send_dm', 'find_hashtags', 'brand_voice_extract'
  ],
  account_types: {
    business_creator: ['all skills'],
    personal: ['draft_dm_response', 'generate_*']  // No publishing
  }
};
```

#### WhatsApp Business API
```typescript
const whatsapp = {
  skills: ['send_whatsapp', 'send_reminder', 'ask_question', 'present_options',
           'send_check_in', 'send_session_reminder', 'gather_testimonials'],
  message_types: ['text', 'interactive_buttons', 'interactive_list', 'template']
};
```

#### Canva Connect
```typescript
const canva = {
  scopes: ['design:read', 'design:write'],
  skills: ['generate_carousel'],  // Deep Canva template integration
  fallback: 'Manual template links if not connected'
};
```

---

### Skill Capability Matrix by Account Type

| Capability | Business IG | Personal IG | No IG |
|------------|-------------|-------------|-------|
| Content generation | ✓ | ✓ | ✓ |
| Schedule post | ✓ | ✗ → set_reminder | ✗ |
| Publish now | ✓ | ✗ → copy_to_clipboard | ✗ |
| Get analytics | ✓ | ✗ | ✗ |
| Voice learning (API) | ✓ | ✗ | ✗ |
| Voice learning (manual) | ✓ | ✓ | ✓ |
| DM responses | ✓ | ✓ | ✗ |

---

### MVP Skill Summary

**Total Skills: ~110**

| Category | MVP Skills | Post-MVP | Future |
|----------|-----------|----------|--------|
| Strategy | 3 | 6 | 3 |
| Marketing - Content | 12 | 5 | 0 |
| Marketing - SEO | 2 | 3 | 2 |
| Marketing - Email | 0 | 5 | 2 |
| Marketing - Paid | 0 | 2 | 3 |
| Marketing - Growth | 0 | 3 | 3 |
| Sales | 1 | 9 | 0 |
| Client Ops | 3 | 15 | 0 |
| Billing | 4 | 7 | 1 |
| Calendar | 5 | 4 | 0 |
| Communication | 4 | 8 | 1 |
| Analytics | 2 | 6 | 2 |
| Learning | 0 | 4 | 2 |
| **Total** | **36** | **77** | **19** |

**MVP Integrations Required:**
- Instagram Graph API (Business/Creator accounts)
- Google Calendar
- Stripe (basic invoicing)
- WhatsApp Business API (or web chat fallback)

**Post-MVP Integrations:**
- Gmail
- Google Docs
- Google Sheets
- Canva Connect
- Full Stripe (subscriptions)

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
