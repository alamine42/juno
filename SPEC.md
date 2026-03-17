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
| Primary Interface | **Web chat (MVP)** → WhatsApp (post-MVP) |
| Autonomy Level | **Manual copy/paste (MVP)** → Autonomous with guardrails (post-MVP) |
| MVP Scope | **5 skills: generate/edit caption, save draft, reminder, chat** |
| Go-to-Market | Direct B2C to coaches |
| Personality | Encouraging business partner |
| Success Metric | 30-day retention |
| Timeline | **4 weeks to TRUE MVP** (free beta) |
| **Background Jobs** | **None (MVP)** → Inngest (post-MVP) |

---

## Feature Vision (Post-MVP Roadmap)

> **⚠️ NOTE:** This section describes the FULL PRODUCT VISION, not the TRUE MINIMUM MVP.
> For the actual MVP scope (4 weeks, 5 skills, manual posting), see **"TRUE MINIMUM MVP"** section below.

### 1. Content Creation (Post-MVP)
**Goal:** Generate high-quality, on-brand content for Instagram

- **Text content:** Captions, carousel scripts, Reels scripts, Stories copy
- **Voice learning:** Analyze existing content + onboarding questionnaire, refine via feedback loop
- **Canva integration:** Generate text, provide Canva templates for visual design
- **Content types:** Educational posts, client wins, behind-the-scenes, promotional, engagement hooks

**Deferred to post-MVP:**
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
- `scheduler-sweep` runs every 10 minutes
- Queries posts using indexed UTC column: `WHERE desired_execution_at BETWEEN now() AND now() + interval '2 hours'`
- For each post: Check if Inngest timer exists and is correct
- If no timer or DST shifted the time → create/update timer
- Ensures posts scheduled minutes ahead are never missed
- **Timer window matches Path A:** Both paths use 2-hour window (no blind spots)

**⚠️ SINGLE SOURCE OF TRUTH: `scheduled_posts` table (NOT Content table)**

All scheduling data lives in `scheduled_posts`. The `Content` table only stores `status` (draft/scheduled/posted/failed) and references `scheduled_posts` via `content_id`. This prevents divergence.

**Scheduling Flow:**
  1. Coach approves post for "Tuesday 9am" → Write to `scheduled_posts`:
     - `scheduled_local_time` + `scheduled_date` + `scheduled_timezone` (for UX display)
     - `desired_execution_at` (UTC, computed, indexed - for sweep queries)
     - `timer_status` (pending/dispatched/executed/failed)
  2. Update `Content.status = 'scheduled'` (no scheduling fields on Content)
  3. **Immediately** fire Inngest timer (Path A) if within 2 hours
  4. Sweep validates and corrects if needed (Path B)
  5. **Clarification on 2-hour limit:** Coaches CAN schedule posts for any future date (weekly calendar). The 2-hour limit applies only to *materializing Inngest timers*—we don't create timers for posts >2 hours away. The sweep continuously materializes timers as posts enter the 2-hour window.
  6. **Timezone snapshot:** `scheduled_timezone` is captured at approval time and never changes. If coach travels or updates their profile timezone, already-scheduled posts are unaffected.

**DST Monitor Job (explicit mechanism):**
DST transitions can shift post times by ±1 hour. The 2-hour sweep window is too late for user notification.

```
dst-monitor job (runs daily at 00:00 UTC):
  1. Check IANA timezone database for upcoming DST transitions (next 7 days)
  2. For each affected timezone:
     - Query: SELECT * FROM scheduled_posts WHERE scheduled_timezone = $tz AND desired_execution_at > now()
     - Recompute desired_execution_at from local time + new offset
     - If changed: Update row with new desired_execution_at, increment schedule_version
     - Create new Inngest timer with new time (old timer becomes stale)
  3. Send summary to affected coaches: "3 posts shifted by 1 hour due to DST"
  4. Log all changes for audit
```

**⚠️ CRITICAL: Timer Immutability Pattern**
Inngest delayed events CANNOT be cancelled after `inngest.send()`. Instead, we enforce cancellation at execution time:

```sql
-- Add version tracking to scheduled_posts
ALTER TABLE scheduled_posts ADD COLUMN schedule_version INTEGER DEFAULT 1;
ALTER TABLE scheduled_posts ADD COLUMN execution_id UUID;
```

```typescript
// PostContent handler - execution-time guard
async function executePost(event: { postId: string, expectedVersion: number, expectedTime: Date }) {
  const result = await db.query(`
    SELECT * FROM scheduled_posts
    WHERE id = $1
    FOR UPDATE SKIP LOCKED
  `, [event.postId]);

  const post = result.rows[0];
  if (!post) return; // Already claimed by another worker

  // Guard: Only execute if version and time match
  if (post.schedule_version !== event.expectedVersion) {
    console.log('Stale timer, skipping (version mismatch)');
    return;
  }
  if (post.desired_execution_at.getTime() !== event.expectedTime.getTime()) {
    console.log('Stale timer, skipping (time mismatch)');
    return;
  }
  if (post.timer_status !== 'pending') {
    console.log('Already executed or failed');
    return;
  }

  // Claim the post
  const executionId = crypto.randomUUID();
  await db.query(`
    UPDATE scheduled_posts
    SET timer_status = 'executing', execution_id = $2
    WHERE id = $1
  `, [event.postId, executionId]);

  // Execute and mark complete
  await postToInstagram(post);
  await db.query(`
    UPDATE scheduled_posts
    SET timer_status = 'executed', executed_at = NOW()
    WHERE id = $1
  `, [event.postId]);
}
```

- For per-coach events (reminders, silence checks): Same pattern - store local + UTC, materialize timers just-in-time

**Calendar Sync Conflict Resolution:**
- Fetch current calendar state with ETags before writing
- Detect overlaps between incoming changes and existing events
- Conflict states: `synced`, `pending_review`, `conflict_detected`, `error`
- On conflict: Hold pending changes, surface in WhatsApp/portal as "needs attention"
- Coach resolves: "Keep mine", "Accept external", or "Merge" (shift times)
- Never silently overwrite client sessions

**Incremental Sync Strategy (Google Calendar):**
- **syncToken:** Store per-coach `syncToken` from Google Calendar API
- **Incremental fetch:** On each sync, use `syncToken` to get only changed events
- **Full resync trigger:** If `syncToken` invalid (410 error), perform full calendar resync
- **Missed deletions:** Incremental sync includes deleted events; apply locally
- **Duplicate detection:** Store `external_id` (Google event ID) + `etag` per event

**Bidirectional Sync Flow:**
```
Juno → Google: Use INSERT/UPDATE with If-Match ETag header
Google → Juno: Push notification (webhook) OR periodic poll with syncToken
              │
              ├── Event created → Create local record with external_id
              ├── Event updated → Compare etag, update if changed
              └── Event deleted → Soft-delete local record
```

**Webhook Failure Recovery:**
- Google push notifications can fail silently
- Fallback: Poll every 5 minutes if no webhook received in 15 minutes
- On poll, use syncToken for efficient delta
- If persistent webhook failures: Alert coach, offer manual sync button

**Audit Trail:**
- Log all calendar sync operations with `sync_direction` (inbound/outbound)
- On conflict resolution, log coach's choice for audit
- If event "reappears" after deletion: Show in activity log with explanation

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
**Goal:** Provide functional Juno experience without WhatsApp dependency

If WhatsApp Business API approval is delayed, the web portal includes a native chat interface.

**⚠️ This is a FUNCTIONAL FALLBACK, not full parity.** WhatsApp offers better notification reliability, voice messages, and always-on accessibility. Web chat covers core workflows but has limitations.

**Features (functional coverage):**
- Real-time chat with Juno in browser
- Quick-action buttons (same as WhatsApp quick replies)
- Proactive nudges via browser notifications (with permission)
- Deep links to content review, calendar, analytics
- Mobile-responsive design for on-the-go use
- Push notifications for scheduled post confirmations

**Known Limitations vs WhatsApp:**
| Feature | WhatsApp | Web Chat |
|---------|----------|----------|
| Push reliability | High (always delivered) | Medium (browser must be open or allow push) |
| Voice messages | Supported | Not supported |
| Offline access | Full (queued messages) | Limited (localStorage queue) |
| Response time | Instant | ~500ms latency |
| Phone lock screen | Notifications appear | Requires browser open |

**⚠️ AUTONOMY DOWNGRADE (Web Chat Only Mode):**
When WhatsApp is unavailable and coach is using web chat only, reduce autonomy to prevent missed critical alerts:

| Feature | With WhatsApp | Web Chat Only (MVP) |
|---------|---------------|---------------------|
| Auto-posting | Enabled (Green tier) | **Disabled** - require explicit portal approval |
| Proactive nudges | Sent immediately | **Paused** - batch into daily email digest |
| Critical alerts (token expiry, moderation) | WhatsApp + email | **Email only** (SMS post-MVP) |
| Time-sensitive approvals | WhatsApp quick reply | **Email with 1-click approve link** |
| Silence handling | 72h threshold | **Disabled** - no auto-pause |

