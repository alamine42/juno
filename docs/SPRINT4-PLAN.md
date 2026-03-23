# Sprint 4 Implementation Plan: Reminders + Polish + Launch Ready

## Overview
Sprint 4 (juno-ch1) delivers production-ready MVP with cron reminders, full test coverage, mobile optimization, error handling, admin dashboard, and health monitoring. Demo flow: login → onboard → chat → framework caption → save draft → plan week → receive reminder email → mark posted → edit settings.

---

## ⚠️ Design Review Findings (Addressed)

This plan has been revised based on adversarial design review. Key changes:

| Finding | Severity | Resolution |
|---------|----------|------------|
| Cron marks content "posted" after email | CRITICAL | Keep status as `reminder_set`, only mark `reminder_sent`. Coach manually confirms posting |
| Reminder emails skip moderation | CRITICAL | Add moderation checkpoint before each send, adjust email template per tier |
| Cron auth is fragile | WARNING | Add Vercel signature validation + IP check, no PII in response |
| Health endpoint leaks state | WARNING | Split: public `/api/health` → minimal "ok"; admin-only `/api/admin/health` → full telemetry |
| Admin gate spoofable via email | WARNING | Add `is_admin` column to coaches table, gate on DB flag not env var |
| Mobile plan ignores a11y | WARNING | Expand scope to include ARIA, focus management, prefers-reduced-motion |
| Testing lacks cron/health coverage | SUGGESTION | Add integration tests for cron and health endpoints |

---

## Implementation Order

### Phase 1: Infrastructure (Foundation)

#### 1. Health Check Endpoints + System Health Table
**Files:**
- `src/app/api/health/route.ts` (public, minimal)
- `src/app/api/admin/health/route.ts` (authenticated, full telemetry)
- `src/lib/supabase/service.ts` (new - service role client)

**Public Health Endpoint (for uptime monitors):**
```typescript
// GET /api/health - No auth, minimal response
interface PublicHealthResponse {
  status: 'ok'
  timestamp: string
}
// Returns 200 if server is up, nothing else
// No database info, no cron status, no version
```

**Admin Health Endpoint (for founder dashboard):**
```typescript
// GET /api/admin/health - Requires is_admin=true
interface AdminHealthResponse {
  status: 'ok' | 'degraded' | 'down'
  timestamp: string
  version: string
  services: {
    database: 'ok' | 'error'
    cron: { lastRun: string | null; status: 'ok' | 'stale' | 'never' }
  }
}
```

**Database migration:**
```sql
-- System health tracking
CREATE TABLE system_health (
  key VARCHAR PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON system_health
  FOR ALL USING (auth.role() = 'service_role');

-- Admin flag on coaches (for secure admin gating)
ALTER TABLE coaches ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

-- Set founder as admin (run manually after deploy)
-- UPDATE coaches SET is_admin = true WHERE email = 'founder@example.com';
```

**Service client for bypassing RLS:**
```typescript
// src/lib/supabase/service.ts
import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
```

---

#### 2. Cron Reminders Route (Revised)
**Files:**
- `src/app/api/cron/reminders/route.ts`
- `vercel.json`
- `.env.example` (update)

**Security hardening:**
```typescript
// Validate Vercel cron signature (not just Bearer token)
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
  // 1. Verify request is from Vercel Cron
  const headersList = await headers()
  const userAgent = headersList.get('user-agent')
  const cronSecret = headersList.get('authorization')

  // Vercel crons send specific user-agent
  const isVercelCron = userAgent?.includes('vercel-cron')
  const hasValidSecret = cronSecret === `Bearer ${process.env.CRON_SECRET}`

  if (!isVercelCron || !hasValidSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ... cron logic
}
```

**Revised route logic (addressing CRITICAL findings):**
1. Validate Vercel cron signature + CRON_SECRET
2. Use `createServiceClient()` to bypass RLS
3. Query: `SELECT c.*, coaches.email, coaches.name FROM content c JOIN coaches ON c.coach_id = coaches.id WHERE status = 'reminder_set' AND reminder_at <= NOW()`
4. **For each row:**
   - **Re-run moderation** on `c.body` before sending
   - If moderation = `red`: Skip send, log warning, do NOT update status
   - If moderation = `yellow`: Send with warning banner, no copy button
   - If moderation = `green`: Send normal email with copy button
5. Update `reminder_sent_at = NOW()` (NOT `status = 'posted'`)
   - Status remains `reminder_set` until coach manually confirms
6. Log failures, don't abort batch
7. Write to `system_health`: `{ key: 'last_cron_run', value: { timestamp, processed, skipped, errors } }`
8. Return minimal response: `{ ok: true }` (no counts to avoid info leak)

