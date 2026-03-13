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
| Primary Interface | WhatsApp (chat-first) |
| Autonomy Level | Fully autonomous with guardrails |
| MVP Scope | Content creation + scheduling |
| Go-to-Market | Direct B2C to coaches |
| Personality | Encouraging business partner |
| Success Metric | 30-day retention |
| Timeline | 4-6 weeks to MVP |

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

### Sensitive Content Handling
- Health claims, nutrition advice, mental health topics → flagged for coach review
- Never auto-post sensitive content
- Automatic disclaimer insertion where appropriate

### Recovery & Audit Trail
- Full audit trail of every action
- One-click undo for any action
- Coach can revert posts, messages, or scheduled items

### Silence Handling
- If coach unresponsive for 72+ hours:
  - Pause non-critical automations
  - Send check-in message
  - Continue only scheduled/approved content

---

## Onboarding Flow

### First 10 Minutes
1. **Goal-setting conversation:** Understand business goals, challenges, what success looks like
2. **Brand discovery:** Questionnaire about tone, values, target audience
3. **Content analysis:** Ingest existing Instagram posts, website copy (if available)
4. **Quick win:** Generate 3-5 sample posts to demonstrate value
5. **Account connections:** Link Instagram, Google Calendar

### Ongoing Learning
- Track which edits coach makes to generated content
- Note which content performs best
- Refine voice model continuously

---

## Technical Architecture

### Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js (TypeScript) |
| Backend | Next.js API Routes |
| Database | PostgreSQL |
| Cache/Realtime | Redis |
| Hosting | Vercel |
| WhatsApp | WhatsApp Business API (direct) |
| Payments | Stripe (subscriptions + usage metering) |
| AI Models | Multi-provider (best-of-breed routing) |

### AI Model Strategy
Route tasks to optimal model:
- **Content generation:** Claude (nuanced writing, brand voice)
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
├── brand_voice (JSON - tone, values, vocabulary)
├── business_goals (JSON)
├── connected_accounts[]
└── subscription_status

Content
├── id, coach_id
├── type (post, reel, story, carousel)
├── text, media_urls[]
├── status (draft, scheduled, posted, failed)
├── scheduled_at, posted_at
├── platform (instagram)
└── performance_metrics (JSON)

Conversation
├── id, coach_id
├── messages[] (role, content, timestamp)
└── context (JSON - current task, pending actions)

Action
├── id, coach_id
├── type (post, schedule, message, etc.)
├── payload (JSON)
├── status (pending, executed, undone)
├── confidence_score
├── executed_at
└── undone_at

CalendarEvent
├── id, coach_id
├── external_id (Google Calendar ID)
├── title, start, end
├── type (client_session, blocked, available)
└── synced_at
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

### Payment Implementation
- Stripe Subscriptions for base
- Stripe Usage Records for metering
- Billing portal for self-serve management

---

## Analytics & Metrics

### Coach-Facing Dashboard
- **Engagement metrics:** Likes, comments, shares, saves, follower growth
- **Content performance:** Best performing posts, optimal posting times
- **Activity log:** Everything Juno has done
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
- No storage of payment credentials (Stripe handles)
- Audit logging for all actions

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
| WhatsApp Business API approval delays | Apply early, have SMS fallback ready |
| Content quality inconsistent | Heavy investment in prompt engineering, feedback loops |
| Scope creep in 4-6 week timeline | Strict MVP scope, defer all "nice to haves" |

---

## MVP Milestones

### Week 1-2: Foundation
- [ ] Next.js project setup with TypeScript
- [ ] PostgreSQL + Redis setup
- [ ] Auth system (email/password or magic link)
- [ ] Basic coach onboarding flow
- [ ] WhatsApp Business API integration

### Week 3-4: Core Features
- [ ] Content generation engine (Claude integration)
- [ ] Instagram posting integration
- [ ] Content scheduling system
- [ ] Google Calendar sync
- [ ] Basic chat conversation handling

### Week 5-6: Polish & Launch
- [ ] Canva integration for templates
- [ ] Audit trail and undo functionality
- [ ] Stripe billing integration
- [ ] Analytics dashboard (basic)
- [ ] Guardrails and confidence scoring
- [ ] Beta launch with 5-10 coaches

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

## Open Questions

1. **WhatsApp Business API approval:** Timeline unclear—should we have a web chat fallback for day 1?
2. **Canva API access:** Requires Canva partner approval—backup plan if delayed?
3. **Instagram posting limits:** Need to research rate limits and content policies
4. **Beta coach recruitment:** How will we find the first 10 coaches?

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
