/**
 * Environment variable validation module.
 * Validates required env vars at import time and throws descriptive errors if missing.
 *
 * NOTE: This module is for SERVER-SIDE use only.
 * Client components should use process.env.NEXT_PUBLIC_* directly
 * since those are inlined by Next.js at build time.
 */

const isServer = typeof window === 'undefined'

function getRequiredServerEnv(name: string): string {
  if (!isServer) {
    throw new Error(
      `Attempted to access server-side env var "${name}" from client.\n` +
      `Server env vars are only available in API routes, Server Components, and server actions.`
    )
  }
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
      `Please add ${name} to your .env.local file.\n` +
      `See .env.example for reference.`
    )
  }
  return value
}

function getRequiredPublicEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
      `Please add ${name} to your .env.local file.\n` +
      `See .env.example for reference.`
    )
  }
  return value
}

function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue
}

// Public env vars (available in browser via Next.js inlining)
// These use lazy getters to avoid validation errors during module load in browser
export const NEXT_PUBLIC_SUPABASE_URL = getRequiredPublicEnv('NEXT_PUBLIC_SUPABASE_URL')
export const NEXT_PUBLIC_SUPABASE_ANON_KEY = getRequiredPublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
export const NEXT_PUBLIC_APP_URL = getRequiredPublicEnv('NEXT_PUBLIC_APP_URL')

// Server-side only env vars (will throw if accessed from client)
export const SUPABASE_SERVICE_ROLE_KEY = isServer ? getRequiredServerEnv('SUPABASE_SERVICE_ROLE_KEY') : ''
export const ANTHROPIC_API_KEY = isServer ? getRequiredServerEnv('ANTHROPIC_API_KEY') : ''
export const RESEND_API_KEY = isServer ? getRequiredServerEnv('RESEND_API_KEY') : ''

// Optional env vars with defaults
export const CLAUDE_MODEL = getOptionalEnv('CLAUDE_MODEL', 'claude-sonnet-4-20250514')
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''
