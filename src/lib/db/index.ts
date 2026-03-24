import { neon, NeonQueryFunction } from '@neondatabase/serverless'
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// Create a lazy-initialized database connection
// This prevents build-time errors when DATABASE_URL isn't available
let _db: NeonHttpDatabase<typeof schema> | null = null

function getDb(): NeonHttpDatabase<typeof schema> {
  if (_db) return _db

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const sql = neon(connectionString)
  _db = drizzle(sql, { schema })
  return _db
}

// Export a proxy that lazily initializes the db connection
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(target, prop) {
    const realDb = getDb()
    const value = (realDb as any)[prop]
    if (typeof value === 'function') {
      return value.bind(realDb)
    }
    return value
  },
})

export type DbClient = typeof db
