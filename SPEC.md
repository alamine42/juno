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
| Timeline | 8 weeks to MVP (revised) |

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

### 4. Web Portal (MVP Addition)
**Goal:** Handle OAuth flows and provide rich content review interface

The web portal is a lightweight companion to WhatsApp, not a full dashboard replacement.

**Core Functions:**
- OAuth flows for Instagram, Google Calendar, Canva (WhatsApp cannot handle these)
- Content preview and approval for carousels, multi-image posts
- Calendar view of scheduled content
- Activity log and audit trail browser
- Basic analytics display
- Account settings and billing management

**UX Flow:**
1. Coach signs up via web portal (email/magic link)
2. Connects Instagram, Google Calendar via OAuth
3. Links WhatsApp number
4. Day-to-day interaction happens in WhatsApp
5. WhatsApp sends deep links to portal for rich reviews

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
**Detection Pipeline (runs before any content is scheduled/posted):**
1. **Keyword/regex scan:** Flag terms like "weight loss", "cure", "treatment", "anxiety", "depression", mental health terms
2. **LLM classification:** Claude Haiku classifies content as sensitive/not-sensitive with confidence score
3. **Decision logic:**
   - High confidence not-sensitive: Proceed with normal autonomy rules
   - Any other result: Flag for coach review, never auto-post
4. **Store classification:** Log category, confidence, and decision in ContentModeration table

**Categories flagged:**
- Health claims (nutrition, weight, medical)
- Mental health topics
- Before/after transformations
- Supplement recommendations
- Injury/pain advice

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

**Undo Limitations (surfaced in UX):**
- Stories cannot be undone after posting
- External caches may retain deleted content briefly
- Coach notified when undo is partial or impossible

### Silence Handling
- If coach unresponsive for 72+ hours:
  - Pause non-critical automations
  - Send check-in message via WhatsApp
  - Continue only pre-approved scheduled content
  - After 7 days: Pause all automations, send email alert

---

## Onboarding Flow

### Phase 1: Web Portal (Account Setup)
1. **Sign up:** Email + magic link authentication
2. **Goal-setting:** Quick questionnaire about business goals, challenges
3. **OAuth connections:** Link Instagram (required), Google Calendar (optional)
4. **Phone verification:** Link WhatsApp number for chat interface

### Phase 2: WhatsApp (Brand Discovery)
1. **Welcome message:** Juno introduces itself, confirms setup complete
2. **Brand discovery conversation:** Tone, values, target audience (conversational, not form)
3. **Content analysis:** Request permission to analyze recent Instagram posts
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
| Database | PostgreSQL |
| Cache/Realtime | Redis |
| Background Jobs | Inngest (or BullMQ + separate worker) |
| Hosting | Vercel (web) + Railway/Fly.io (workers) |
| WhatsApp | WhatsApp Business API (direct) |
| Payments | Stripe (subscriptions + usage metering) |
| AI Models | Multi-provider (best-of-breed routing) |

### Background Job Infrastructure (Critical)
**Why needed:** Autonomous posting, scheduled content, token refresh, silence detection, and calendar sync all require time-based execution outside of HTTP requests.

**Architecture:**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Vercel Edge    │────▶│  Redis Queue    │────▶│  Worker Process │
│  (API Routes)   │     │  (Job Storage)  │     │  (Railway/Fly)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Job Types:**
| Job | Trigger | Retry Policy |
|-----|---------|--------------|
| PostContent | Scheduled time reached | 3 retries, exponential backoff |
| RefreshToken | 7 days before expiry | 5 retries over 24 hours |
| SyncCalendar | Every 15 minutes | 3 retries |
| CheckSilence | Daily | No retry needed |
| SendReminder | Scheduled time | 3 retries |
| ProcessWebhook | Instagram/WhatsApp webhook | 5 retries |

**Failure Handling:**
- Dead letter queue for poison jobs
- Alert coach via WhatsApp if posting fails
- Alert via email if WhatsApp delivery fails
- Admin dashboard for job monitoring

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
- Conversation state management
- Tool/function definitions per task type

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
├── subscription_status
├── last_active_at
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

ContentRevision (NEW - for undo support)
├── id, content_id
├── version (incrementing integer)
├── text, media_urls[]
├── rendered_payload (JSON - exact API payload sent)
├── created_at
└── created_by (coach or system)

ContentModeration (NEW - for sensitive content)
├── id, content_id
├── category (health_claim, mental_health, transformation, etc.)
├── confidence_score
├── flagged (boolean)
├── reviewed_by_coach (boolean)
├── reviewed_at
└── created_at

Conversation
├── id, coach_id
├── messages[] (role, content, timestamp)
└── context (JSON - current task, pending actions)

Action
├── id, coach_id
├── type (post, schedule, message, etc.)
├── payload (JSON)
├── status (pending, executed, undone, failed)
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

