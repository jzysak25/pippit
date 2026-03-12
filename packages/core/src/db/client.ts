import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { homedir } from 'node:os'
import { join } from 'node:path'
import * as schema from './schema.js'

export function createDb() {
  const url = process.env.TURSO_URL ?? `file:${join(homedir(), '.pippit', 'data.db')}`
  const authToken = process.env.TURSO_AUTH_TOKEN

  const client = createClient({ url, authToken })
  return drizzle(client, { schema })
}

export type Db = ReturnType<typeof createDb>

// Lazy singleton for tool execution
let _db: Db | null = null
export function getDb(): Db {
  if (!_db) _db = createDb()
  return _db
}
