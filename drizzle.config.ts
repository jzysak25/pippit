import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Config } from 'drizzle-kit'

const url = process.env.TURSO_URL ?? `file:${join(homedir(), '.pippit', 'data.db')}`

export default {
  schema: './packages/core/src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'turso',
  dbCredentials: {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config