**⚠️ MVP ALERT CHANNEL: EMAIL ONLY**
SMS is NOT enabled for MVP. Critical alerts use email with:
- Subject: "🚨 Juno needs your attention: [issue type]"
- One-click action links in email body
- 15-minute retry if no action taken
- Escalation to portal banner on next login

**Why downgrade autonomy:**
- Web chat cannot guarantee delivery to locked phone
- Missing a moderation warning could auto-post unreviewed content
- Missing token expiry alert could cause silent posting failures
- Better to require explicit action than risk silent failures

**Re-enable full autonomy:** When coach connects WhatsApp OR installs PWA with verified push notifications.

**Enforcement Mechanism (`can_auto_post` flag):**
```sql
-- Coach table includes capability flags
Coach.can_auto_post BOOLEAN DEFAULT false
Coach.auto_post_enabled_reason VARCHAR -- 'whatsapp_connected', 'pwa_push_verified'
```

**Flag checked at multiple points:**
1. **Approval time:** When coach approves content for scheduling
   - If `can_auto_post = false`: Create reminder instead of timer, show "Manual posting required"
   - If `can_auto_post = true`: Create Inngest timer normally

2. **Posting job (all paths - Inngest, Vercel cron, Railway):**
   ```
   PostContent job:
     1. Fetch coach.can_auto_post
     2. If false: Skip posting, create reminder, notify coach "Please post manually"
     3. If true: Proceed with Instagram API post
   ```

3. **Sweep job:** Skip timer creation for coaches with `can_auto_post = false`

**Flag transitions:**
| Event | Action |
|-------|--------|
| WhatsApp connected + verified | Set `can_auto_post = true` |
| WhatsApp disconnected/revoked | Set `can_auto_post = false` |
| PWA push permission granted + test successful | Set `can_auto_post = true` |
| PWA push permission revoked | Set `can_auto_post = false` |
| Coach manually disables | Set `can_auto_post = false` |

**Reminder Infrastructure (for degraded mode):**
When `can_auto_post = false`, Juno creates reminders instead of posting timers.

```sql
-- Reminders table
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,

  -- Timing
  remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
  remind_timezone VARCHAR(50), -- e.g., 'America/New_York'

  -- Delivery
  channel VARCHAR(20) NOT NULL, -- 'email', 'push', 'sms', 'in_app'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'dismissed', 'actioned'

  -- Tracking
  sent_at TIMESTAMP WITH TIME ZONE,
  actioned_at TIMESTAMP WITH TIME ZONE, -- When coach clicked "Posted" or "Skip"
  failure_reason TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reminders_pending ON reminders (remind_at) WHERE status = 'pending';
```

**Reminder Lifecycle:**
1. **Creation:** When coach approves content with `can_auto_post = false`
   - Create `Reminder` row with `remind_at` = scheduled time - 15 min
   - Set `channel = 'email'` (MVP), later: 'push' or 'sms' based on preferences
   - Content.status = 'reminder_set' (not 'scheduled')

2. **Delivery (background job, every 1 min):**
   ```
   reminder-sender job:
     1. Query: SELECT * FROM reminders WHERE status = 'pending' AND remind_at <= NOW()
     2. For each reminder:
        - Send via channel (email with "Time to post!" + content preview + copy button)
        - Update status = 'sent', sent_at = NOW()
        - If send fails: status = 'failed', failure_reason = error
   ```

3. **Action tracking:**
   - Email includes: "I posted it" button → updates `actioned_at`, Content.status = 'posted_manually'
   - Email includes: "Skip" button → updates status = 'dismissed'
   - Web portal shows pending reminders in "To Post" queue

4. **Reconciliation with Content.status:**
   | Reminder Status | Content Status | Next Action |
   |-----------------|----------------|-------------|
   | pending | reminder_set | Wait for remind_at |
   | sent | reminder_set | Wait for coach action |
   | actioned | posted_manually | Archive content |
   | dismissed | draft | Return to drafts |
   | failed | reminder_set | Retry or alert |

**Email Template (MVP):**
```
Subject: Time to post: [Content title preview]

Hey [Coach name],

Your scheduled post is ready to go live!

[Content preview - first 280 chars]

[COPY TO CLIPBOARD] button
[OPEN INSTAGRAM] button

---
[I POSTED IT] | [SKIP THIS ONE] | [RESCHEDULE]
```

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

**Accessibility Requirements (Web Chat):**
- **Keyboard navigation:** All quick-reply buttons accessible via Tab, activated via Enter/Space
  - Keyboard shortcuts: `Ctrl+Enter` to send, `Escape` to cancel pending action
  - Quick reply grid: Arrow keys navigate between buttons
- **Screen reader support:** ARIA roles (`role="log"` for message list, `role="button"` for actions)
  - `aria-live="polite"` region for new messages and typing indicators
  - `aria-label` on quick reply buttons with full action description
  - Message timestamps announced: "Juno, 2 minutes ago"
  - Attachments: `alt` text for images, file descriptions for documents
- **Focus management:** Auto-focus input after sending; announce new messages to screen readers
  - Quick reply insertion: Focus moves to input field after selection
  - Error states: Focus moves to error banner with action buttons
- **High contrast mode:** Respect `prefers-contrast` media query
  - Color contrast ratio ≥4.5:1 for all text (WCAG AA)
  - Banner colors tested for accessibility (red/yellow/green with text alternatives)
- **Reduced motion:** Respect `prefers-reduced-motion` for typing indicators, animations
- **Notification accessibility:**
  - When browser push denied: Screen reader announcement of fallback options
  - Email notification fallback text includes full context (not just "tap to open")

**UI States (explicitly defined):**
| State | Visual | Behavior |
|-------|--------|----------|
| Loading history | Skeleton messages | Fetch last 50 messages, then paginate |
| Empty conversation | Welcome message + suggested actions | Show "Ask Juno anything" prompt |
| Sending message | Optimistic UI + spinner | Rollback on error |
| Send failed | Red badge + "Retry" button | Queue offline, retry on reconnect |
| Connection lost | Yellow banner "Reconnecting..." | Auto-retry with backoff, fall back to polling |
| Juno typing | Animated dots | `aria-live="polite"` for screen readers |

**Offline & Resilience:**
- **Message queue:** If offline, queue messages in localStorage, send on reconnect
- **Retry banner:** "Some messages couldn't send. [Retry] [Discard]"
- **Reconnection:** Exponential backoff (1s, 2s, 4s, max 30s), auto-reconnect on network change
- **Stale tab:** If tab inactive >5 min and reconnects, fetch missed messages before resuming

**Message Ordering (Multi-Device & Offline Sync):**
Problem: Coach queues messages offline, reconnects on multiple devices → order breaks.

**Client-Side Sequence Numbers:**
- Each client generates local sequence number per queued message: `{ client_id, client_seq, content }`
- On reconnect, send queue in order with sequence numbers
- Server enforces ordering within same `client_id`

**Server-Side Handling:**
```
Message received → Check (conversation_id, client_id, client_seq)
       │
       ├── If client_seq already exists → Duplicate, ignore (idempotent)
       │
       ├── If client_seq is next expected → Insert, increment expected
       │
       └── If client_seq is future → Hold in buffer, wait for missing seqs (up to 30s)
                                    → If timeout, insert anyway with gap marker
```

**Per-Device Queue Flush:**
- On reconnect, send `queue_flush_start` event with device ID
- Send all queued messages
- Send `queue_flush_end` event
- Server acknowledges: "5 messages received from device X"
- Client clears localStorage queue only after acknowledgment

**Quick Reply State:**
- Quick reply buttons include `context_message_id` they reference
- If context message is stale (different from current state), disable button with "Options have changed"

**Notification Fallbacks:**
- If browser push denied: Offer email notification opt-in for urgent messages
- Email fallback: "Juno needs your attention" with deep link to web chat

**SMS Fallback (POST-MVP - TCPA Compliance Required):**

> **⚠️ SMS IS DISABLED FOR TRUE MINIMUM MVP.** Use email-only alerts until full consent stack ships.

SMS will be used for critical alerts when web chat only. TCPA compliance is mandatory:

**Consent Capture (during onboarding if web chat only):**
```
Screen: "Enable SMS for critical alerts?"
- "Juno may send you SMS messages for urgent notifications like
   token expiry or posting failures. Standard rates apply."
- [x] I consent to receive SMS from Juno
- Phone number: [________]
- [Enable SMS] [Skip - email only]
```

**Data Model:**
```sql
Coach.sms_consent BOOLEAN DEFAULT false
Coach.sms_consent_at TIMESTAMP -- when consent granted
Coach.sms_phone VARCHAR -- verified phone number
Coach.sms_opt_out_at TIMESTAMP -- if they later opt out
```

**Per-Message Requirements:**
- Every SMS includes: "Reply STOP to unsubscribe"
- STOP replies processed immediately → set `sms_opt_out_at`, `sms_consent = false`
- Log all SMS sends in `sms_audit` table (phone hash, timestamp, message type)

**Do NOT enable SMS fallback until:**
- [ ] Consent capture UI implemented
- [ ] STOP handling implemented
- [ ] Audit logging implemented
- [ ] Phone verification (send code, confirm) implemented

