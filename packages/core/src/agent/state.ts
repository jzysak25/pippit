export type AgentMode =
  | 'idle'
  | 'gather_sell'
  | 'gather_buy'
  | 'viewing_results'
  | 'negotiating'
  | 'messaging'
  | 'manage_listings'
  | 'manage_offers'

export interface ConversationState {
  mode: AgentMode
  draft: Record<string, unknown> | null
}

export interface AgentConfig {
  apiKey: string
  model: string
}

export function initialState(): ConversationState {
  return { mode: 'idle', draft: null }
}
