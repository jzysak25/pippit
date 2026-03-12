import type { ConversationState } from './state.js'

interface UserContext {
  id: string
  username: string
  location?: string
  preferences?: string // JSON
}

export function buildSystemPrompt(
  user: UserContext,
  state: ConversationState,
): string {
  const modeContext = getModeContext(state)
  const prefs = user.preferences ? tryParsePrefs(user.preferences) : null
  const prefContext = prefs ? buildPrefsContext(prefs) : ''

  return `You are Pippit, an AI assistant for a peer-to-peer marketplace. You help users buy and sell items conversationally.

## Current user
Username: ${user.username} (id: ${user.id})
${user.location ? `Location: ${user.location}` : ''}
${prefContext}

## Current conversation mode: ${state.mode}
${modeContext}

## Your capabilities
- Help users list items for sale
- Help users find items to buy or post wanted requests
- Browse and search listings
- Negotiate prices and manage offers
- Send and read messages with other users
- Manage existing listings and offers

## Guidelines
- Be concise and conversational — one question at a time
- Infer from saved preferences before asking (skip asking for location if already saved)
- Confirm full summary before creating listings or accepting offers
- Always show prices in human-readable format (e.g. "$25.00")
- Synthesize tool results into natural language — never show raw JSON
- Auto-update preferences when user mentions signals like "I usually prefer pickup" or "I'm under $300 for electronics"
- At the start of each session, call get_expiring_listings. If any are expiring within 3 days, mention it naturally (e.g. "By the way, your listing for X expires in 2 days — want me to renew it?")`
}

function tryParsePrefs(json: string): Record<string, unknown> | null {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

function buildPrefsContext(prefs: Record<string, unknown>): string {
  const lines: string[] = []
  if (prefs['defaultLocation']) lines.push(`Default location: ${prefs['defaultLocation']}`)
  if (prefs['defaultDeliveryPreference'])
    lines.push(`Delivery preference: ${prefs['defaultDeliveryPreference']}`)
  if (prefs['communicationStyle'])
    lines.push(`Communication style: ${prefs['communicationStyle']}`)
  if (Array.isArray(prefs['preferredCategories']) && prefs['preferredCategories'].length > 0)
    lines.push(`Preferred categories: ${(prefs['preferredCategories'] as string[]).join(', ')}`)
  return lines.length > 0 ? `Preferences:\n${lines.map((l) => `  ${l}`).join('\n')}` : ''
}

function getModeContext(state: ConversationState): string {
  if (state.mode === 'idle') return ''

  const draftInfo = state.draft
    ? `\nDraft in progress: ${JSON.stringify(state.draft, null, 2)}`
    : ''

  const contexts: Record<string, string> = {
    gather_sell: `You are currently collecting details for a new listing.${draftInfo}`,
    gather_buy: `You are currently collecting details for a wanted request.${draftInfo}`,
    viewing_results: `You are displaying search results to the user.`,
    negotiating: `You are in a negotiation flow.${draftInfo}`,
    messaging: `You are in a messaging flow.${draftInfo}`,
    manage_listings: `You are helping the user manage their listings.`,
    manage_offers: `You are helping the user manage their offers.`,
  }

  return contexts[state.mode] ?? ''
}