**Authentication Flow (Web Chat):**
- **Session-based auth via Supabase Auth:**
  - Coach logs in via portal (email/password or magic link)
  - Supabase issues JWT with `coach_id` claim, stored in httpOnly cookie
  - JWT refreshed automatically by Supabase client library (7-day expiry, 1-hour refresh)
- **Chat connection auth:**
  1. On chat load: Client sends JWT to Supabase Realtime connection
  2. Supabase validates JWT and extracts `coach_id`
  3. RLS policy: `conversation_messages` filtered by `coach_id` from JWT
  4. Client can only subscribe to own coach's conversation channel
- **Presence & heartbeat:**
  - Client sends heartbeat every 30s (or on message send)
  - Server tracks `last_active_at` in `conversations` table
  - Stale sessions (no heartbeat >5 min): Force re-auth on next interaction
- **Token refresh during chat:**
  - Supabase client auto-refreshes JWT before expiry
  - If refresh fails (e.g., password changed): Disconnect, show "Session expired, please log in"
  - Chat messages queued during re-auth, sent after successful login
- **Security controls:**
  - Rate limit: 60 messages/minute per coach (prevents abuse)
  - Message size limit: 4KB (prevents payload attacks)
  - No anonymous access: All chat requires authenticated session

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

**Video/Audio Moderation (Reels, Voice Notes):**
Coaches can upload Reels with audio/text overlays or send voice notes via WhatsApp. These require additional moderation:

| Content Type | Moderation Pipeline | Cost |
|--------------|---------------------|------|
| Reels (video) | Frame sampling (1/sec) + OCR + Whisper transcription | ~$0.01-0.02/video |
| Voice notes | Whisper transcription → text classification | ~$0.006/minute |
| Text overlays | Frame sampling + OCR | ~$0.005/video |

**Video Moderation Pipeline:**
```
Video Upload → Extract Audio → Whisper Transcription
            │                          ↓
            └→ Frame Sampling ──→ OCR Text Overlays
                    │                    ↓
                    └→ Vision Check ─────┴──→ Combine All Text → Classify
```

1. **Audio extraction:** FFmpeg to extract audio track
2. **Transcription:** OpenAI Whisper API (or Whisper.cpp for cost)
3. **Frame sampling:** Extract 1 frame/second, batch to Claude Vision
4. **Text overlay detection:** OCR on frames for burned-in text
5. **Combine:** Merge transcription + overlay text + caption
6. **Classify:** Same tiering pipeline as text content

**WhatsApp Voice Notes:**
- Transcribe via Whisper before processing
- Apply same content classification
- If coach sends voice note with content request: Transcribe → generate content → moderate

**Outbound Message Moderation:**
- WhatsApp nudges that mention client names → re-moderate before sending
- Push notifications with content previews → truncate/redact PII

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

**Staged Retry Strategy (before declaring failure):**
1. First attempt: 10s timeout
2. Retry 1: 15s timeout, exponential backoff (wait 2s)
3. Retry 2: 20s timeout, exponential backoff (wait 4s)
4. After 3 failures: Declare "moderation unavailable"

**Moderation Result Caching:**
- Cache moderation results per `content_revision_id` (not per content)
- If revision unchanged and cache hit: Use cached tier, skip re-moderation
- Cache TTL: 24 hours (re-moderate if approaching posting time and cache stale)
- Cache invalidated on any content edit (new revision = new cache key)

**Asset Hash Verification (Cache Bypass Prevention):**
- On media upload: Compute SHA-256 hash of file contents, store in `ContentRevision.media_hashes[]`
- Before using cached moderation result:
  1. Re-fetch media files from storage
  2. Compute current hash of each media file
  3. Compare against stored `media_hashes[]`
  4. If ANY hash mismatch: Invalidate cache, force re-moderation
- Prevents: External edits to media files bypassing moderation (e.g., editing S3 directly)
- Hash check is lightweight (<50ms) compared to full moderation (~2-5s)
- Log hash mismatches as security events for audit

**Tiered Failure Response (not all failures are equal):**
| Content Tier | Infrastructure Failure | Response |
|--------------|----------------------|----------|
| **Green** (previously classified) | OCR/LLM timeout | Allow posting with warning: "Moderation skipped, using cached result" |
| **Green** (never classified) | OCR/LLM timeout | Block, retry queue |
| **Yellow + attested** | OCR/LLM timeout | Allow with warning if previous revision was Yellow |
| **Yellow/Red or unknown** | Any failure | Block, require manual review |

**Failure Handling:**
- If OCR/Vision API fails after retries: Check cache → if Green, allow with warning; otherwise block
- If LLM classification fails after retries: Check cache → if Green, allow with warning; otherwise block
- Blocked posts surface in activity log with "Moderation unavailable - manual review required"
- Coach can manually approve blocked posts via web portal
- Never auto-post Red-tier or unclassified content without moderation

**Degraded Mode Messaging:**
- Chat: "I couldn't verify this post meets guidelines. [Post Anyway] [Wait for Review]"
- Web portal: Banner "Moderation temporarily unavailable" with manual approve button
- Track degraded mode events for ops alerting

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

**Undo ↔ Billing State Transitions:**
Billing and undo must stay synchronized to prevent disputes:

| Undo State | Billing State | Action |
|------------|---------------|--------|
| Undo pending | Hold billing | Do NOT mark UsageEvent as `billable` until posting confirmed |
| Undo complete (within 1hr) | Credit issued | Write compensating UsageEvent with `quantity: -1` |
| Undo failed | Billing stands | No credit; notify coach "Post could not be removed, charge applies" |
| Undo partial | Partial credit | Notify coach; may require manual credit issuance |

**Billing Safety Flow:**
```
Post triggered → UsageEvent created (billable: false, status: pending)
       │
       ▼
Instagram API confirms → UsageEvent updated (billable: true)
       │
       ├── If undo within 1hr → Compensating event, net zero
       │
       └── If undo fails → billable: true stands, coach notified
```

**SLA Documentation:**
- Undo within 1 hour: Guaranteed no charge
- Undo 1-24 hours: Manual credit upon request
- Undo after 24 hours: No credit (unless exceptional circumstance)
- Surface this policy in web portal settings
- WhatsApp/web chat notifications mirror activity log states

### Silence Handling
**⚠️ Opt-In Required (CAN-SPAM/Messaging Compliance):**
- Silence handling is **opt-in during onboarding**
- Coach configures thresholds and channels
- Must include unsubscribe/opt-out in all automated messages

**Default Settings (configurable):**
| Setting | Default | Options |
|---------|---------|---------|
| Check-in threshold | 72 hours | 24h, 48h, 72h, 1 week, never |
| Check-in channel | WhatsApp/web chat | WhatsApp, web chat, email, none |
| Pause automations | After 7 days | 3 days, 7 days, 14 days, never |
| Do-not-disturb | None | Set daily/weekly windows |

**Do-Not-Disturb Windows:**
- Coach sets DND windows: "Don't contact me Sat-Sun" or "Not before 9am"
- All automated messages (nudges, check-ins) respect DND
- Urgent alerts (payment failed, account issue) can override with warning

**Vacation Mode:**
- Coach can set vacation dates in portal
- During vacation: Pause all proactive messages, continue pre-approved posts
- Auto-resume on return date
- Surface "Welcome back!" summary on return

**Compliance Checklist:**
- [ ] All automated emails include unsubscribe link (CAN-SPAM)
- [ ] SMS messages include STOP reply option
- [ ] Track opt-out requests and honor immediately
- [ ] Log all automated outreach for audit

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
| Search | Hybrid search: PostgreSQL full-text (ts_rank) + pgvector + RRF fusion |
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

**Scheduling Intent Persistence (Critical for Outage Recovery):**
- **At approval time:** Write to `scheduled_posts` table with `desired_execution_at`, regardless of 2hr timer window
- Every approved post has a persistent record: `{ content_id, desired_execution_at, timer_status: pending|dispatched|executed }`
- The 2hr timer materialization window only controls when Inngest timers are created, not when intent is recorded
- This ensures posts approved days ahead survive Inngest outages that occur when they enter the execution window

**⚠️ SINGLE SOURCE OF TRUTH: `scheduled_posts` table**
```
scheduled_posts (CANONICAL SOURCE)
├── content_id (FK to Content, UNIQUE)
├── desired_execution_at (TIMESTAMP WITH TIME ZONE - indexed)
├── scheduled_timezone (TEXT - IANA)
├── timer_status (pending | dispatched | executed | failed)
├── inngest_event_id (nullable - tracks Inngest timer)
├── created_at, updated_at
└── CONSTRAINT: One row per content_id (no duplicates)

Content table:
├── status (draft | scheduled | posted | failed)
├── current_revision_id
└── References scheduled_posts via content_id (NOT duplicated scheduling fields)
```

**Reschedule Flow (transactional):**
```sql
BEGIN;
  -- Update scheduled_posts (source of truth)
  UPDATE scheduled_posts SET
    desired_execution_at = $new_time,
    timer_status = 'pending'
  WHERE content_id = $content_id;

  -- Cancel old Inngest timer if exists
  -- (handled by application code, not SQL)

  -- Content.status stays 'scheduled' (no change needed)
COMMIT;
```