**POST handler for manual testing:**
```typescript
export async function POST(request: NextRequest) {
  // Same auth checks as GET
  // Allows founder to trigger reminders manually during demos
}
```

**vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

**Env vars to add:**
```
CRON_SECRET=<generate-random-32-char-string>
```

---

### Phase 2: Error Handling

#### 3. Error Boundary + ErrorMessage Component
**Files:**
- `src/app/error.tsx` (Next.js error boundary)
- `src/app/global-error.tsx` (root error boundary)
- `src/components/ui/ErrorMessage.tsx`

**error.tsx:**
```typescript
'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Page error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md text-center" role="alert" aria-live="assertive">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-600" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-6">
          We hit an unexpected error. This has been logged and we're looking into it.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} variant="secondary">
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            Try Again
          </Button>
          <Link href="/chat" className="inline-flex">
            <Button>
              <MessageCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              Back to Chat
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
```

**ErrorMessage.tsx:**
```typescript
interface ErrorMessageProps {
  message: string
  onDismiss?: () => void
  onRetry?: () => void
  className?: string
}

export function ErrorMessage({ message, onDismiss, onRetry, className }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl",
        className
      )}
    >
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-sm font-medium text-red-800">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-sm font-medium text-red-700 hover:text-red-800 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
          >
            Try again
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded p-1"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
```

**Page audit - add error handling to:**
- `/drafts/page.tsx` - wrap fetch in try/catch, show ErrorMessage
- `/settings/page.tsx` - wrap fetch in try/catch, show ErrorMessage
- `/chat/page.tsx` - already has error handling, verify ErrorMessage usage

---

### Phase 3: Testing (Expanded)

#### 4. Unit Tests for Claude Library
**File:** `src/lib/ai/__tests__/claude.test.ts` (extend existing)

**New test cases:**
```typescript
describe('generateContent', () => {
  it('returns success with content on valid response', async () => { ... })
  it('returns rate_limit error on 429', async () => { ... })
  it('returns api_error on 500', async () => { ... })
  it('returns invalid_request on 400', async () => { ... })
  it('returns api_error on empty content', async () => { ... })
  it('includes token usage when available', async () => { ... })
})

describe('buildSystemPrompt (via prompts.ts)', () => {
  it('builds prompt with null profile', async () => { ... })
  it('builds prompt with full profile', async () => { ... })
  it('truncates example posts over 500 chars', async () => { ... })
})
```

#### 5. Unit Tests for Email Library
**File:** `src/lib/email/__tests__/resend.test.ts` (new)

**Test cases:**
```typescript
describe('sendMagicLink', () => {
  it('sends email with correct from/to/subject', async () => { ... })
  it('throws on Resend error', async () => { ... })
})

describe('sendPostingReminder', () => {
  it('sends email with correct subject preview', async () => { ... })
  it('escapes HTML in coach name (XSS prevention)', async () => { ... })
  it('escapes HTML in content preview', async () => { ... })
  it('builds correct content URL', async () => { ... })
  it('throws on Resend error', async () => { ... })
})
```

#### 6. Integration Tests for Cron + Health (NEW)
**Files:**
- `src/app/api/cron/reminders/__tests__/route.test.ts` (new)
- `src/app/api/health/__tests__/route.test.ts` (new)

**Cron tests:**
```typescript
describe('/api/cron/reminders', () => {
  it('returns 401 without CRON_SECRET', async () => { ... })
  it('returns 401 without Vercel user-agent', async () => { ... })
  it('processes due reminders and updates reminder_sent_at', async () => { ... })
  it('skips red-flagged content', async () => { ... })
  it('sends warning email for yellow content', async () => { ... })
  it('continues batch on individual failures', async () => { ... })
  it('writes to system_health table', async () => { ... })
})
```

**Health tests:**
```typescript
describe('/api/health', () => {
  it('returns 200 with minimal status', async () => { ... })
  it('does not leak database or cron info', async () => { ... })
})

describe('/api/admin/health', () => {
  it('returns 401 for non-admin users', async () => { ... })
  it('returns full telemetry for admin users', async () => { ... })
})
```

---

### Phase 4: Mobile + Accessibility (Expanded)

#### 7. Mobile-First Responsive + A11y Audit
**Files to audit/update:**
- `src/app/chat/page.tsx`
- `src/app/drafts/page.tsx`
- `src/app/settings/page.tsx`
- `src/components/content/BatchModal.tsx`
- `src/components/content/ReminderModal.tsx`
- `src/components/frameworks/FrameworkPicker.tsx`

**Breakpoint strategy:**
```css
/* Mobile-first (default) */
.component { /* Mobile styles */ }

/* Tablet (640px+) */
@media (min-width: 640px) { /* sm: */ }

/* Desktop (1024px+) */
@media (min-width: 1024px) { /* lg: */ }
```

