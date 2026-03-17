# Juno

> AI Chief of Staff for Coaches

Juno helps fitness and wellness coaches create Instagram content that sounds like them. Chat with Juno, get captions in your voice, plan your week's content in minutes.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

## Documentation

- **[MVP.md](./MVP.md)** - Current sprint scope and checklist
- **[SPEC.md](./SPEC.md)** - Full product specification
- **[docs/](./docs/)** - Architecture decisions

## Tech Stack

- **Next.js 14** - React framework
- **Supabase** - Database, auth, realtime
- **Claude API** - AI content generation
- **Vercel** - Hosting
- **Resend** - Email

## Project Structure

```
src/
├── app/          # Next.js pages and API routes
├── components/   # React components
├── lib/          # Utilities (Supabase, AI, email)
└── types/        # TypeScript types
```

## License

Private - All rights reserved