**Job Tracking (derived, NOT source of truth):**
- `pending_jobs` table is for operational monitoring only
- Health check: Vercel cron (every 5 min) checks Inngest API status
- If `scheduled_posts` and `pending_jobs` diverge: Trust `scheduled_posts`, rebuild timers

**Outage Detection & Response:**
- If Inngest unhealthy for >15 minutes:
  1. Pause autonomous posting (mark coach for manual mode)
  2. Alert coaches: "Auto-posting paused, manual posting available"
  3. Surface "Post Now" button in web portal for pending content
  4. Continue recording scheduling intent to `scheduled_posts` table

**Non-Inngest Execution Path (True Fallback):**

**⚠️ CRITICAL: Single Claiming Routine**
ALL execution paths (Inngest, Vercel cron, Railway, reconciliation) MUST use the same `claimAndExecutePost()` function:

```typescript
// lib/posting/claim-and-execute.ts - SINGLE SOURCE OF TRUTH
async function claimAndExecutePost(postId: string, expectedVersion?: number): Promise<boolean> {
  const executionId = crypto.randomUUID();

  // Atomic claim with SKIP LOCKED (prevents double-execution)
  const claimed = await db.query(`
    UPDATE scheduled_posts
    SET timer_status = 'executing', execution_id = $2, claimed_at = NOW()
    WHERE id = $1
      AND timer_status = 'pending'
      AND ($3::int IS NULL OR schedule_version = $3)
    RETURNING *
  `, [postId, executionId, expectedVersion ?? null]);

  if (claimed.rows.length === 0) {
    return false; // Already claimed or version mismatch
  }

  try {
    await postToInstagram(claimed.rows[0]);
    await db.query(`
      UPDATE scheduled_posts
      SET timer_status = 'executed', executed_at = NOW()
      WHERE id = $1 AND execution_id = $2
    `, [postId, executionId]);

    // Emit billing event with execution_id for idempotency
    await recordUsageEvent({
      type: 'post_published',
      coachId: claimed.rows[0].coach_id,
      idempotencyKey: executionId,
    });
    return true;
  } catch (error) {
    await db.query(`
      UPDATE scheduled_posts
      SET timer_status = 'failed', failure_reason = $2
      WHERE id = $1 AND execution_id = $3
    `, [postId, error.message, executionId]);
    throw error;
  }
}
```

**Layer 1: Vercel Cron (same-infra fallback):**
- Separate Vercel cron job (every 5 min) that does NOT depend on Inngest
- Queries `scheduled_posts WHERE timer_status = 'pending' AND desired_execution_at <= now()`
- Calls `claimAndExecutePost()` for each - SAME function as Inngest handler
- Only activates when Inngest health check fails (checked via environment flag)

**Layer 2: External Worker (different-infra fallback - MVP REQUIRED):**
- **Railway cron job** running outside Vercel entirely
- Same logic as Layer 1, but on independent infrastructure
- Queries Supabase directly, calls `claimAndExecutePost()` - SAME function
- Runs continuously (every 5 min), checks both Inngest AND Vercel health
- If either unhealthy: Execute due posts directly
- **Cost:** ~$5/month on Railway for minimal always-on worker
- **Why MVP required:** Cannot claim "autonomous posting" without redundancy

**Layer 3: Manual Disaster Recovery SOP:**
- If all automated paths fail (Inngest + Vercel + Railway):
  1. Ops receives alert via external monitoring (e.g., Better Uptime, Checkly)
  2. Run manual catch-up script locally or via Railway CLI
  3. Script queries `scheduled_posts`, executes via Instagram API
  4. Notify affected coaches: "Posts delayed due to infrastructure issue, now posted"
- Document runbook in ops wiki

- **Execution Flow:**
  1. Vercel cron checks `inngest_healthy` flag (set by health monitor)
  2. If healthy: Skip (Inngest handles execution)
  3. If unhealthy: Query due posts, execute directly, mark `timer_status: executed`
  4. Log all fallback executions for audit trail

- **Critical:** Layer 2 shares NO dependencies with Vercel/Inngest - different cloud, different execution path

**Per-Post Timer Reconciliation (catches individual failures):**
The above layers only trigger on global health flags. Individual timer failures (approval handler throws before `inngest.send`, payload validation error, dropped event) go undetected. Add reconciliation:

```
timer-reconciliation job (runs every 15 min, regardless of health):
  1. Query: SELECT * FROM scheduled_posts
     WHERE timer_status = 'pending'
       AND desired_execution_at BETWEEN now() AND now() + interval '2 hours'
       AND inngest_event_id IS NULL  -- No timer was ever created
       AND created_at < now() - interval '5 minutes'  -- Grace period for normal flow

  2. For each orphaned post:
     - Log alert: "Post {id} has no timer, creating now"
     - Create Inngest timer
     - Update inngest_event_id

  3. Query: SELECT * FROM scheduled_posts
     WHERE timer_status = 'dispatched'
       AND desired_execution_at < now() - interval '10 minutes'  -- Should have fired by now

  4. For each stuck post:
     - Log alert: "Post {id} timer may have failed"
     - If can_auto_post: Execute directly, mark executed
     - If not can_auto_post: Create reminder, notify coach
```

**⚠️ Daily Full-Table Reconciliation (catches multi-hour outages):**
The 2-hour sweep window has a blind spot: if there's a multi-hour outage (DB down, bad deploy), posts scheduled >2 hours out never receive timers. Add daily scan:

```
daily-reconciliation job (runs every 6 hours at 00:00, 06:00, 12:00, 18:00 UTC):
  1. Query: SELECT * FROM scheduled_posts
     WHERE timer_status = 'pending'
       AND desired_execution_at > now()  -- ALL future posts, not just 2hr window
       AND inngest_event_id IS NULL      -- No timer ever created
       AND created_at < now() - interval '1 hour'  -- Should have timer by now

  2. For each orphaned post:
     - If desired_execution_at > now() + 2 hours:
       - Log warning: "Post {id} scheduled for {time} has no timer queued"
       - Alert ops (Slack/email): "Potential timer creation failure"
       - Do NOT create timer yet (let normal sweep handle when in window)
     - If desired_execution_at <= now() + 2 hours:
       - Create Inngest timer immediately
       - Update inngest_event_id

  3. Report summary:
     - Total future posts: X
     - Posts with timers: Y
     - Orphaned posts: Z (with breakdown by time range)
     - If orphaned > 0: Alert escalation
```

This catches:
- Multi-hour infrastructure outages
- Silent timer creation failures
- Database disconnects that prevent sweep from running
- Posts approved during deployment rollbacks

This catches:
- Approval handler crashes before `inngest.send`
- Inngest rejects event (payload too large, validation error)
- Timer "lost" due to Inngest internal issue
- Race conditions between approval and sweep

**Recovery with catch-up logic (when Inngest returns):**
  1. On Inngest healthy, query `scheduled_posts` where `timer_status != executed` AND `desired_execution_at` has passed or is within 2hr
  2. For each missed job (where `desired_execution_at < now`):
     - If missed by <2 hours AND coach pre-approved: Execute immediately (backfill)
     - If missed by <2 hours AND not pre-approved: Ask coach "Post now or reschedule?"
     - If missed by >2 hours: Notify coach, offer reschedule to next optimal slot
  3. For future jobs entering 2hr window: Create Inngest timers normally
  4. Surface recovery summary: "3 posts were delayed, 2 posted now, 1 needs your input"
  5. Mark recovered posts as `timer_status: dispatched` or `executed`

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
- **Encoding:** Store events, generate embeddings, maintain tsvector for full-text
- **Retrieval:** Hybrid search (keyword + semantic) for relevant context before each generation
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

**Auto-Context Retrieval (Hybrid Search):**
When generating content, Juno automatically pulls relevant items using hybrid search:
1. Pinned items (always included - brand guide, core rules)
2. **Hybrid search** combining keyword + semantic (see below)
3. Entity matching (client names, program names mentioned)
4. Category matching (content task → brand assets)

**Hybrid Search Architecture:**
Pure vector search misses exact keyword matches; pure keyword search misses semantic similarity. Hybrid combines both.

```
Query: "8-week transformation program pricing"
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   Full-Text Search        Vector Search
   (PostgreSQL ts_rank)    (pgvector cosine)
        │                       │
        ▼                       ▼
   Keyword matches:        Semantic matches:
   - "8-week" exact        - "2-month program"
   - "pricing" exact       - "cost of training"
        │                       │
        └───────────┬───────────┘
                    ▼
            Reciprocal Rank Fusion (RRF)
            score = Σ 1/(k + rank_i)
                    │
                    ▼
            Top-K merged results
```

