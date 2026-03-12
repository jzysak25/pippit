import { and, eq, isNotNull, lt, lte, or, like } from 'drizzle-orm'
import type { Db } from '../client.js'
import { listings } from '../schema.js'

export async function getListingById(db: Db, id: string) {
  return db.query.listings.findFirst({ where: eq(listings.id, id) })
}

export async function getListingsBySeller(db: Db, sellerId: string) {
  return db.query.listings.findMany({ where: eq(listings.sellerId, sellerId) })
}

export async function searchListings(
  db: Db,
  opts: { query?: string; category?: string; maxPrice?: number } = {},
) {
  const conditions = [eq(listings.status, 'active')]

  if (opts.category) {
    conditions.push(eq(listings.category, opts.category))
  }
  if (opts.maxPrice !== undefined) {
    conditions.push(lte(listings.price, opts.maxPrice))
  }
  if (opts.query) {
    const q = `%${opts.query}%`
    conditions.push(or(like(listings.title, q), like(listings.description, q))!)
  }

  return db.query.listings.findMany({ where: and(...conditions) })
}

export async function createListing(db: Db, data: typeof listings.$inferInsert) {
  const [row] = await db.insert(listings).values(data).returning()
  return row
}

export async function updateListing(
  db: Db,
  id: string,
  sellerId: string,
  changes: Partial<typeof listings.$inferInsert>,
) {
  const [row] = await db
    .update(listings)
    .set(changes)
    .where(and(eq(listings.id, id), eq(listings.sellerId, sellerId)))
    .returning()
  return row
}

export async function expireStaleListings(db: Db) {
  return db
    .update(listings)
    .set({ status: 'archived' })
    .where(and(eq(listings.status, 'active'), isNotNull(listings.expiresAt), lt(listings.expiresAt, new Date())))
}

export async function getExpiringListings(db: Db, sellerId: string, withinDays = 3) {
  const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000)
  return db.query.listings.findMany({
    where: and(
      eq(listings.sellerId, sellerId),
      eq(listings.status, 'active'),
      isNotNull(listings.expiresAt),
      lte(listings.expiresAt, cutoff),
    ),
  })
}

export async function renewListing(db: Db, id: string, sellerId: string) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const [row] = await db
    .update(listings)
    .set({ expiresAt, status: 'active' })
    .where(and(eq(listings.id, id), eq(listings.sellerId, sellerId)))
    .returning()
  return row
}

export async function updateListingStatus(
  db: Db,
  id: string,
  status: 'active' | 'sold' | 'archived',
) {
  const [row] = await db
    .update(listings)
    .set({ status })
    .where(eq(listings.id, id))
    .returning()
  return row
}
