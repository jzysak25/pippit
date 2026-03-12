import { eq } from 'drizzle-orm'
import type { Db } from '../client.js'
import { offers } from '../schema.js'

export async function getOfferById(db: Db, id: string) {
  return db.query.offers.findFirst({ where: eq(offers.id, id) })
}

export async function getOffersForListing(db: Db, listingId: string) {
  return db.query.offers.findMany({ where: eq(offers.listingId, listingId) })
}

export async function getOffersByBuyer(db: Db, buyerId: string) {
  return db.query.offers.findMany({ where: eq(offers.buyerId, buyerId) })
}

export async function createOffer(db: Db, data: typeof offers.$inferInsert) {
  const [row] = await db.insert(offers).values(data).returning()
  return row
}

export async function updateOfferStatus(
  db: Db,
  id: string,
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'countered',
) {
  const [row] = await db
    .update(offers)
    .set({ status })
    .where(eq(offers.id, id))
    .returning()
  return row
}

export async function counterOffer(
  db: Db,
  id: string,
  counterAmount: number,
  counterMessage?: string,
) {
  const [row] = await db
    .update(offers)
    .set({ status: 'countered', counterAmount, counterMessage })
    .where(eq(offers.id, id))
    .returning()
  return row
}