**Implementation (Supabase/PostgreSQL):**
```sql
-- Add tsvector column for full-text search
ALTER TABLE knowledge_items ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) STORED;

CREATE INDEX idx_knowledge_search ON knowledge_items USING GIN(search_vector);

-- Hybrid search function
CREATE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding vector(1536),
  coach UUID,
  match_count INT DEFAULT 10,
  keyword_weight FLOAT DEFAULT 0.5,
  rrf_k INT DEFAULT 60
) RETURNS TABLE(id UUID, score FLOAT) AS $$
  WITH keyword_results AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank(search_vector, plainto_tsquery(query_text)) DESC) AS rank
    FROM knowledge_items
    WHERE coach_id = coach AND search_vector @@ plainto_tsquery(query_text)
    LIMIT match_count * 2
  ),
  semantic_results AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> query_embedding) AS rank
    FROM knowledge_items
    WHERE coach_id = coach
    ORDER BY embedding <=> query_embedding
    LIMIT match_count * 2
  )
  SELECT
    COALESCE(k.id, s.id) AS id,
    (COALESCE(1.0/(rrf_k + k.rank), 0) * keyword_weight +
     COALESCE(1.0/(rrf_k + s.rank), 0) * (1 - keyword_weight)) AS score
  FROM keyword_results k
  FULL OUTER JOIN semantic_results s ON k.id = s.id
  ORDER BY score DESC
  LIMIT match_count;
$$ LANGUAGE SQL;
```

**Tuning Parameters:**
| Parameter | Default | Purpose |
|-----------|---------|---------|
| `keyword_weight` | 0.5 | Balance keyword vs semantic (0 = pure semantic, 1 = pure keyword) |
| `rrf_k` | 60 | RRF smoothing constant (higher = more equal weighting across ranks) |
| `match_count` | 10 | Final results to return |

**When to Favor Keyword vs Semantic:**
| Query Type | Keyword Weight | Example |
|------------|----------------|---------|
| Exact lookups | 0.7-0.8 | "What's my pricing for X program?" |
| Conceptual | 0.3-0.4 | "Content ideas about motivation" |
| Mixed | 0.5 | "Posts about client Sarah's progress" |

**Context Budget:** ~1,000 tokens for knowledge base items per request

**Privacy & PII Safeguards:**
- Client PII never auto-posted without approval
- Transformation photos require explicit consent
- Files encrypted at rest, RLS enforced

**Automatic PII Detection (RAG Injection Prevention):**
Before including any knowledge base item in content generation context:
1. **PII scan:** Run lightweight NER (Named Entity Recognition) on content
   - Detect: Names, emails, phone numbers, addresses
   - Use: spaCy or Claude with structured output
2. **Auto-flag:** If PII detected → set `contains_client_pii = true`
3. **Block from generative context:** Items with `contains_client_pii = true` excluded from auto-retrieval
4. **Explicit opt-in required:** Coach must approve per-use when generating content mentioning clients
5. **Audit log:** Track all PII inclusions in `consent_audit` table

**Retrieval Pipeline with PII Filter:**
```
Query → Hybrid Search → Results
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              PII-free items   PII-containing items
              (auto-include)   (require explicit approval)
                    │             │
                    ▼             ▼
              Context used    Coach asked: "Include Sarah's progress?"
                              [Yes, include] [No, skip]
```

**PII Categories Detected:**
| Category | Pattern | Action |
|----------|---------|--------|
| Client names | NER PERSON entities | Flag, require approval |
| Emails | Regex + NER | Flag, never include by default |
| Phone numbers | Regex | Flag, never include by default |
| Specific results | "lost 20 lbs", "bench 225" | Flag if paired with name |

### Reference Materials (Professional Resources)

> Curated professional resources that enhance Juno's domain expertise. Unlike coach-uploaded knowledge base items, these are system-wide resources available to all coaches.

**Purpose:**
- Ground Juno's fitness programming in evidence-based practices
- Provide authoritative citations for workout recommendations
- Ensure exercise form cues and progression advice are accurate
- Differentiate from generic AI assistants with domain expertise

**Initial Resource: NSCA Strength & Conditioning Manual**
- Industry-standard reference for exercise programming
- Covers: periodization, exercise technique, program design, assessments
- ~600 pages → chunked and embedded for RAG retrieval

**RAG Pipeline:**
```
PDF Upload → Text Extraction → Chunking → Embedding → Storage
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              Chunk Size: 500 tokens    Overlap: 50 tokens
              (preserves context)       (prevents boundary cuts)
                    │                         │
                    └────────────┬────────────┘
                                 ▼
                    Store in reference_chunks table
                    with source, page, section metadata
```

**Data Model:**
```
ReferenceSource
├── id, name (e.g., "NSCA Essentials of Strength Training")
├── type (textbook, certification, guideline)
├── version, edition
├── enabled (boolean - can disable outdated sources)
└── created_at

ReferenceChunk
├── id, source_id (FK to ReferenceSource)
├── content (TEXT - the chunk text)
├── embedding (vector(1536))
├── metadata (JSON - {page: 142, chapter: "Periodization", section: "Block Programming"})
├── chunk_index (ordering within source)
└── created_at
```

**Retrieval Integration:**
When Juno generates fitness content (workout programs, exercise recommendations):
1. Detect fitness-related intent (workout design, exercise selection, progression)
2. Query `reference_chunks` with semantic search (top 3-5 relevant chunks)
3. Include retrieved context in LLM prompt as "Reference Materials"
4. Juno can cite sources: "Based on NSCA guidelines, a beginner should..."

**Example Flow:**
```
Coach: "Create a 12-week strength program for a client new to lifting"

Juno retrieves:
- Chunk: "Novice lifters should begin with 2-3 sessions per week..."
- Chunk: "Progressive overload for beginners: increase load 2.5-5% when..."
- Chunk: "Compound movements (squat, deadlift, press) should form the foundation..."

Juno generates program grounded in NSCA principles with optional citations.
```

**Scope Control (prevents hallucination):**
- Reference materials supplement, don't replace coach expertise
- Juno cites sources when making technical claims
- If no relevant reference found, Juno uses general knowledge with caveat
- Coach can override any recommendation (they know their client best)

**Future Reference Sources (Post-MVP):**
| Source | Domain | Priority |
|--------|--------|----------|
| ACSM Guidelines | General fitness, health | High |
| NASM Corrective Exercise | Mobility, injury prevention | Medium |
| Precision Nutrition | Nutrition coaching | Medium |
| ACE Personal Trainer Manual | General PT knowledge | Low |
| Specialty certifications | Sport-specific, populations | Future |

**Implementation Timeline:**
- **Post-MVP:** Initial NSCA manual processing and RAG integration
- **V2:** Additional sources, citation UI in generated content
- **V3:** Coach-uploadable professional resources (their own certifications)

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
├── posted_at
├── platform (instagram)
├── external_id (Instagram post ID, nullable)
├── performance_metrics (JSON)
└── created_at, updated_at
-- NOTE: Scheduling fields are in scheduled_posts table (single source of truth)
-- Content.status = 'scheduled' indicates a scheduled_posts row exists

ScheduledPost (CANONICAL scheduling source)
├── id
├── content_id (FK to Content, UNIQUE - one schedule per content)
├── scheduled_local_time (TIME - e.g., "09:00")
├── scheduled_date (DATE - e.g., "2026-03-17")
├── scheduled_timezone (TEXT - IANA, e.g., "America/New_York")
├── desired_execution_at (TIMESTAMP WITH TIME ZONE - UTC, indexed)
├── timer_status (pending, dispatched, executed, failed)
├── inngest_event_id (nullable - tracks active timer)
├── created_at, updated_at
└── CONSTRAINT: All scheduling queries use this table, not Content

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

Conversation (channel-agnostic - one per coach)
├── id, coach_id
├── started_at, last_message_at
├── last_active_channel (whatsapp, web_chat)
├── last_active_at
└── context (JSON - current task, pending actions)

ConversationMessage (normalized for scale + realtime)
├── id, conversation_id
├── channel (whatsapp, web_chat) -- channel stored per-message, not per-conversation
├── channel_message_id (external ID for idempotency: wamid for WhatsApp, UUID for web)
├── role (user, assistant, system)
├── content (text)
├── metadata (JSON - buttons, attachments, etc.)
├── created_at
└── deleted_at (nullable - for GDPR "forget")
-- UNIQUE(conversation_id, channel, channel_message_id) for webhook retry safety

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
├── search_vector (tsvector - generated from title + content, GIN indexed)
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
├── search_vector (tsvector - generated from name + goals + notes)
└── created_at, updated_at

Program (structured data)
├── id, coach_id
├── name, description
├── duration, price, currency
├── includes (text array)
├── ideal_for, testimonials (text array)
├── embedding (vector 1536)
├── search_vector (tsvector - generated from name + description + ideal_for)
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

**Cross-System Reconciliation (Instagram vs UsageEvents):**
- Weekly job fetches actual Instagram posts via Media API (last 7 days per coach)
- Compare `external_id` on Content records with Instagram Media IDs
- Identify anomalies:
  | Anomaly | Cause | Action |
  |---------|-------|--------|
  | UsageEvent without Instagram post | API call failed after logging | Flag as under-billed, investigate |
  | Instagram post without UsageEvent | Bug: event not written | Create backfill UsageEvent, alert ops |
  | Mismatch count >5% for coach | Systematic issue | Block billing, require manual review |
- Store reconciliation results in `BillingReconciliation` table for audit
- AI interactions: Cross-check with `conversation_messages` count (harder to reconcile, spot-check 10%)

**Post-Window Dispute Workflow (after 1-hour grace period):**
Real-world disputes happen after the undo window closes. Handle gracefully:

