import OpenAI from 'openai'
import { buildSystemPrompt } from './prompts.js'
import type { AgentConfig, ConversationState } from './state.js'
import { executeTool, toolDefinitions } from './tools.js'

interface UserContext {
  id: string
  username: string
  location?: string
  preferences?: string // JSON blob
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export interface AgentTurnResult {
  text: string
  updatedState: ConversationState
  toolResults?: Record<string, unknown>
}

function buildMessages(
  user: UserContext,
  state: ConversationState,
  history: ChatMessage[],
  message: string,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  return [
    { role: 'system', content: buildSystemPrompt(user, state) },
    ...history.map((m): OpenAI.Chat.ChatCompletionMessageParam => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: message },
  ]
}


export async function agentTurn(
  user: UserContext,
  message: string,
  history: ChatMessage[],
  config: AgentConfig,
  state: ConversationState,
): Promise<AgentTurnResult> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/jzysak25/pippit',
      'X-Title': 'Pippit',
    },
  })

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = buildMessages(user, state, history, message)
  let updatedState = { ...state }
  let finalText = ''
  const collectedToolResults: Record<string, unknown> = {}

  // Agentic loop: keep running until no more tool calls
  while (true) {
    const response = await client.chat.completions.create({
      model: config.model,
      messages,
      tools: toolDefinitions,
    })

    const msg = response.choices[0]?.message
    if (!msg) break

    // Always push the assistant message back
    messages.push(msg)

    const toolCalls = msg.tool_calls ?? []

    if (toolCalls.length === 0) {
      finalText = msg.content ?? ''
      break
    }

    // Execute all tool calls
    for (const tc of toolCalls) {
      const name = tc.function.name
      const input = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>
      const result = await executeTool(name, input, user.id)

      try {
        collectedToolResults[name] = JSON.parse(result)
      } catch {
        // ignore non-JSON
      }

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result,
      })
    }
  }

  return { text: finalText, updatedState, toolResults: collectedToolResults }
}
