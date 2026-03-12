import { sql } from 'drizzle-orm'
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  location: text('location'),
  preferences: text('preferences'), // JSON blob — see Agent Memory in plan
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const listings = sqliteTable('listings', {
  id: text('id').primaryKey(),
  sellerId: text('seller_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(), // in cents
  category: text('category').notNull(),
  condition: text('condition', { enum: ['new', 'like_new', 'good', 'fair', 'parts'] }),
  location: text('location'),
  lat: real('lat'),
  lng: real('lng'),
  deliveryOptions: text('delivery_options', { enum: ['pickup', 'shipping', 'both'] }),
  status: text('status', { enum: ['active', 'sold', 'archived'] })
    .notNull()
    .default('active'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const wantedRequests = sqliteTable('wanted_requests', {
  id: text('id').primaryKey(),
  buyerId: text('buyer_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  maxPrice: integer('max_price'), // in cents, optional
  category: text('category').notNull(),
  location: text('location'),
  radiusKm: integer('radius_km', { mode: 'number' }),
  deliveryPreference: text('delivery_preference', { enum: ['pickup', 'shipping', 'either'] }),
  status: text('status', { enum: ['open', 'fulfilled', 'closed'] })
    .notNull()
    .default('open'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const offers = sqliteTable('offers', {
  id: text('id').primaryKey(),
  listingId: text('listing_id')
    .notNull()
    .references(() => listings.id),
  buyerId: text('buyer_id')
    .notNull()
    .references(() => users.id),
  amount: integer('amount').notNull(), // in cents
  message: text('message'),
  status: text('status', { enum: ['pending', 'accepted', 'rejected', 'withdrawn', 'countered'] })
    .notNull()
    .default('pending'),
  counterAmount: integer('counter_amount'),
  counterMessage: text('counter_message'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  senderId: text('sender_id')
    .notNull()
    .references(() => users.id),
  receiverId: text('receiver_id')
    .notNull()
    .references(() => users.id),
  offerId: text('offer_id').references(() => offers.id),
  body: text('body').notNull(),
  readAt: integer('read_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})