1. **Dispute initiation:**
   - Coach contacts support or clicks "Dispute Charge" in activity log
   - Create `BillingDispute` record: `{ usage_event_id, reason, status: 'open', created_at }`

2. **Dispute statuses:** `open` → `under_review` → `approved` | `denied`

3. **If dispute approved:**
   - Write compensating UsageEvent with `dispute_id` reference and `quantity: -1`
   - **Stripe Adjustment Mechanism:**
     - Option A (preferred): Create invoice credit via `stripe.customers.createBalanceTransaction({ amount: -X, currency, description })`
     - Option B: If usage not yet invoiced, create negative UsageRecord via `stripe.subscriptionItems.createUsageRecord({ quantity: -1, action: 'set' })`
     - Store `stripe_adjustment_id` (balance transaction or usage record ID) on dispute record
   - **Reconciliation sync:** Internal ledger must equal Stripe:
     - `sum(UsageEvents.quantity)` = `sum(Stripe UsageRecords)` - `sum(Stripe BalanceTransactions)`
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
   - **Reconciliation formula:**
     ```
     internal_total = sum(UsageEvents.quantity WHERE billable=true)
     stripe_total = sum(UsageRecords) - sum(BalanceTransactions WHERE type='adjustment')
     discrepancy = abs(internal_total - stripe_total)
     if discrepancy > threshold: alert ops team
     ```
   - Generate monthly reconciliation report with line-item breakdown

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

**Per-Job Token Error Handling:**
Before executing any Instagram posting job:
1. **Pre-flight token check:** Validate token expiry, attempt refresh if <24h remaining
2. **If refresh fails:** Abort job, mark content as `status: token_error`, notify coach immediately
3. **If API rejects mid-post:** Detect error code (190 = invalid token, 200 = permission issue)
   - 190 (token invalid): Disable automations, alert: "Please reconnect your Instagram"
   - 200 (permission revoked): Specific alert: "Instagram posting permission removed, please re-authorize"
4. **Degrade gracefully:** Surface "Post Manually" button with copy-paste content
5. **Retry logic:** Do NOT retry indefinitely; max 3 attempts within 15 minutes, then fail

**Token Verification Before Scheduling:**
When coach schedules post >24h out:
- Check if token will expire before scheduled time
- If yes: Warn coach "Your Instagram connection will expire before this posts. Please refresh now."
- Block scheduling if token expires <6h before post time (high risk of failure)

### Data Handling
- Coach owns their data
- Clear data deletion workflow
- No training on coach data without consent

**GDPR/Data Deletion Cascade (Coach Account Deletion):**

**Lifecycle: Soft-Delete → 30-Day Retention → Hard Delete**

When a coach requests account deletion:

| Phase | Data Type | Action | Timeline |
|-------|-----------|--------|----------|
| **Phase 1: Soft Delete** | Coach record | Set `deleted_at`, block login | Immediate |
| | Sessions/tokens | Revoke all | Immediate |
| | Redis cache | Pattern delete `coach:{id}:*` | Immediate |
| **Phase 2: Anonymize** | Uploaded files | Delete from Supabase Storage | Within 24h |
| | Embeddings | Delete from pgvector | Within 24h |
| | PII fields | Null out name, email, phone | Within 24h |
| **Phase 3: Hard Delete** | Content, Conversations, ScheduledPosts | Delete via FK cascade | 30 days |
| **EXCLUDED from cascade** | UsageEvents, BillingDispute, ActivityLog | Anonymize `coach_id` → surrogate UUID, retain records | Never deleted |
| **Retained externally** | Stripe records | Kept by Stripe for legal | Per Stripe policy |
| **No action** | Reference chunks | System-wide, no coach data | N/A |

**⚠️ Billing/Audit Tables Excluded from Deletion:**
Financial and audit records must be retained for legal/tax compliance (7+ years):
```sql
-- These tables use ON DELETE SET NULL, not CASCADE
UsageEvents.coach_id → SET NULL (retain for billing reconciliation)
BillingDispute.coach_id → SET NULL (retain for dispute resolution)
ActivityLog.coach_id → SET NULL (retain for audit trail)
ConsentAudit.coach_id → SET NULL (retain for compliance)

-- Add surrogate UUID for internal reporting after deletion
ALTER TABLE usage_events ADD COLUMN deleted_coach_uuid UUID;
-- On coach deletion: UPDATE usage_events SET deleted_coach_uuid = coach.id, coach_id = NULL
```

**Deletion Workflow:**
1. Coach clicks "Delete Account" in portal
2. **Offer data export first** (see Data Export Pipeline below)
3. Confirm with password + "I understand this is permanent"
4. **Immediate:** Set `deleted_at` timestamp, revoke tokens, log out
5. **Immediate:** Block all API access (RLS checks `deleted_at IS NULL`)
6. **Within 24h (background job):**
   - Delete Supabase Storage files
   - Delete embeddings
   - Null out PII fields (name, email, phone → NULL)
   - Anonymize billing/audit records (set `deleted_coach_uuid`, null `coach_id`)
   - Send confirmation email: "Your account has been deactivated"
7. **30 days later (scheduled job):**
   - Hard delete coach record and cascadable data (Content, Conversations, etc.)
   - Billing/audit records remain with anonymized surrogate UUID
   - Send final confirmation: "Your data has been permanently deleted"

**Data Export Pipeline (GDPR Right to Portability):**
Before deletion, coach can request full data export:
1. Coach clicks "Export My Data" in portal settings
2. Background job assembles export package:
   - `profile.json`: Coach profile, preferences, brand voice
   - `content.json`: All Content records with revisions
   - `conversations.json`: All conversation messages
   - `media/`: Uploaded files from Supabase Storage
   - `usage.json`: UsageEvents summary (anonymized)
3. Package stored in Supabase Storage (signed URL, 7-day expiry)
4. Email sent: "Your data export is ready. Download within 7 days."
5. Export logged in ActivityLog for compliance

**Why 30-day retention:**
- Allows account recovery if deletion was accidental
- Enables support investigation if coach disputes charges
- Required for some audit/compliance scenarios
- Coach cannot log in during this period (blocked at RLS level)

**Compliance Documentation:**
- Log all deletion requests with timestamps
- Store deletion confirmation for audit
- Track data export requests and downloads

### Multi-Tenancy & Data Isolation

**Row-Level Security (RLS):**
Every table enforces tenant isolation at database level:
```sql
-- ⚠️ CRITICAL: All RLS policies must include deleted_at check
CREATE POLICY "coach_isolation" ON content FOR ALL USING (
  coach_id = auth.uid()
  AND (SELECT deleted_at FROM coaches WHERE id = auth.uid()) IS NULL
);
CREATE POLICY "coach_isolation" ON conversations FOR ALL USING (
  coach_id = auth.uid()
  AND (SELECT deleted_at FROM coaches WHERE id = auth.uid()) IS NULL
);
CREATE POLICY "coach_isolation" ON knowledge_items FOR ALL USING (
  coach_id = auth.uid()
  AND (SELECT deleted_at FROM coaches WHERE id = auth.uid()) IS NULL
);
-- Applied to ALL coach-scoped tables
```

**Immediate Token Revocation on Deletion:**
```sql
-- When coach.deleted_at is set, immediately:
-- 1. Revoke all Supabase auth sessions
DELETE FROM auth.sessions WHERE user_id = $coach_id;

-- 2. Invalidate refresh tokens
DELETE FROM auth.refresh_tokens WHERE user_id = $coach_id;

-- 3. Clear Redis session cache
-- KEYS coach:{id}:session:* → DEL

-- 4. RLS policy blocks access even if token somehow remains valid
```

**Service-Role Access for Compliance Tables:**
Billing and audit records have NULL `coach_id` after deletion. Standard RLS blocks access.
Solution: Use Supabase service role key for internal compliance tooling.

```sql
-- Create compliance schema with service-role access only
CREATE SCHEMA compliance;

-- Move audit/billing views to compliance schema
CREATE VIEW compliance.usage_events_audit AS
  SELECT * FROM public.usage_events;

-- RLS bypass for service role
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_access" ON usage_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- Application code for dispute handling:
-- const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
-- await supabaseAdmin.from('usage_events').select('*').eq('deleted_coach_uuid', disputeCoachUUID);
```

**Defense in Depth:**
| Layer | Protection |
|-------|------------|
| Database | RLS policies on every table with `deleted_at` check |
| API | Validate `coach_id` matches JWT on every request |
| Auth | Immediate session/token revocation on deletion |
| Compliance | Service-role path for billing/audit queries |
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

**⚠️ RESOURCING ASSUMPTIONS:**
| Resource | Assumption | If Different |
|----------|------------|--------------|
| Headcount | 1 full-time founder/engineer | Extend timeline 50% per 0.5 FTE reduction |
| Weekly capacity | 50 focused hours/week | Adjust week estimates proportionally |
| External blockers | WhatsApp/Canva approvals don't block | Built-in fallbacks (web chat, manual templates) |
| Integration experience | Some prior Next.js/Supabase experience | Add 1 week ramp-up |

