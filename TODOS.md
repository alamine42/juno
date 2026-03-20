# TODOS

## P2: Conversation-to-Content Pipeline

**What:** Detect content-worthy moments in casual chat and offer to turn them into posts.
**Why:** Makes content creation effortless — happens in the flow of conversation instead of as a separate task. Strong differentiator from ChatGPT.
**Pros:** New content creation pathway, captures moments coaches would otherwise forget.
**Cons:** Requires good intent detection to avoid being annoying (false positive = suggesting a post for everything the coach says).
**Context:** Deferred from CEO review expansion ceremony (2026-03-18). Needs beta usage data to calibrate detection threshold — how often do coaches chat casually vs. give direct commands? If mostly commands, low impact.
**Effort:** M (human) → S (CC)
**Depends on:** MVP chat working, learning loop data to calibrate threshold.
**Source:** CEO Plan Review 2026-03-18, Expansion Proposal #1

## P2: DESIGN.md via /design-consultation

**What:** Run /design-consultation to create a formal DESIGN.md with typography, colors, components, spacing, and brand identity.
**Why:** The baseline design tokens from the design review cover MVP, but without a formal system every new screen is an ad hoc decision. A DESIGN.md prevents drift as the product grows.
**Pros:** Consistency across all screens, faster implementation (no per-component design decisions), professional foundation for Phase 2+.
**Cons:** Adds ~1 hour. Not blocking MVP.
**Context:** The design review (2026-03-19) established a baseline (green-600 primary, Inter font, Tailwind spacing, rounded-lg buttons) derived from existing onboarding code. A formal DESIGN.md would codify and extend this with full palette, component library, and brand guidelines. Run before Phase 2 when new screens are added.
**Effort:** M (human: ~2 days) -> CC: ~1 hour
**Depends on:** Nothing.
**Source:** Design Plan Review 2026-03-19, TODO Proposal

## P2: PWA (Progressive Web App) Support

**What:** Add PWA manifest, service worker, and "Add to Home Screen" prompt.
**Why:** Fitness coaches are on their phones all day between clients. PWA makes Juno feel like a native app — instant load, home screen icon, push notification capability.
**Pros:** App-like experience, enables push notifications (reduces email dependency), loads fast on poor connections.
**Cons:** Adds service worker complexity. Next.js PWA support via next-pwa package.
**Context:** The spec mentions PWA in the context of "re-enabling full autonomy" (push verified → can_auto_post). For post-MVP, it's a UX improvement that compounds with mobile-first design.
**Effort:** S (human: ~2 days) → S (CC: ~30 min)
**Depends on:** Mobile-first UI (decided in CEO review).
**Source:** CEO Plan Review 2026-03-18, TODO Proposal #3
