### CRITICAL Background Jobs Missing For Autonomy
- **Dimension:** Architecture
- **Location:** Technical Architecture / Stack & MVP Features → Scheduling & Calendar
- **Problem:** The design assumes Next.js API routes on Vercel plus Redis/Postgres, but there is no mention of a persistent job runner or worker tier. Autonomous posting, optimal-time scheduling, undo, silence handling, and Google Calendar sync all require time-based execution outside of coach-initiated requests. Vercel serverless functions cannot run long-lived or scheduled tasks, so posts will never auto-publish, reminders will not fire, and audit trail rollbacks cannot run.
- **Recommendation:** Define and provision a background execution environment (e.g., durable queue + worker processes on Fly.io/EC2 or Vercel Cron invoking queue-draining APIs). Explicitly model how scheduled jobs are persisted (e.g., Redis delayed queues) and how retries/poison jobs are handled.

### WARNING OAuth Onboarding Doesn’t Work In WhatsApp
- **Dimension:** UX/Design
- **Location:** Core Product Decisions (Primary Interface) & Onboarding Flow (Account connections)
- **Problem:** The plan claims the first 10 minutes—including linking Instagram, Google Calendar, Canva, Stripe—to happen inside a WhatsApp chat. WhatsApp cannot embed OAuth consent screens or support multi-step auth reliably; Meta blocks arbitrary links in Business API flows and mobile deep links will break on desktop. Coaches will stall at account connection, blocking all downstream features.
- **Recommendation:** Introduce a lightweight web onboarding portal (or in-app mini-site) that handles OAuth flows, surfaces connection status, and hands the coach back to WhatsApp once integrations succeed. Document the fallback for users starting on desktop vs. phone.

### WARNING Undo/Audit Trail Incompatible With Current Data Model
- **Dimension:** Architecture
- **Location:** Autonomy & Guardrails → Recovery & Audit Trail; Data Model (Content / Action)
- **Problem:** “One-click undo” is promised for any action, yet the schema only stores the final payload per Action and Content record. There is no version history, snapshot of previous external state, or mapping to Instagram post IDs. Without immutable versions, you cannot revert a scheduled post, delete an already-published IG asset, or recover prior text after edits.
- **Recommendation:** Extend Content/Action with immutable versions (e.g., ContentRevision table) storing rendered payloads and external identifiers. Log differential metadata for each external API call so undo routines know how to roll back (delete, update, re-sync). Define limits where undo is impossible (e.g., expired Stories) and surface them in UX.

### WARNING Sensitive-Content Guardrails Lack Detection Mechanism
- **Dimension:** Edge Cases
- **Location:** Autonomy & Guardrails → Sensitive Content Handling
- **Problem:** The spec says health or mental-health content must be flagged before posting, but there is no classifier, heuristics, or workflow to identify these cases. The AI model emits free text, and without automated detection, “never auto-post sensitive content” is unenforceable, risking regulatory exposure.
- **Recommendation:** Define a moderation pipeline (LLM-based classification plus keyword/regex fallbacks) executed before scheduling/publishing. Store the classification outcome with confidence so the confidence-based execution rules can consult it, and require manual review on low confidence.

### WARNING No UI For Reviewing Rich Content & Analytics
- **Dimension:** UX/Design
- **Location:** MVP Features → Content Creation & Analytics; WhatsApp Chat Interface
- **Problem:** Coaches are expected to review carousel scripts, Canva templates, analytics dashboards, and activity logs entirely inside WhatsApp quick-reply bubbles. There is no experience for previewing multi-slide posts, comparing performance metrics, or approving batches, which is critical for trust-building and compliance.
- **Recommendation:** Add a minimal web dashboard (or WhatsApp-delivered web preview links) where rich content, calendar views, and analytics can be inspected and approved. Define how WhatsApp messages deep-link into those surfaces and what happens on mobile vs desktop.

### WARNING Scheduling/Calendar Edge Cases Underspecified
- **Dimension:** Edge Cases
- **Location:** Scheduling & Calendar + Silence Handling
- **Problem:** The design does not address time zones, DST shifts, overlapping edits between coach and Google Calendar, token expiration, or Instagram posting limits. Without these, auto-scheduling risks double-booking sessions, missing posting windows, or silently failing when OAuth tokens expire (>30-day refresh requirement).
- **Recommendation:** Document explicit handling for: storing coach timezone per event, reconciling remote calendar edits, refreshing tokens before expiry, backing off when Instagram rate limits, and notifying coaches when posting fails so they can reauthorize.

### WARNING Execution Timeline Unrealistic
- **Dimension:** Task Plan
- **Location:** MVP Milestones (Weeks 1‑6)
- **Problem:** The six-week plan stacks WhatsApp Business API approval, Instagram publishing, Google Calendar sync, Canva partner integration, Stripe billing, analytics, guardrails, and multi-model orchestration sequentially with no slack or dependency mapping. WhatsApp/Canva approvals alone can take weeks, and there’s no allocation for QA, test harnesses, or security review.
- **Recommendation:** Re-plan with parallel workstreams, explicit external approval buffers, and dedicated QA hardening time. Flag integrations with uncertain timelines as risks and define interim fallbacks (e.g., SMS or web chat until WhatsApp is approved).

### WARNING Usage-Based Billing Without Metering Strategy
- **Dimension:** Architecture
- **Location:** Pricing Model & Technical Architecture
- **Problem:** The spec commits to per-post and per-interaction overage billing via Stripe Usage Records, yet there is no plan for how events are emitted, deduplicated, or reconciled with undo/delete operations. Miscounted posts will erode trust and cause billing disputes.
- **Recommendation:** Define a metering pipeline that writes immutable usage events (with coach_id, action_id, status) to a ledger table, batches them to Stripe daily, and compensates for undo operations via negative adjustments. Include monitoring and reconciliation dashboards.

### Summary
- **Total findings:** 1 critical, 7 warnings, 0 suggestions, 0 praise
- **Top 3 risks:** Missing background job infrastructure, unusable OAuth onboarding in WhatsApp, and lack of actionable undo/audit design.
- **Overall assessment:** Needs revisions before implementation.
- **Confidence level:** Medium