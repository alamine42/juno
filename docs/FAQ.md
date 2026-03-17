# Juno MVP - Frequently Asked Questions

## Product & Scope

### What is the MVP scope?

A 4-week build with minimal features to validate the core value proposition:

| In MVP | Not in MVP |
|--------|------------|
| Web chat only | WhatsApp |
| Claude generates captions | Auto-posting to Instagram |
| Manual copy/paste posting | Google Calendar sync |
| 5 content frameworks | Analytics dashboard |
| Lightweight voice learning | Full ML-based voice learning |
| Batch generation ("Plan My Week") | Stripe billing |
| Email reminders | Video/audio content |

**The 5 MVP Skills:**
1. `generate_caption` - Create caption from prompt or framework
2. `edit_caption` - Refine based on feedback
3. `save_draft` - Store for later
4. `schedule_reminder` - Email reminder to post
5. `chat` - General conversation

### Where is the MVP documented?

- **MVP.md** - Focused 4-week implementation checklist
- **SPEC.md** (line 2359+) - Full specification with "TRUE MINIMUM MVP" section

---

## Differentiation

### How does this MVP offer differentiated value over just using ChatGPT/Claude directly?

The raw MVP skills (generate/edit/save) aren't differentiated. The value comes from three features:

| Feature | Differentiation |
|---------|-----------------|
| **Voice Learning** | Captures coach's style during onboarding. ChatGPT forgets you. Juno knows your voice from day one. |
| **Content Frameworks** | 5 guided templates for proven formats. ChatGPT requires you to know what to ask. Juno guides you. |
| **Batch Generation** | "Plan my week" creates 5-6 varied posts at once. ChatGPT is one-at-a-time. Juno thinks in content calendars. |

**Value proposition:** "Juno knows my voice, guides me through proven content formats, and plans my whole week in minutes."

---

## Infrastructure

### What infrastructure do we need for the MVP?

**4 services:**

| Service | Purpose | Cost |
|---------|---------|------|
| **Supabase** | PostgreSQL + Auth + Realtime | Free tier |
| **Vercel** | Hosting + Cron | Free → $20/mo |
| **Anthropic** | Claude API | ~$0.01-0.05/generation |
| **Resend** | Email delivery | Free tier (100/day) |

**NOT needed for MVP:** Redis, Inngest, Railway, Stripe, Instagram API, WhatsApp API.

**Estimated cost:** $5-30/mo for 10 coaches, $45-95/mo for 50 coaches.

---

## User Experience

### How would users interact with this MVP version?

**Core loop:** Chat → Generate → Copy → Post manually

1. **Sign up** via magic link (email)
2. **Onboarding** (2 min) - Answer 5-9 questions about their brand voice
3. **Chat** - Pick a framework or describe what they need
4. **Generate** - Juno creates content in their voice
5. **Copy** - Click to copy caption to clipboard
6. **Post** - Open Instagram, paste, add photo, publish

**Or use reminders:**
- Coach says "remind me tomorrow 9am"
- Juno sends email at 8:45am with content + copy button

**Batch mode:**
- "Plan my week" → Answer 4 questions → Get 5-6 posts with variety
- Save all as drafts, set reminders for each

---

## Multi-Tenancy & Data Isolation

### Do coaches each get their own agent with memory of their context?

**Partially.** Each coach gets:

| Feature | Persistent? | Notes |
|---------|-------------|-------|
| Brand Profile | ✅ Yes | Injected into every prompt |
| Chat History | ✅ Yes | Loaded on session start |
| Content/Drafts | ✅ Yes | Stored per coach |

**What MVP does NOT have:**
- Learning memory ("Coach prefers shorter captions")
- Cross-session context beyond brand profile
- "Remember when I said..." capabilities
- RAG/vector search over past content

Full memory system is deferred to Phase 3.

### How do we guarantee data isolation between coaches?

**Row Level Security (RLS)** at the database level - the strongest pattern for multi-tenant SaaS.

**How it works:**

```sql
-- Every table has RLS enabled
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Policies enforce: you can ONLY see your own data
CREATE POLICY "Coaches can view own content"
  ON content FOR SELECT
  USING (coach_id = auth.uid());  -- auth.uid() from JWT
```

**Effect:**
```sql
-- Coach A runs:
SELECT * FROM content;

-- Database actually executes:
SELECT * FROM content WHERE coach_id = 'coach-a-id';

-- Coach A literally CANNOT see Coach B's data
```

**All tables have RLS:** coaches, brand_profiles, content, chat_messages, content_batches, framework_usage.

**Defense in depth:**
1. **Middleware** - Validates JWT, rejects if invalid
2. **API Routes** - Use Supabase client with user's JWT
3. **Database** - RLS policies filter ALL queries
4. **Claude API** - Only receives data already filtered by RLS

**Key point:** Data isolation happens at the DATABASE level, not the AI level. Claude doesn't "know" about multiple coaches. Each request is stateless and only contains data RLS already filtered.

---

## Technical Architecture

### How does voice learning work without ML?

MVP voice learning is **prompt engineering + persistent storage**, not machine learning:

1. **Onboarding** captures style (tone, emoji usage, sign-off, avoided topics, example posts)
2. **Stored** in `brand_profiles` table
3. **Injected** into system prompt for every generation:

```typescript
const systemPrompt = `You are Juno...

## This Coach's Brand Voice
**Style:** energetic, no-BS, supportive
**Tone:** motivational
**Emoji usage:** frequently
**Sign-off:** "Let's go! 💪"
**Topics to NEVER mention:** politics, specific diets

**Examples of their writing:**
1. "My best performing post..."

Match this voice exactly.`
```

### How do content frameworks work?

Each framework has:
- **Questions** to ask the coach
- **Prompt template** with placeholders
- **Output type** (caption or carousel script)

Example flow:
```
Coach picks "Client Win Story"
    → Juno asks: Client name? Achievement? Obstacle? Timeframe? Lesson?
    → Juno fills template + adds brand voice
    → Claude generates
    → Coach gets caption ready to post
```

5 MVP frameworks: Client Win, Educational Carousel, Engagement Hook, Behind the Scenes, Myth Buster.

---

*Last updated: March 2026*
