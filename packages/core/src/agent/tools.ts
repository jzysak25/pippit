import type OpenAI from 'openai'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/client.js'
import {
  searchListings,
  createListing,
  getExpiringListings,
  getListingsBySeller,
  renewListing,
  updateListingStatus,
} from '../db/queries/listings.js'
import {
  counterOffer,
  createOffer,
  getOffersByBuyer,
  getOffersForListing,
  updateOfferStatus,
} from '../db/queries/offers.js'
import {
  createMessage,
  getMessagesBetweenUsers,
  getUnreadMessages,
  markMessageRead,
} from '../db/queries/messages.js'
import { getUserById, updateUser } from '../db/queries/users.js'
import {
  createWantedRequest,
  findMatchingWantedRequests,
  getWantedRequestsByBuyer,
  updateWantedRequestStatus,
} from '../db/queries/wanted_requests.js'

// ─── Tool definitions (OpenAI function calling format) ───────────────────────

type Prop = Record<string, unknown>
function str(description: string): Prop { return { type: 'string', description } }
function num(description: string): Prop { return { type: 'number', description } }
function strEnum(values: string[], description?: string): Prop { return { type: 'string', enum: values, description } }

function tool(name: string, description: string, parameters: Record<string, unknown>): OpenAI.Chat.ChatCompletionTool {
  return { type: 'function', function: { name, description, parameters } }
}
function obj(properties: Record<string, unknown>, required?: string[]) {
  return required ? { type: 'object', properties, required } : { type: 'object', properties }
}

export const toolDefinitions: OpenAI.Chat.ChatCompletionTool[] = [
  tool('search_listings', 'Search active marketplace listings by keywords, category, or price',
    obj({ query: str('Search keywords'), category: str('Filter by category'), max_price: num('Maximum price in dollars') })),
  tool('create_listing', 'Create a new item listing for sale. Confirm all details with the user before calling.',
    obj({ title: str('Listing title'), description: str('Item description'), price: num('Price in dollars'), category: str('Item category'), condition: strEnum(['new', 'like_new', 'good', 'fair', 'parts']), location: str('City or area'), delivery_options: strEnum(['pickup', 'shipping', 'both']) }, ['title', 'description', 'price', 'category'])),
  tool('get_my_listings', "Get the current user's listings", obj({})),
  tool('get_expiring_listings', "Get the current user's active listings that are expiring soon (within 3 days). Call this at session start to proactively alert the user.", obj({})),
  tool('renew_listing', 'Renew a listing to extend it for another 30 days',
    obj({ listing_id: str('The listing ID to renew') }, ['listing_id'])),
  tool('close_listing', 'Mark a listing as sold or remove it',
    obj({ listing_id: str('The listing ID'), reason: strEnum(['sold', 'archived']) }, ['listing_id', 'reason'])),
  tool('create_wanted_request', 'Post a wanted request for an item the user is looking to buy',
    obj({ title: str('Short title for what is wanted'), description: str('Detailed description of what is wanted'), category: str('Item category'), max_budget: num('Maximum budget in dollars'), location: str('Location'), delivery_preference: strEnum(['pickup', 'shipping', 'either']) }, ['title', 'description', 'category'])),
  tool('get_my_wanted_requests', "Get the current user's wanted requests", obj({})),
  tool('close_wanted_request', 'Close or mark a wanted request as fulfilled',
    obj({ request_id: str('The request ID'), reason: strEnum(['fulfilled', 'closed']) }, ['request_id', 'reason'])),
  tool('make_offer', 'Make an offer on a listing',
    obj({ listing_id: str('The listing ID'), amount: num('Offer amount in dollars'), message: str('Optional message to seller') }, ['listing_id', 'amount'])),
  tool('get_my_offers', 'Get offers the current user has sent on listings', obj({})),
  tool('get_offers_on_my_listings', "Get offers other buyers have made on the current user's listings", obj({})),
  tool('respond_to_offer', 'Accept, reject, or counter an offer on your listing',
    obj({ offer_id: str('The offer ID'), action: strEnum(['accept', 'reject', 'counter']), counter_amount: num('Counter-offer amount in dollars (required if action is counter)'), counter_message: str('Optional message with the counter-offer') }, ['offer_id', 'action'])),
  tool('respond_to_counter', "Accept or reject a seller's counter-offer",
    obj({ offer_id: str('The offer ID'), action: strEnum(['accept', 'reject']) }, ['offer_id', 'action'])),
  tool('send_message', 'Send a message to another user',
    obj({ receiver_id: str('The recipient user ID'), body: str('Message body'), offer_id: str('Optional: link message to an offer') }, ['receiver_id', 'body'])),
  tool('get_inbox', 'Get unread messages for the current user', obj({})),
  tool('get_thread', 'Get message thread with a specific user',
    obj({ other_user_id: str('The other user ID') }, ['other_user_id'])),
  tool('mark_read', 'Mark a specific message as read',
    obj({ message_id: str('The message ID') }, ['message_id'])),
  tool('get_user_profile', 'Get the current user profile and preferences', obj({})),
  tool('update_preferences', 'Update the current user preferences (location, delivery preference, communication style, etc.)',
    obj({ default_location: str('Default location'), default_delivery_preference: strEnum(['pickup', 'shipping', 'either']), communication_style: strEnum(['brief', 'detailed']), preferred_categories: { type: 'array', items: { type: 'string' }, description: 'Preferred item categories' } })),
]

