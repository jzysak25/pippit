import { and, eq, isNull, or } from 'drizzle-orm'
import type { Db } from '../client.js'
import { messages } from '../schema.js'

export async function getMessagesBetweenUsers(db: Db, userA: string, userB: string) {
  return db.query.messages.findMany({
    where: or(
      and(eq(messages.senderId, userA), eq(messages.receiverId, userB)),
      and(eq(messages.senderId, userB), eq(messages.receiverId, userA)),
    ),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  })
}

export async function getUnreadMessages(db: Db, receiverId: string) {
  return db.query.messages.findMany({
    where: and(eq(messages.receiverId, receiverId), isNull(messages.readAt)),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
  })
}

export async function createMessage(db: Db, data: typeof messages.$inferInsert) {
  const [row] = await db.insert(messages).values(data).returning()
  return row
}

export async function markMessageRead(db: Db, id: string) {
  const [row] = await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(eq(messages.id, id))
    .returning()
  return row
}