**⚠️ CONTINGENCY BUFFERS:**
- **Week 4 checkpoint:** If not at "chat + content generation + preview" → cut auto-posting from MVP
- **Week 6 checkpoint:** If billing not started → defer Stripe to post-MVP (free tier only)
- **External delays >2 weeks:** Pivot to web-only, manual-posting MVP

**Timeline Reality Check:**
This is an aggressive timeline for a solo founder. Priorities if behind schedule:
1. **Must ship:** Chat + content generation + manual posting (copy-paste workflow)
2. **Should ship:** Auto-posting + basic scheduling + moderation
3. **Can defer to post-MVP:** Knowledge base uploads, analytics dashboard, memory consolidation, hybrid search refinement

**Skill Framework Simplification:**
- **MVP:** Implement 5 core skills directly (no generic skill engine):
  - `generate_caption` - Claude generates Instagram caption
  - `schedule_post` - Set time/date for content
  - `send_message` - Send WhatsApp/web chat message
  - `approve_content` - Mark content ready for posting
  - `post_content` - Execute Instagram post
- **Post-MVP:** If patterns emerge, generalize into skill framework
- **Defer entirely:** Complex skill dependency graphs, undo semantics per skill

**Critical Task Dependencies:**
```
Week 1: Foundation
  └── Auth, DB, Inngest setup
  └── START: WhatsApp + Canva approvals (external, non-blocking)

Week 2: Web Portal
  ├── depends on: Week 1 (auth, DB)
  └── OAuth flows, token management

Week 3: Background Jobs + Search
  ├── depends on: Week 1 (Inngest), Week 2 (tokens)
  └── pgvector, scheduling, realtime

Week 4: Content Generation
  ├── depends on: Week 3 (pgvector, scheduling)
  └── GATE: Content generation working end-to-end

Week 5: Chat Integration
  ├── depends on: Week 3 (realtime), Week 4 (content gen)
  └── CONTINGENCY: If WhatsApp not approved, use web chat only

Week 6: Instagram Posting
  ├── depends on: Week 4 (content), Week 3 (scheduling)
  └── GATE: Can auto-post to Instagram

Week 7: Billing
  ├── depends on: Week 6 (posting = billable events)
  └── Can defer usage metering if needed (flat rate MVP)

Week 8: Hardening
  └── depends on: All previous weeks
```

**External Approval Contingencies:**
| Approval | Expected | If Delayed | Mitigation |
|----------|----------|------------|------------|
| WhatsApp Business API | Week 3-4 | Continue with web chat | Full feature parity in web chat |
| Canva Connect | Week 4-5 | Launch without Canva | Manual template upload, add Canva post-launch |
| Instagram Business | Coach-dependent | Degraded mode | Copy-paste workflow, posting reminders |

**Approval Tracking (Assigned Owners):**
| Approval | Owner | Check Cadence | Escalation |
|----------|-------|---------------|------------|
| WhatsApp Business API | Founder | Weekly (every Monday) | If no response by Week 3, escalate to Meta support |
| Canva Connect | Founder | Weekly | If no response by Week 4, plan launch without |
| Instagram Business | N/A (coach-driven) | On onboarding | Provide conversion guide in onboarding flow |

**Communication Plan if Approvals Delayed:**
- Week 4 checkpoint: If WhatsApp not approved, communicate to beta coaches: "Launching with web chat first, WhatsApp coming soon"
- Document all approval requests with timestamps for audit

**De-risking strategy:**
- Week 1-4: Build end-to-end slice (chat → content → manual post)
- Week 5-6: Add automation layer (scheduling, auto-post)
- Week 7-8: Hardening + billing (defer analytics if needed)

**⚠️ TRUE MINIMUM MVP - COMMIT TO THIS SCOPE:**

The 8-week timeline with 63+ skills is not realistic for a solo founder. **Commit to the true minimum:**

| Feature | TRUE MVP (ship this) | Everything Else (post-launch) |
|---------|----------------------|-------------------------------|
| Chat | Web chat only | WhatsApp |
| Content | Claude generates captions (no voice learning) | Voice model, memory, RAG |
| Posting | **Manual copy/paste** | Auto-posting via Instagram API |
| Moderation | Basic Green/Yellow/Red classification | Staged retries, video/audio, caching |
| Scheduling | "Post at 9am tomorrow" → copy reminder | DST-aware timers, sweep jobs |
| Skills | **5 hardcoded skills** (see below) | 63+ skill framework |
| Analytics | None | Dashboard |
| Billing | Free beta (no Stripe) | Stripe integration |
| Calendar | None | Google Calendar sync |

**The 5 MVP Skills (hardcoded, no framework):**
1. `generate_caption` - Claude generates Instagram caption from prompt
2. `edit_caption` - Refine based on coach feedback
3. `save_draft` - Store content for later
4. `schedule_reminder` - Set reminder to post manually (email/notification)
5. `send_chat_message` - Juno responds in chat

**Rationale:** A coach can get value from "generate caption → approve → copy/paste to Instagram" without automation. Everything else is convenience, not core value. Ship this in 4 weeks, iterate.

**Explicit Deferrals (ALL post-launch):**
- WhatsApp Business API
- Auto-posting to Instagram API
- Google Calendar sync
- Voice learning / memory system
- Canva integration
- Analytics dashboard
- Fitness coaching skills (58+ skills)
- Stripe billing
- Knowledge base uploads
- Video/audio moderation

### Week 1: Foundation (TRUE MVP)
- [ ] Next.js project setup with TypeScript
- [ ] PostgreSQL setup (Supabase)
- [ ] Auth system (magic link)
- [ ] Basic data models: Coach, Content, ChatMessage
- [ ] Supabase Realtime setup for web chat

### Week 2: Web Chat + Basic UI
- [ ] Web portal: signup, login, settings
- [ ] **Web chat interface (primary channel, not fallback)**
- [ ] Chat state management (session-based)
- [ ] Basic coach profile/settings page
- [ ] Content list view (empty for now)

### Week 3: Content Generation (5 Skills Only)
- [ ] Claude integration for content generation
- [ ] **Skill: generate_caption** - Claude generates Instagram caption from prompt
- [ ] **Skill: edit_caption** - Refine based on coach feedback
- [ ] **Skill: save_draft** - Store content for later
- [ ] **Skill: schedule_reminder** - Set reminder to post manually (email notification)
- [ ] **Skill: send_chat_message** - Juno responds in chat
- [ ] Content preview in web portal
- [ ] Copy-to-clipboard button for manual posting

### Week 4: Moderation + Beta Launch
- [ ] **Basic moderation (Green/Yellow/Red classification)**
- [ ] Yellow content → coach approval required
- [ ] Red content → blocked with explanation
- [ ] Simple email notifications (reminders, alerts)
- [ ] End-to-end testing of core flow
- [ ] Security review (auth, RLS)
- [ ] **FREE BETA LAUNCH with 5-10 coaches**
- [ ] Basic monitoring (Supabase dashboard, error tracking)

---

## POST-LAUNCH ITERATION (After Beta Validation)

**Only proceed after 10+ coaches actively using MVP and providing feedback.**

### Phase 2: Automation (Weeks 5-8 equivalent)
- [ ] Apply for WhatsApp Business API approval
- [ ] Apply for Canva Connect API access
- [ ] Inngest setup for background jobs
- [ ] Instagram Graph API integration (auto-posting)
- [ ] OAuth integration: Instagram Business/Creator accounts
- [ ] WhatsApp Business API integration (when approved)
- [ ] DST-aware scheduling with sweep jobs

### Phase 3: Intelligence (Weeks 9-12 equivalent)
- [ ] pgvector + embedding pipeline
- [ ] Voice learning from coach's existing content
- [ ] Memory system (lessons, preferences)
- [ ] Knowledge base (documents, media assets)
- [ ] Hybrid search (BM25 + vector + RRF)

### Phase 4: Monetization (Weeks 13-16 equivalent)
- [ ] Stripe subscription integration
- [ ] Usage metering with compensating events
- [ ] Analytics dashboard
- [ ] Advanced moderation (video/audio, caching)
- [ ] Google Calendar sync