**Key responsive fixes:**
1. **Chat input** - Fixed to bottom on mobile, `position: sticky; bottom: 0`
2. **Modals** - Full-screen on mobile (`inset-4` → `inset-0` on mobile)
3. **Touch targets** - All buttons/links minimum 44x44px
4. **Content cards** - Stack on mobile (grid-cols-1), 2-col on tablet
5. **Framework picker** - Bottom sheet on mobile, overlay on desktop

**Accessibility requirements (from SPEC):**
1. **Focus management** - Focus trap in modals, restore focus on close
2. **ARIA roles** - `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
3. **Keyboard navigation** - Arrow keys for quick replies, Escape to close modals
4. **Live regions** - `aria-live="polite"` for status updates, errors
5. **Motion** - Respect `prefers-reduced-motion: reduce`
6. **Contrast** - Support `prefers-contrast: more`

**Implementation:**
```typescript
// prefers-reduced-motion hook
function usePrefersReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return prefersReduced
}

// Usage in animations
const prefersReduced = usePrefersReducedMotion()
const animationClass = prefersReduced ? '' : 'animate-fade-in'
```

**Verification checklist:**
- [ ] 375px (iPhone SE) - all text readable, no horizontal scroll
- [ ] 640px - tablet layout kicks in
- [ ] 768px (iPad) - verify spacing
- [ ] 1024px+ - desktop sidebar visible
- [ ] VoiceOver walkthrough - all interactive elements announced
- [ ] Keyboard-only navigation - can complete all flows
- [ ] Reduced motion - no animations when preference set

---

### Phase 5: Loading States Audit

#### 8. Loading States + Optimistic Updates
**Audit all interactive elements:**

| Component | Current | Fix |
|-----------|---------|-----|
| Chat send button | ✅ Has loading | Verify disabled |
| Settings save | ✅ Auto-save indicator | Add spinner |
| Draft delete | ❌ No loading | Add pending state |
| Batch generate | ✅ Has progress | Verify button disabled |
| Reminder set | ✅ Has loading | Verify disabled |

**Pattern to apply:**
```typescript
const [isPending, setIsPending] = useState(false)

async function handleAction() {
  setIsPending(true)
  try {
    await doThing()
  } catch (err) {
    setError(err.message)
  } finally {
    setIsPending(false)
  }
}

<Button disabled={isPending} loading={isPending} aria-busy={isPending}>
  {isPending ? 'Saving...' : 'Save'}
</Button>
```

**Add confirmation dialogs:**
- Delete content (already has `confirm()` - upgrade to accessible modal)
- Delete account (already has placeholder)

---

### Phase 6: Admin Dashboard (Revised)

#### 9. Founder Admin Dashboard
**File:** `src/app/admin/page.tsx`

**Access control (using DB flag, not env var):**
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

if (!user) {
  redirect('/auth/login')
}

// Check is_admin flag in database (not email comparison)
const { data: coach } = await supabase
  .from('coaches')
  .select('is_admin')
  .eq('id', user.id)
  .single()

if (!coach?.is_admin) {
  redirect('/chat')
}
```

