# Worker/Agent Hosting Decision

## Context

Juno requires background workers to handle autonomous agent behavior:
- Scheduled content posting to Instagram
- OAuth token refresh (proactive, 7 days before expiry)
- Google Calendar sync (every 15 minutes)
- Silence detection (daily check if coach unresponsive)
- Webhook processing (Instagram, WhatsApp events)
- Usage metering (daily batch to Stripe)

Vercel (our web host) cannot run long-lived or scheduled tasks. We need a separate solution.

## Constraints

- **Solo founder** building MVP in 8 weeks
- **Budget-conscious** - need to keep costs low initially
- **Must support:** Scheduled jobs, retries with backoff, dead letter queues
- **Scale:** Starting with 10 coaches, targeting 100-500 in year 1
- **Reliability:** Autonomous posting means failures = missed posts = angry coaches

## Options Under Consideration

### Option 1: Inngest (Managed)

**What it is:** Managed durable execution platform, purpose-built for background jobs.

**Architecture:**
```
Vercel API Route → Inngest SDK → Inngest Cloud → Your function executes
```

**Pricing:**
- Free tier: 5,000 steps/month
- Pro: $50/month for 50,000 steps
- Step = one function execution or sleep/wait

**Pros:**
- Zero infrastructure to manage
- Built-in retries, scheduling, fan-out
- Great TypeScript SDK, works seamlessly with Next.js
- Automatic observability/logging
- Can run functions on Vercel Edge or separate compute

**Cons:**
- Vendor lock-in (though functions are portable)
- Cost scales with usage (could get expensive at 500+ coaches)
- Another third-party dependency

### Option 2: Railway (Self-Managed Workers)

**What it is:** PaaS for deploying containers/apps. Run a Node.js worker process.

**Architecture:**
```
Vercel API → Redis Queue (BullMQ) → Railway Worker Process → External APIs
```

**Pricing:**
- $5/month base + usage (~$0.000463/min for compute)
- Estimated: $15-30/month for MVP workload

**Pros:**
- Full control over worker code
- Predictable pricing
- Can run Redis on Railway too
- No vendor lock-in on job logic

**Cons:**
- Must manage BullMQ, retries, dead letter queues yourself
- More code to write and maintain
- Must handle scaling, monitoring, restarts
- Another deployment target to manage

### Option 3: Fly.io (Self-Managed Workers)

**What it is:** Edge-native PaaS, good for long-running processes.

**Architecture:**
```
Vercel API → Upstash Redis Queue → Fly.io Worker → External APIs
```

**Pricing:**
- Free tier: 3 shared VMs
- Pay-as-you-go: ~$5-15/month for small worker

**Pros:**
- Very cheap for small workloads
- Global edge deployment if needed
- Persistent volumes available
- No cold starts (always-on VMs)

**Cons:**
- Steeper learning curve (Dockerfile, fly.toml)
- Must manage queue infrastructure
- Less polished DX than Railway

### Option 4: Vercel Cron + Serverless

**What it is:** Use Vercel's cron jobs to trigger API routes on schedule.

**Architecture:**
```
Vercel Cron → API Route → Process jobs from Redis/Postgres queue
```

**Pricing:**
- Included in Vercel Pro ($20/month)
- Limited to 1-minute minimum intervals

**Pros:**
- No additional infrastructure
- Simple deployment (same codebase)
- Good enough for many use cases

**Cons:**
- Max 10-second execution (300s on Pro with background functions)
- Not suitable for long-running jobs
- Cron-only, no event-driven triggers
- Queue still needed for reliability

### Option 5: AWS Lambda + SQS

**What it is:** Serverless functions triggered by queue messages.

**Architecture:**
```
Vercel API → SQS Queue → Lambda Function → External APIs
```

**Pricing:**
- Essentially free at MVP scale
- $0.20 per 1M requests

**Pros:**
- Infinitely scalable
- Very cheap
- Battle-tested reliability
- Native retry/DLQ support

**Cons:**
- Complex setup (IAM, CloudFormation, etc.)
- Cold starts
- Context switching between Vercel and AWS
- Overkill for MVP

## Evaluation Criteria

| Criteria | Weight | Description |
|----------|--------|-------------|
| Time to implement | 30% | Solo founder, 8-week timeline |
| Operational complexity | 25% | Less ops = more time for product |
| Cost at MVP scale | 15% | 10-50 coaches |
| Cost at growth scale | 10% | 500+ coaches |
| Reliability | 15% | Missed posts = churn |
| Portability | 5% | Can we migrate later? |

## Decision: Inngest

**Chosen option:** Inngest (managed durable execution)

**Rationale:**
1. **Time to implement (30% weight):** Inngest SDK works in hours, not days. Solo founder can't afford to build queue infrastructure.
2. **Ops complexity (25% weight):** Zero ops - no Redis queues, no worker processes, no scaling concerns.
3. **Reliability (15% weight):** Built-in retries, dead letter queues, and observability out of the box.
4. **Cost (25% weight):** Free tier covers MVP (10 coaches). Pro tier ($50-100/mo) is negligible vs. revenue at 500 coaches.
5. **Portability (5% weight):** Functions are standard TypeScript - can migrate to BullMQ later if needed.

**Migration path:**
When Inngest costs exceed $200/mo (~500+ coaches), migrate high-volume jobs to Railway + BullMQ:
1. Abstract job handlers behind `JobRunner` interface
2. Keep complex workflows (multi-step, fan-out) on Inngest
3. Move simple high-volume jobs (usage reporting) to BullMQ

**Cost projection:**
| Scale | Steps/month | Cost |
|-------|-------------|------|
| 10 coaches | ~2,000 | Free |
| 50 coaches | ~10,000 | $50/mo |
| 200 coaches | ~40,000 | $50/mo |
| 500 coaches | ~100,000 | $100/mo |

---

## Questions Answered

1. **Which option balances speed vs. control?** Inngest - speed wins for MVP, control can come later.
2. **Is Inngest's pricing reasonable?** Yes - at 500 coaches paying $49-99/mo, $100/mo for Inngest is <0.5% of revenue.
3. **Silent job loss?** Inngest has built-in DLQ and observability. No silent failures.
4. **Hybrid approach?** Not needed for MVP. Inngest handles all job types.
5. **Migration path?** Abstract behind interface, migrate to BullMQ when costs justify.