// ─── Tool execution ──────────────────────────────────────────────────────────

function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

function formatListing(listing: Record<string, unknown>) {
  return {
    ...listing,
    price_display: listing['price']
      ? `$${((listing['price'] as number) / 100).toFixed(2)}`
      : undefined,
  }
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
): Promise<string> {
  const db = getDb()

  switch (name) {
    case 'search_listings': {
      const results = await searchListings(db, {
        query: input['query'] as string | undefined,
        category: input['category'] as string | undefined,
        maxPrice:
          input['max_price'] !== undefined
            ? dollarsToCents(input['max_price'] as number)
            : undefined,
      })
      return JSON.stringify({ listings: results.map((l) => formatListing(l as Record<string, unknown>)) })
    }

    case 'create_listing': {
      const title = input['title'] as string
      const category = input['category'] as string
      const listing = await createListing(db, {
        id: randomUUID(),
        sellerId: userId,
        title,
        description: input['description'] as string,
        price: dollarsToCents(input['price'] as number),
        category,
        condition: input['condition'] as 'new' | 'like_new' | 'good' | 'fair' | 'parts' | undefined,
        location: input['location'] as string | undefined,
        deliveryOptions: input['delivery_options'] as 'pickup' | 'shipping' | 'both' | undefined,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      const keywords = title.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
      const matches = await findMatchingWantedRequests(db, category, keywords, userId)
      return JSON.stringify({
        success: true,
        listing: formatListing(listing as Record<string, unknown>),
        interested_buyers: matches.length > 0 ? matches : undefined,
      })
    }

    case 'get_my_listings': {
      const results = await getListingsBySeller(db, userId)
      return JSON.stringify({ listings: results.map((l) => formatListing(l as Record<string, unknown>)) })
    }

    case 'get_expiring_listings': {
      const results = await getExpiringListings(db, userId)
      return JSON.stringify({ listings: results.map((l) => formatListing(l as Record<string, unknown>)) })
    }

    case 'renew_listing': {
      const listing = await renewListing(db, input['listing_id'] as string, userId)
      if (!listing) return JSON.stringify({ error: 'Listing not found or not yours' })
      return JSON.stringify({ success: true, listing: formatListing(listing as Record<string, unknown>) })
    }

    case 'close_listing': {
      const status = (input['reason'] as string) === 'sold' ? 'sold' : 'archived'
      const listing = await updateListingStatus(db, input['listing_id'] as string, status)
      return JSON.stringify({ success: true, listing })
    }

    case 'create_wanted_request': {
      const req = await createWantedRequest(db, {
        id: randomUUID(),
        buyerId: userId,
        title: input['title'] as string,
        description: input['description'] as string,
        category: input['category'] as string,
        maxPrice:
          input['max_budget'] !== undefined
            ? dollarsToCents(input['max_budget'] as number)
            : undefined,
        location: input['location'] as string | undefined,
        deliveryPreference: input['delivery_preference'] as 'pickup' | 'shipping' | 'either' | undefined,
      })
      return JSON.stringify({ success: true, request: req })
    }

    case 'get_my_wanted_requests': {
      const results = await getWantedRequestsByBuyer(db, userId)
      return JSON.stringify({ requests: results })
    }

    case 'close_wanted_request': {
      const status = (input['reason'] as string) === 'fulfilled' ? 'fulfilled' : 'closed'
      const req = await updateWantedRequestStatus(db, input['request_id'] as string, status)
      return JSON.stringify({ success: true, request: req })
    }

    case 'make_offer': {
      const offer = await createOffer(db, {
        id: randomUUID(),
        listingId: input['listing_id'] as string,
        buyerId: userId,
        amount: dollarsToCents(input['amount'] as number),
        message: input['message'] as string | undefined,
      })
      return JSON.stringify({ success: true, offer })
    }

    case 'get_my_offers': {
      const results = await getOffersByBuyer(db, userId)
      return JSON.stringify({ offers: results })
    }

    case 'get_offers_on_my_listings': {
      const myListings = await getListingsBySeller(db, userId)
      const allOffers = await Promise.all(myListings.map((l) => getOffersForListing(db, l.id)))
      return JSON.stringify({
        listings_with_offers: myListings.map((l, i) => ({ ...l, offers: allOffers[i] })),
      })
    }

    case 'respond_to_offer': {
      const action = input['action'] as string
      if (action === 'counter') {
        if (input['counter_amount'] === undefined)
          return JSON.stringify({ error: 'counter_amount is required for a counter-offer' })
        const offer = await counterOffer(
          db,
          input['offer_id'] as string,
          dollarsToCents(input['counter_amount'] as number),
          input['counter_message'] as string | undefined,
        )
        return JSON.stringify({ success: true, offer })
      }
      const status = action === 'accept' ? 'accepted' : 'rejected'
      const offer = await updateOfferStatus(db, input['offer_id'] as string, status)
      return JSON.stringify({ success: true, offer })
    }

    case 'respond_to_counter': {
      const status = (input['action'] as string) === 'accept' ? 'accepted' : 'rejected'
      const offer = await updateOfferStatus(db, input['offer_id'] as string, status)
      return JSON.stringify({ success: true, offer })
    }

    case 'send_message': {
      const msg = await createMessage(db, {
        id: randomUUID(),
        senderId: userId,
        receiverId: input['receiver_id'] as string,
        offerId: input['offer_id'] as string | undefined,
        body: input['body'] as string,
      })
      return JSON.stringify({ success: true, message: msg })
    }

    case 'get_inbox': {
      const msgs = await getUnreadMessages(db, userId)
      return JSON.stringify({ messages: msgs })
    }

    case 'get_thread': {
      const msgs = await getMessagesBetweenUsers(db, userId, input['other_user_id'] as string)
      // auto-mark received messages as read
      await Promise.all(
        msgs
          .filter((m) => m.receiverId === userId && !m.readAt)
          .map((m) => markMessageRead(db, m.id)),
      )
      return JSON.stringify({ messages: msgs, current_user_id: userId })
    }

    case 'mark_read': {
      const msg = await markMessageRead(db, input['message_id'] as string)
      return JSON.stringify({ success: true, message: msg })
    }

    case 'get_user_profile': {
      const user = await getUserById(db, userId)
      if (!user) return JSON.stringify({ error: 'User not found' })
      const { passwordHash: _, ...safeUser } = user
      const preferences = user.preferences ? JSON.parse(user.preferences) : {}
      return JSON.stringify({ ...safeUser, preferences })
    }

    case 'update_preferences': {
      const user = await getUserById(db, userId)
      if (!user) return JSON.stringify({ error: 'User not found' })
      const existing = user.preferences ? JSON.parse(user.preferences) : {}
      const updated = {
        ...existing,
        ...(input['default_location'] ? { defaultLocation: input['default_location'] } : {}),
        ...(input['default_delivery_preference']
          ? { defaultDeliveryPreference: input['default_delivery_preference'] }
          : {}),
        ...(input['communication_style']
          ? { communicationStyle: input['communication_style'] }
          : {}),
        ...(input['preferred_categories']
          ? { preferredCategories: input['preferred_categories'] }
          : {}),
        lastSeenAt: new Date().toISOString(),
      }
      await updateUser(db, userId, { preferences: JSON.stringify(updated) })
      return JSON.stringify({ success: true, preferences: updated })
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}
