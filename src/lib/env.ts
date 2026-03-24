/**
 * Environment variable validation module.
 * Provides lazy getters for env vars that throw descriptive errors when accessed but not set.
 *
 * NOTE: This module is for SERVER-SIDE use only.
 * Client components should use process.env.NEXT_PUBLIC_* directly
 * since those are inlined by Next.js at build time.
 */

const isServer = typeof window === 'undefined'

function createLazyEnvGetter(name: string, required: boolean = true) {
  return () => {
    if (!isServer) {
      throw new Error(
        `Attempted to access server-side env var "${name}" from client.\n` +
        `Server env vars are only available in API routes, Server Components, and server actions.`
      )
    }
    const value = process.env[name]
    if (!value && required) {
      throw new Error(
        `Missing required environment variable: ${name}\n` +
        `Please add ${name} to your .env.local file.\n` +
        `See .env.example for reference.`
      )
    }
    return value || ''
  }
}

// Lazy getters - only validate when accessed at runtime, not at build time
const getAnthropicApiKey = createLazyEnvGetter('ANTHROPIC_API_KEY')
const getResendApiKey = createLazyEnvGetter('RESEND_API_KEY')
const getDatabaseUrl = createLazyEnvGetter('DATABASE_URL')
const getCronSecret = createLazyEnvGetter('CRON_SECRET', false)
const getClaudeModel = () => process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'
const getAppUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Export getters as properties
export const env = {
  get ANTHROPIC_API_KEY() {
    return getAnthropicApiKey()
  },
  get RESEND_API_KEY() {
    return getResendApiKey()
  },
  get DATABASE_URL() {
    return getDatabaseUrl()
  },
  get CRON_SECRET() {
    return getCronSecret()
  },
  get CLAUDE_MODEL() {
    return getClaudeModel()
  },
  get NEXT_PUBLIC_APP_URL() {
    return getAppUrl()
  },
}

// Legacy exports for backward compatibility
export const ANTHROPIC_API_KEY = undefined as unknown as string
export const RESEND_API_KEY = undefined as unknown as string
export const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'
export const CRON_SECRET = process.env.CRON_SECRET || ''