**Metrics to display:**
```typescript
interface AdminMetrics {
  activeCoaches: number      // COUNT(DISTINCT coach_id) WHERE created_at > NOW() - 7 days
  generationsToday: number   // COUNT(*) FROM content WHERE created_at > TODAY
  errorRatePercent: number   // From tracking logs
  avgLatencyMs: number       // From tracking logs
  tokensUsedToday: number    // SUM from usage tracking
  estimatedCostUsd: number   // tokens * rate
  cronHealth: {
    lastRun: string | null
    status: 'ok' | 'stale' | 'never'
  }
}
```

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Admin Dashboard                          Cron: ● OK │
├──────────────┬──────────────┬──────────────┬────────┤
│ Active Users │ Generations  │ Error Rate   │ Latency│
│     12       │     47       │    2.1%      │  820ms │
├──────────────┴──────────────┴──────────────┴────────┤
│ API Usage Today                                     │
│ Tokens: 125,400 (~$0.38)                           │
├─────────────────────────────────────────────────────┤
│ Recent Activity                                     │
│ • coach@example.com - Hook Framework - 2min ago    │
│ • other@example.com - Carousel - 15min ago         │
│ • ...                                               │
└─────────────────────────────────────────────────────┘
```

**Empty state:**
> No data yet. Invite your first coaches!

---

## File Changes Summary

### New Files (11)
```
src/app/api/health/route.ts               (public, minimal)
src/app/api/admin/health/route.ts         (admin-only, full telemetry)
src/app/api/cron/reminders/route.ts
src/app/api/cron/reminders/__tests__/route.test.ts
src/app/api/health/__tests__/route.test.ts
src/lib/supabase/service.ts
src/app/error.tsx
src/app/global-error.tsx
src/components/ui/ErrorMessage.tsx
src/lib/email/__tests__/resend.test.ts
src/app/admin/page.tsx
vercel.json
```

### Modified Files (10+)
```
src/lib/ai/__tests__/claude.test.ts       (extend with generateContent tests)
src/app/drafts/page.tsx                   (error handling, mobile, a11y)
src/app/settings/page.tsx                 (error handling, mobile, a11y)
src/app/chat/page.tsx                     (mobile input, a11y)
src/components/content/BatchModal.tsx     (full-screen mobile, focus trap)
src/components/content/ReminderModal.tsx  (full-screen mobile, focus trap)
src/components/frameworks/FrameworkPicker.tsx (bottom sheet, keyboard nav)
src/components/ui/Button.tsx              (ensure loading prop, aria-busy)
.env.example                              (add CRON_SECRET)
```

### Database Migration
```sql
-- system_health table
-- is_admin column on coaches
```

---

## Patterns to Follow

### API Route with Vercel Cron Auth
```typescript
export async function GET(request: NextRequest) {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent')
  const cronSecret = headersList.get('authorization')

  // Verify Vercel cron + secret
  const isVercelCron = userAgent?.includes('vercel-cron')
  const hasValidSecret = cronSecret === `Bearer ${process.env.CRON_SECRET}`

  if (!isVercelCron || !hasValidSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ... cron logic
}
```

### Admin Route Protection
```typescript
// Use DB flag, not email comparison
const { data: coach } = await supabase
  .from('coaches')
  .select('is_admin')
  .eq('id', user.id)
  .single()

if (!coach?.is_admin) {
  redirect('/chat')
}
```

### Service Client Usage
```typescript
import { createServiceClient } from '@/lib/supabase/service'

// Bypasses RLS - use only in server routes with proper auth
const supabase = createServiceClient()
```

### Mobile-First Modal with A11y
```typescript
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  className={cn(
    "fixed z-50 bg-white shadow-2xl",
    // Mobile: full screen with rounded top
    "inset-0 rounded-t-2xl",
    // Desktop: centered overlay
    "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
    "sm:max-w-lg sm:w-full sm:rounded-2xl"
  )}
>
  <h2 id="modal-title">...</h2>
</div>
```

---

## Verification Checklist

### Infrastructure
- [ ] `/api/health` returns 200 with minimal `{ status: 'ok' }`
- [ ] `/api/health` does NOT leak database/cron info
- [ ] `/api/admin/health` returns 401 for non-admins
- [ ] `/api/admin/health` returns full telemetry for admins
- [ ] `/api/cron/reminders` returns 401 without Vercel signature
- [ ] `/api/cron/reminders` runs moderation before each send
- [ ] `/api/cron/reminders` skips red content, warns on yellow
- [ ] `/api/cron/reminders` updates `reminder_sent_at`, NOT `status`
- [ ] POST trigger works for manual testing
- [ ] `system_health` table records cron runs

### Error Handling
- [ ] `error.tsx` renders on thrown errors with ARIA roles
- [ ] ErrorMessage component dismissable
- [ ] All pages handle fetch errors with ErrorMessage
- [ ] No silent failures anywhere

### Testing
- [ ] 8+ Claude tests covering error conditions
- [ ] 6+ email tests covering XSS escaping
- [ ] 6+ cron tests covering auth, moderation, batch handling
- [ ] 4+ health tests covering public/admin separation
- [ ] All tests pass (`npm test`)

### Mobile + A11y
- [ ] Chat input fixed to bottom at 375px
- [ ] Modals full-screen on mobile
- [ ] Touch targets >= 44px
- [ ] No horizontal scroll on any page
- [ ] Focus trapped in modals
- [ ] Keyboard navigation works (arrows, escape, enter)
- [ ] `aria-live` regions announce status changes
- [ ] `prefers-reduced-motion` disables animations
- [ ] VoiceOver walkthrough successful

### Loading States
- [ ] Every button has loading state + `aria-busy`
- [ ] Delete actions have accessible confirmation modal
- [ ] Page loads show spinner/skeleton

### Admin
- [ ] Only `is_admin=true` users can access `/admin`
- [ ] Metrics display correctly
- [ ] Cron health indicator works
- [ ] Empty state shows for new installs

---

## Dependencies
- No new npm packages required
- Supabase migration: `system_health` table + `coaches.is_admin` column
- Environment variables: `CRON_SECRET`

## Estimated Scope
- 11 new files (was 8)
- 10+ modified files
- ~1500-1800 lines of new code
- ~500 lines of new tests (was ~300)
