import { and, eq, ne, or, like } from 'drizzle-orm'
import type { Db } from '../client.js'
import { wantedRequests } from '../schema.js'

export async function getWantedRequestById(db: Db, id: string) {
  return db.query.wantedRequests.findFirst({ where: eq(wantedRequests.id, id) })
}

export async function getWantedRequestsByBuyer(db: Db, buyerId: string) {
  return db.query.wantedRequests.findMany({ where: eq(wantedRequests.buyerId, buyerId) })
}

export async function createWantedRequest(
  db: Db,
  data: typeof wantedRequests.$inferInsert,
) {
  const [row] = await db.insert(wantedRequests).values(data).returning()
  return row
}

export async function findMatchingWantedRequests(
  db: Db,
  category: string,
  keywords: string[],
  excludeBuyerId: string,
) {
  // Match by same category OR any keyword appears in title/description
  const keywordConditions = keywords.flatMap((kw) => [
    like(wantedRequests.title, `%${kw}%`),
    like(wantedRequests.description, `%${kw}%`),
  ])

  return db.query.wantedRequests.findMany({
    where: and(
      eq(wantedRequests.status, 'open'),
      ne(wantedRequests.buyerId, excludeBuyerId),
      or(eq(wantedRequests.category, category), ...keywordConditions),
    ),
  })
}

export async function updateWantedRequestStatus(
  db: Db,
  id: string,
  status: 'open' | 'fulfilled' | 'closed',
) {
  const [row] = await db
    .update(wantedRequests)
    .set({ status })
    .where(eq(wantedRequests.id, id))
    .returning()
  return row
}
