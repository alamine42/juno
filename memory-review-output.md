### [CRITICAL] Web-Chat WebSockets Clash with Vercel Serverless Stack
- **Dimension:** Architecture
- **Location:** SPEC.md – “Web Portal” / “Web Chat Fallback”, Technical Architecture (Next.js on Vercel)
- **Problem:** The fallback chat is specified as a browser-based WebSocket experience with parity to WhatsApp, yet the only backend runtime called out is Vercel serverless/edge. Vercel’s standard serverless functions cannot hold long-lived WebSocket connections (they tear down after the request), so the described architecture literally cannot deliver reliable bi-directional chat, proactive nudges, or quick-reply state sync. Without an alternate real-time transport, your day-1 fallback channel has no viable backend.
- **Recommendation:** Explicitly add a persistent real-time layer (e.g., Ably/Pusher, Supabase Realtime, Fly/Railway-hosted Node service, or WebRTC data channels) and capture how it authenticates to the Conversation model. Alternatively define an SSE/long-polling strategy that works on Vercel, along with retry/backoff semantics.

### [WARNING] Coaches Without Business IG Accounts Hit a Dead End
- **Dimension:** Edge Cases
- **Location:** SPEC.md – “Onboarding UX: If personal account detected… allow manual upload”, “MVP Features – Content Creation/Scheduling”
- **Problem:** The onboarding flow promises coaches with personal accounts that they can continue by pasting captions or screenshots, but the rest of the MVP (auto-posting, scheduling, analytics) still depends on Instagram Business/Creator APIs. There is no described degraded mode once they finish onboarding—Juno cannot schedule or post for them, undermining the product’s core value and likely tanking retention/activation metrics.
- **Recommendation:** Either (1) block activation of automation features until the account is upgraded, with clear UI and proactive nudges showing what is missing, or (2) define a manual “upload + reminder” workflow that still delivers tangible value without API access. Document the state machine (personal vs. business) and ensure WhatsApp/web portal copy reflects the limitation.

### [WARNING] Moderation Rules Will Flag Most Life-Coach Content
- **Dimension:** UX/Design
- **Location:** SPEC.md – “Sensitive Content Detection & Handling”
- **Problem:** The detection pipeline categorically flags “weight loss”, “anxiety”, “depression”, “mental health topics”, “transformations”, etc. These topics are central to the identified target personas (life/mindset coaches, personal trainers). Because anything flagged can never auto-post, a majority of their everyday content will require manual approval, nullifying the promised autonomy and increasing operational load.
- **Recommendation:** Refine moderation policy to distinguish regulated claims from routine coaching language (e.g., use classifier labels + per-coach allow-lists, confidence thresholds, or policy tiers). Consider letting coaches explicitly attest to compliant messaging so non-medical motivational content can still auto-post, while still blocking true medical claims.

### [WARNING] Memory/Vector Commitments Don’t Match the Build Plan
- **Dimension:** Task Plan
- **Location:** SPEC.md – Week 4/6 milestones vs. docs/MEMORY-ARCHITECTURE.md “Implementation Plan”
- **Problem:** The spec commits to voice anchoring, semantic retrieval, feedback embeddings, and drift detection by Week 6–8, all of which require pgvector embeddings. However, the Memory Architecture doc’s own implementation plan says the MVP (Weeks 4–5) will run “PostgreSQL only (no vector DB yet)” with just the “last 10 conversations in context.” Those constraints make the promised anchor similarity checks and lesson retrieval impossible, so either timelines slip or the features ship non-functional.
- **Recommendation:** Reconcile the plan: either schedule pgvector + embedding generation earlier (Week 3–4) so the downstream features have data, or officially descoped the anchor/drift features from the MVP milestone set. Update milestones to show dependencies (e.g., “pgvector ready before Voice Anchor comparison”).

### Summary
- **Total findings:** 1 critical, 3 warnings, 0 suggestions, 0 praise
- **Top 3 risks:** (1) Web chat cannot work on the stated infrastructure, (2) non-Business Instagram accounts can onboard but never reach core value, (3) moderation policy blocks most target-coach content, eliminating promised autonomy.
- **Overall assessment:** Needs revisions before implementation.
- **Confidence level:** Medium