### Parallel Workstreams (POST-LAUNCH)
```
Beta Launch ─────────────────────────────────────────▶ Phase 4
  │
  ├── WhatsApp API Approval (start after beta validation)
  │
  ├── Canva API Approval (start after beta validation)
  │
  └── Expanded Coach Recruitment (ongoing)
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
│  │                    FITNESS COACHING (Domain-Specific)                 │  │
│  │  Workouts • Nutrition • Progress • Assessments • Motivation • Content │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
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

### 10. FITNESS COACHING SKILLS (Domain-Specific)

> These skills differentiate Juno for fitness/wellness coaches specifically. They leverage coach expertise while automating delivery.

**⚠️ REGULATORY DISCLAIMERS (Required in Generated Content):**

| Category | Required Disclaimer | When Applied |
|----------|---------------------|--------------|
| Workout Programming | "Consult a physician before starting any exercise program." | All workout outputs |
| Nutrition | "For educational purposes only. Consult a registered dietitian for medical nutrition therapy." | All meal plans, macro calculations |
| Progress/Body Composition | "Body composition estimates are approximations. For accurate assessment, consult a professional." | Body fat %, measurements |
| Supplements | "This is not medical advice. Consult a healthcare provider before taking supplements." | Any supplement mentions |
| Injury/Recovery | "This is general guidance, not medical advice. Consult a healthcare provider for injuries." | Mobility, injury-related content |
| Mental Health | "If you're struggling, please reach out to a mental health professional." | Mindset content mentioning struggles |

**Disclaimer Implementation:**
1. Each skill category has `required_disclaimer` field in skill metadata
2. LLM prompts include: "Append the following disclaimer: {disclaimer}"
3. Content moderation verifies disclaimer present before marking Green tier
4. Missing disclaimer → Yellow tier, coach prompted to add

**Testing Requirements:**
- Unit tests verify each skill output includes required disclaimer
- Sample generated content reviewed monthly for compliance
- Coach feedback mechanism: "Is this disclaimer correct for your practice?"

#### Workout Programming
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `generate_workout` | Create workout from goals/equipment/time | None | Post-MVP | None |
| `create_training_block` | Design 4-6 week periodization | None | Post-MVP | None |
| `suggest_exercise_alternative` | Substitute for injury/equipment | None | MVP | None |
| `calculate_training_volume` | Sets × reps × load recommendations | None | Post-MVP | None |
| `generate_warmup` | Dynamic warmup for session type | None | MVP | None |
| `create_superset` | Efficient exercise pairings | None | Post-MVP | None |
| `scale_workout` | Adjust difficulty up/down | None | MVP | None |
| `generate_deload_week` | Recovery week programming | None | Post-MVP | None |
| `create_home_workout` | No-equipment alternatives | None | MVP | None |
| `build_workout_library` | Organize reusable templates | None | Post-MVP | Google Sheets |

#### Nutrition Planning
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `calculate_macros` | TDEE + macro targets from goals | None | MVP | None |
| `generate_meal_plan` | Daily/weekly meal structure | None | Post-MVP | None |
| `create_grocery_list` | Shopping list from meal plan | None | Post-MVP | None |
| `suggest_meal_prep` | Batch cooking ideas | None | Post-MVP | None |
| `analyze_food_log` | Review client food diary | None | Post-MVP | None |
| `suggest_healthy_swap` | Substitute unhealthy foods | None | MVP | None |
| `calculate_protein_timing` | Pre/post workout nutrition | None | Post-MVP | None |
| `answer_nutrition_faq` | Common nutrition questions | None | MVP | WhatsApp |
| `create_hydration_plan` | Water intake recommendations | None | Post-MVP | None |
| `explain_supplement` | Supplement info (no medical claims) | Low | Post-MVP | None |

**Nutrition Disclaimer:** All nutrition skills include standard disclaimer: "For educational purposes. Consult a registered dietitian for medical nutrition therapy."

#### Progress Tracking
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `log_measurements` | Record body measurements | None | MVP | Google Sheets |
| `track_weight` | Weight logging with trends | None | MVP | Google Sheets |
| `log_progress_photo` | Store transformation photos | Low | Post-MVP | Supabase Storage |
| `calculate_body_composition` | Estimate body fat % (formulas) | None | Post-MVP | None |
| `analyze_progress` | Trend analysis over time | None | Post-MVP | Google Sheets |
| `generate_progress_report` | Client progress summary | None | Post-MVP | Google Docs |
| `compare_progress_photos` | Side-by-side comparison | Low | Post-MVP | None |
| `log_pr` | Personal record tracking | None | MVP | Google Sheets |
| `celebrate_milestone` | Acknowledge achievements | None | MVP | WhatsApp |
| `identify_plateau` | Detect stalled progress | None | Post-MVP | Google Sheets |

#### Fitness Assessments
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `conduct_initial_assessment` | New client questionnaire | None | MVP | None |
| `assess_fitness_level` | Beginner/intermediate/advanced | None | MVP | None |
| `screen_movement` | Basic movement assessment | Low | Post-MVP | None |
| `identify_limitations` | Equipment/time/injury constraints | None | MVP | None |
| `set_smart_goals` | Goal setting framework | None | MVP | None |
| `calculate_1rm` | Estimate one-rep max | None | Post-MVP | None |
| `assess_readiness` | Daily readiness check | None | Post-MVP | None |
| `evaluate_recovery` | Sleep/stress/soreness check | None | Post-MVP | WhatsApp |
| `reassess_progress` | Periodic re-evaluation | None | Post-MVP | None |

#### Client Motivation & Accountability
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `send_workout_reminder` | Pre-workout nudge | Low | MVP | WhatsApp |
| `send_motivation` | Personalized encouragement | None | MVP | WhatsApp |
| `check_in_daily` | Quick daily touchpoint | Low | Post-MVP | WhatsApp |
| `celebrate_consistency` | Streak acknowledgment | None | MVP | WhatsApp |
| `handle_missed_workout` | Supportive follow-up | None | MVP | WhatsApp |
| `provide_form_tip` | Exercise technique guidance | None | MVP | WhatsApp |
| `share_educational_content` | Relevant articles/videos | None | Post-MVP | WhatsApp |
| `gamify_progress` | Points/badges/challenges | None | Future | None |
| `create_accountability_challenge` | Group challenges | Low | Future | None |
| `send_rest_day_reminder` | Recovery encouragement | None | Post-MVP | WhatsApp |

#### Fitness Content Generation
| Skill | Description | Risk | MVP | Integration |
|-------|-------------|------|-----|-------------|
| `write_exercise_description` | Form cues and tips | None | MVP | None |
| `create_workout_post` | Shareable workout graphic text | None | MVP | Instagram |
| `write_transformation_story` | Client success narrative | Medium | Post-MVP | Instagram |
| `generate_nutrition_tip` | Quick nutrition content | None | MVP | Instagram |
| `create_exercise_carousel` | Multi-slide exercise guide | None | Post-MVP | Instagram, Canva |
| `write_myth_buster` | Debunk fitness myths | Low | Post-MVP | Instagram |
| `create_workout_of_day` | Daily WOD content | None | MVP | Instagram |
| `generate_motivation_quote` | Fitness motivation content | None | MVP | Instagram |
| `write_behind_scenes` | Day-in-the-life content | None | MVP | Instagram |
| `create_faq_post` | Answer common questions | None | MVP | Instagram |

**MVP Fitness Skills:** `suggest_exercise_alternative`, `generate_warmup`, `scale_workout`, `create_home_workout`, `calculate_macros`, `suggest_healthy_swap`, `answer_nutrition_faq`, `log_measurements`, `track_weight`, `log_pr`, `celebrate_milestone`, `conduct_initial_assessment`, `assess_fitness_level`, `identify_limitations`, `set_smart_goals`, `send_workout_reminder`, `send_motivation`, `celebrate_consistency`, `handle_missed_workout`, `provide_form_tip`, `write_exercise_description`, `create_workout_post`, `generate_nutrition_tip`, `create_workout_of_day`, `generate_motivation_quote`, `write_behind_scenes`, `create_faq_post`

**Total Fitness Skills:** 27 MVP, 33 Post-MVP, 2 Future = **62 fitness-specific skills**

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

### Full Product Skill Roadmap (POST-MVP ONLY)

> **⚠️ THIS IS NOT THE TRUE MINIMUM MVP.**
>
> **TRUE MVP = 5 hardcoded skills ONLY:**
> 1. `generate_caption` - Claude generates Instagram caption
> 2. `edit_caption` - Refine based on coach feedback
> 3. `save_draft` - Store content for later
> 4. `schedule_reminder` - Set email reminder to post manually
> 5. `send_chat_message` - Juno responds in chat
>
> **TRUE MVP Integrations = NONE.** No Instagram API, no Calendar, no Stripe, no WhatsApp.
> Everything below ships AFTER beta validation with 10+ coaches.

**Full Product Vision: ~172 skills** (Post-MVP phases)

| Category | Phase 2 | Phase 3 | Phase 4 |
|----------|---------|---------|---------|
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
| **Fitness - Programming** | 4 | 6 | 0 |
| **Fitness - Nutrition** | 4 | 6 | 0 |
| **Fitness - Progress** | 5 | 5 | 0 |
| **Fitness - Assessments** | 4 | 5 | 0 |
| **Fitness - Motivation** | 5 | 3 | 2 |
| **Fitness - Content** | 5 | 5 | 0 |
| **Total (Post-MVP)** | **63** | **107** | **21** |

**Phase 2 Integrations (after beta validation):**
- Instagram Graph API (Business/Creator accounts)
- Google Calendar
- Stripe (basic invoicing)
- WhatsApp Business API

**Phase 3+ Integrations:**
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

## Success Criteria for TRUE MINIMUM MVP

The MVP is successful if:
- [ ] 10 coaches actively using Juno (free beta)
- [ ] 70%+ 30-day retention
- [ ] Average of 10+ captions generated per coach per month
- [ ] <10% of generated content rejected without editing (quality bar)
- [ ] Coaches manually posting content Juno generated (adoption signal)
- [ ] NPS of 40+

**Note:** No auto-posting metrics in MVP. "Posts created" = captions generated and copied by coach.

---

*Last updated: March 2026*
*Status: Ready for implementation*
