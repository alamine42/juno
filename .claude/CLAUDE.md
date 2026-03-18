# Juno Project Guidelines

## gstack

Install gstack for web browsing, QA, and reviews:
```bash
git clone https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup
```

Use the `/browse` skill from gstack for **all web browsing**. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:
- `/browse` — Headless browser for web browsing, QA testing, and site dogfooding
- `/qa` — Full QA testing workflow
- `/qa-only` — QA testing without code changes
- `/review` — Code review
- `/ship` — Ship workflow (review + tests + commit)
- `/design-review` — Design review
- `/design-consultation` — Design consultation
- `/office-hours` — Office hours format
- `/plan-ceo-review` — Plan CEO review
- `/plan-eng-review` — Plan engineering review
- `/plan-design-review` — Plan design review
- `/debug` — Debug workflow
- `/retro` — Retrospective
- `/document-release` — Document a release
- `/setup-browser-cookies` — Set up browser cookies for authenticated browsing
