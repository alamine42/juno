# Juno MVP

> Ship in 4 weeks. Validate with 10 coaches.

## What We're Building

An AI assistant that helps coaches create Instagram content. Coaches chat with Juno, get captions generated in their voice, and copy/paste to Instagram manually.

**Core loop:** Chat → Generate → Copy → Post manually

## Differentiation (vs. ChatGPT)

| Feature | What it does | Why it matters |
|---------|--------------|----------------|
| **Voice Learning** | Captures coach's style during onboarding | "Juno knows my voice from day one" |
| **Content Frameworks** | 5 guided templates for proven formats | "Juno guides me through what works" |
| **Batch Generation** | "Plan my week" creates 5-6 posts at once | "Juno plans my whole week in minutes" |

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 + TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (magic link) |
| Realtime | Supabase Realtime |
| AI | Claude API (Anthropic) |
| Email | Resend |
| Hosting | Vercel |
| Background Jobs | Vercel Cron |

---

## Features

### Week 1: Foundation
- [ ] Project setup (Next.js, Supabase, Vercel)
- [ ] Database schema (coaches, brand_profiles, content, chat_messages)
- [ ] Auth flow (magic link signup/login)
- [ ] Basic middleware (protected routes)

### Week 2: Onboarding + Chat
- [ ] Brand profile onboarding (5 required questions + 4 optional)
- [ ] Skip flow (prompt again after 3 generations)
- [ ] Web chat interface
- [ ] Chat persistence (Supabase Realtime)
- [ ] Settings page (edit brand voice)

### Week 3: Content Generation
- [ ] Claude integration with voice learning
- [ ] Framework picker UI
- [ ] Guided framework flows (5 frameworks)
- [ ] Batch generation ("Plan My Week")
- [ ] Content list view
- [ ] Copy-to-clipboard

### Week 4: Polish + Launch
- [ ] Posting reminders (email via Resend)
- [ ] Vercel cron for reminder delivery
- [ ] Basic moderation (Green/Yellow/Red)
- [ ] Error handling + loading states
- [ ] Mobile responsive
- [ ] Beta launch (5-10 coaches)

---

## The 5 MVP Skills

```
1. generate_caption  - Create caption from prompt or framework
2. edit_caption      - Refine based on feedback
3. save_draft        - Store for later
4. schedule_reminder - Email reminder to post
5. chat              - General conversation
```

---

## The 5 Content Frameworks

| Framework | Purpose | Output |
|-----------|---------|--------|
| Client Win Story | Celebrate success, social proof | Single caption |
| Educational Carousel | Teach, establish expertise | 8-slide script |
| Engagement Hook | Start conversations | Short caption |
| Behind the Scenes | Build connection | Casual caption |
| Myth Buster | Challenge misinformation | Medium caption |

---

## Data Model (Core Tables)

```
coaches
├── id, email, name, timezone

brand_profiles (1:1 with coach)
├── style_words, tone, emoji_usage, sign_off
├── avoided_topics[], avoided_words[], preferred_words[]
├── target_audience, example_posts[]
├── completed_at, skipped_count

content
├── coach_id, type, status, body
├── framework_id, framework_answers
├── batch_id, batch_position
├── reminder_at

chat_messages
├── coach_id, role, content
├── content_id (optional link to generated content)

content_batches
├── coach_id, focus_topic, posting_days[]
├── status, promotion_text
```

---

## API Routes

```
/api/auth/callback     - Supabase auth callback
/api/chat              - POST: Send message, get response
/api/content           - GET: List, POST: Create
/api/content/[id]      - GET, PATCH, DELETE
/api/content/batch     - POST: Generate week of content
/api/frameworks        - GET: List available frameworks
/api/profile           - GET, PATCH: Brand profile
/api/cron/reminders    - Vercel cron: Send due reminders
```

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Email
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

---

## Project Structure

```
juno/
├── src/
│   ├── app/
│   │   ├── auth/           # Login, callback
│   │   ├── chat/           # Main chat interface
│   │   ├── onboarding/     # Brand profile setup
│   │   ├── api/            # API routes
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/             # Buttons, inputs, etc.
│   │   └── chat/           # Chat-specific components
│   ├── lib/
│   │   ├── supabase/       # Client, server, middleware
│   │   ├── ai/             # Claude integration
│   │   └── email/          # Resend integration
│   └── types/
│       └── database.ts     # Supabase types
├── supabase/
│   └── migrations/         # SQL migrations
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── MVP.md                  # This file
```

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Beta users | 10 coaches |
| 30-day retention | 70%+ |
| Captions/coach/month | 10+ |
| Content rejection rate | <10% |
| NPS | 40+ |

---

## NOT in MVP

- WhatsApp
- Auto-posting to Instagram
- Google Calendar
- Stripe billing
- Analytics dashboard
- Full voice learning (ML-based)
- Video/audio content
- Knowledge base uploads

---

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in your keys

# Run Supabase migration
# Go to Supabase dashboard → SQL Editor → Run 00001_initial_schema.sql

# Start dev server
npm run dev
```

---

## Daily Standup Questions

1. What did I ship yesterday?
2. What's blocking me?
3. What's the ONE thing I'm shipping today?

---

*Last updated: March 2026*