UsageEvent (NEW - for billing metering)
├── id, coach_id
├── action_id (FK, nullable)
├── event_type (post_created, ai_interaction, etc.)
├── quantity (default 1)
├── billable (boolean)
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
```

---

## Pricing Model

### Hybrid: Base Subscription + Usage

**Base tier: $49/month**
- Up to 30 posts/month
- Basic scheduling
- WhatsApp access
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
1. Action executed → Write UsageEvent to database (billable: true)
2. If action undone → Write compensating UsageEvent (quantity: -1)
3. Daily batch job → Aggregate unbilled events per coach
4. Report to Stripe → Create Stripe Usage Records, mark events as reported
5. End of billing period → Stripe calculates overages

**Metering Rules:**
- Only "posted" content counts (not drafts or scheduled)
- Undone posts within 1 hour are not billed
- AI interactions counted per conversation turn, not per API call
- Failed posts are not billed

**Reconciliation:**
- Daily job compares UsageEvent totals with Stripe records
- Discrepancies logged and alerted
- Monthly reconciliation report for finance

### Payment Implementation
- Stripe Subscriptions for base
- Stripe Usage Records for metering
- Billing portal for self-serve management

---

## Analytics & Metrics

### Coach-Facing Dashboard (Web Portal)
- **Engagement metrics:** Likes, comments, shares, saves, follower growth
- **Content performance:** Best performing posts, optimal posting times
- **Activity log:** Everything Juno has done (with undo buttons)
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
- Proactive refresh: Job runs 7 days before token expiry
- Refresh failure: Alert coach via WhatsApp, then email
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
| WhatsApp Business API approval delays | Apply immediately; MVP launches with web chat fallback |
| Canva API approval delays | MVP works without Canva; manual template sharing as backup |
| Content quality inconsistent | Heavy investment in prompt engineering, feedback loops |
| Scope creep in timeline | Strict MVP scope, defer all "nice to haves" |
| Token expiration causes silent failures | Proactive refresh, multiple alert channels |
| Instagram rate limits | Implement backoff, queue posts, respect limits |

---

## MVP Milestones (Revised: 8 Weeks)

### Week 1: Foundation
- [ ] Next.js project setup with TypeScript
- [ ] PostgreSQL + Redis setup
- [ ] Auth system (magic link)
- [ ] Basic data models and migrations
- [ ] **Apply for WhatsApp Business API approval** (start immediately)
- [ ] **Apply for Canva Connect API access** (start immediately)

### Week 2: Web Portal Core
- [ ] Web portal: signup, login, settings
- [ ] OAuth integration: Instagram
- [ ] OAuth integration: Google Calendar
- [ ] Token storage and refresh infrastructure

### Week 3: Background Jobs + Scheduling
- [ ] Inngest/BullMQ worker setup on Railway
- [ ] Job types: PostContent, RefreshToken, SyncCalendar
- [ ] Content scheduling system
- [ ] Calendar sync implementation

### Week 4: Content Generation
- [ ] Claude integration for content generation
- [ ] Voice learning from existing Instagram posts
- [ ] Content preview and approval flow (web portal)
- [ ] Sensitive content detection pipeline

### Week 5: WhatsApp Integration
- [ ] WhatsApp Business API integration (or web chat fallback)
- [ ] Conversation handling and state management
- [ ] Deep links from WhatsApp to web portal
- [ ] Quick-reply buttons and proactive nudges

### Week 6: Instagram Posting + Undo
- [ ] Instagram posting via Graph API
- [ ] Content versioning (ContentRevision)
- [ ] Undo functionality
- [ ] Posting failure handling and alerts

### Week 7: Billing + Analytics
- [ ] Stripe subscription integration
- [ ] Usage metering pipeline
- [ ] Basic analytics dashboard
- [ ] Activity log with undo buttons

### Week 8: Hardening + Beta Launch
- [ ] End-to-end testing
- [ ] Error handling audit
- [ ] Security review
- [ ] Rate limiting
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
  └── Beta Coach Recruitment (start Week 4)
```

---

## Fallback Plans

| Integration | If Delayed | Fallback |
|-------------|------------|----------|
| WhatsApp Business API | Not approved by Week 5 | Launch with web-based chat interface |
| Canva Connect API | Not approved by Week 6 | Manual template links, no deep integration |
| Instagram Graph API | Rate limited | Queue posts, reduce frequency, alert coach |

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

---

## Open Questions (Updated)

1. ~~**WhatsApp Business API approval:** Timeline unclear—should we have a web chat fallback for day 1?~~ **RESOLVED:** Yes, web chat fallback is part of MVP plan.
2. ~~**Canva API access:** Requires Canva partner approval—backup plan if delayed?~~ **RESOLVED:** MVP works without Canva; manual template sharing.
3. **Instagram posting limits:** Need to research exact rate limits and implement backoff
4. **Beta coach recruitment:** How will we find the first 10 coaches? (Fitness influencer outreach? Paid ads? Personal network?)

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
*Status: Revised after design review - Ready for implementation*
