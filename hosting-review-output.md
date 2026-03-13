### CRITICAL Sensitive-Content Guardrail Break
- **Dimension:** Edge Cases
- **Location:** “Sensitive Content Detection & Handling” section
- **Problem:** Moderation only runs “before any content is scheduled/posted” on the system-generated revision. Coaches can edit copy in WhatsApp or the portal after that point, yet there’s no commitment to re-run the pipeline on the final revision that actually hits Instagram. A coach tweak or an LLM auto-adjust during scheduling can therefore bypass guardrails and publish health claims or regulated speech unchecked—one slip can violate Instagram policy or even local advertising regulations.
- **Recommendation:** Treat moderation as part of the publish transaction: re-run detection every time `Content.current_revision_id` changes and again immediately before posting (even if already scheduled). Block posting until the latest revision is re-cleared or explicitly approved, and track the moderation version alongside `ContentRevision`.

### WARNING Worker Platform Still Undecided
- **Dimension:** Architecture
- **Location:** `docs/HOSTING-DECISION.md`
- **Problem:** The document enumerates options but never commits to one, while the MVP timeline (Week 3 onward) assumes scheduling, retries, DLQs, and background orchestration are available. Without locking a platform, you can’t design queue schemas, deployment automation, or monitoring, and the engineering plan past Week 2 is essentially fictional.
- **Recommendation:** Decide now which worker stack (Inngest vs Railway, etc.) will ship with the MVP, document the choice, and reflect it in the milestone plan (e.g., concrete tasks for provisioning, deployment, observability, and cost guardrails).

### WARNING Instagram Data Access Assumption
- **Dimension:** Edge Cases
- **Location:** “Onboarding Phase 2: Content analysis”
- **Problem:** The flow assumes Juno can “analyze recent Instagram posts” for every coach, but Meta only exposes historical media through the Graph API for Business/Creator accounts linked to a Facebook page. Many solo coaches run standard personal accounts; the doc never states a requirement to upgrade or provides a fallback for those users. Voice learning would silently fail, leaving onboarding stuck or generating off-brand content.
- **Recommendation:** Explicitly require Business/Creator accounts during signup (with education on how to convert) or ship a backup ingestion path (manual upload, Google Drive import) so brand learning works even when API access is unavailable.

### WARNING WhatsApp Fallback Underspecified
- **Dimension:** UX/Design
- **Location:** “WhatsApp Chat Interface” + “Fallback Plans” table
- **Problem:** WhatsApp is the primary interface, yet the fallback “web chat” is just a line in the fallback table. There’s no UX description for how proactive nudges, quick replies, or deep links translate when WhatsApp approval is delayed. Launching with an undefined fallback risks either duplicating the WhatsApp interaction model in Week 5 (impossible) or shipping a broken MVP where coaches can’t interact with Juno outside OAuth flows.
- **Recommendation:** Flesh out the fallback UX now: specify the exact chat surface, how quick actions work, and how it integrates with the same conversation state. Add corresponding tasks in Weeks 4–6 so the fallback is real, not a placeholder.

### WARNING Usage Metering Rules Not Backed by Design
- **Dimension:** Task Plan
- **Location:** “Usage Metering Pipeline” section + Week 7 milestones
- **Problem:** Business rules like “undone posts within 1 hour are not billed” and “failed posts are not billed” require precise event sourcing, clock synchronization, and compensating transactions. Yet the task plan only says “Usage metering pipeline” in Week 7—no mention of schema changes (timestamps, audit of undo reason), no scheduled job to prune or re-rate, and no tests around edge cases like retries after partial failures. Without that groundwork you’ll over/under bill and lose trust.
- **Recommendation:** Break Week 7 into explicit tasks: extend `UsageEvent` with undo references and decision timestamps, implement the compensating-event job, add automated reconciliation tests, and document how the 1-hour window is enforced.

### SUGGESTION Activity Log Missing Failure Surfacing
- **Dimension:** UX/Design
- **Location:** “Activity log and audit trail browser” + “Recovery & Audit Trail”
- **Problem:** The activity log promises undo buttons, but there’s no UX guidance for partial failures (e.g., Instagram delete succeeds but cached copies remain, or Google Calendar undo fails because the event changed externally). Without explicit messaging, coaches will click undo expecting certainty and get silent failures.
- **Recommendation:** Define log states for “Undo pending”, “Undo partial”, “Undo failed” with clear explanations and remediation paths (retry, contact support). Ensure WhatsApp notifications mirror those states so coaches aren’t surprised.

### Summary
- **Total findings:** 1 critical, 4 warnings, 1 suggestion, 0 praise  
- **Top 3 risks:** (1) Moderation pipeline can be bypassed by late edits, leading to policy violations. (2) Background job stack remains undecided, so the entire scheduling/autonomy layer lacks a foundation. (3) Instagram content ingestion assumes Business accounts without backup, blocking voice learning for many coaches.  
- **Overall assessment:** Needs revisions before implementation; key architectural and compliance questions remain unanswered.  
- **Confidence level:** Medium-low—too many unresolved platform and guardrail gaps to trust the MVP timeline as written.