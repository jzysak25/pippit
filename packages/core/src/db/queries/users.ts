import { eq } from 'drizzle-orm'
import type { Db } from '../client.js'
import { users } from '../schema.js'

export async function getUserById(db: Db, id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) })
}

export async function getUserByEmail(db: Db, email: string) {
  return db.query.users.findFirst({ where: eq(users.email, email) })
}

export async function getUserByUsername(db: Db, username: string) {
  return db.query.users.findFirst({ where: eq(users.username, username) })
}

export async function createUser(db: Db, data: typeof users.$inferInsert) {
  const [row] = await db.insert(users).values(data).returning()
  return row
}

export async function updateUser(
  db: Db,
  id: string,
  changes: Partial<typeof users.$inferInsert>,
) {
  const [row] = await db
    .update(users)
    .set(changes)
    .where(eq(users.id, id))
    .returning()
  return row
}
