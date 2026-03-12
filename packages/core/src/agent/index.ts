import { GoogleGenAI } from '@google/genai'
import type { Content, Part } from '@google/genai'
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

function toGoogleContents(history: ChatMessage[], message: string): Content[] {
  return [
    ...history.map(
      (m): Content => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }),
    ),
    { role: 'user', parts: [{ text: message }] },
  ]
}

export async function agentTurn(
  user: UserContext,
  message: string,
  history: ChatMessage[],
  config: AgentConfig,
  state: ConversationState,
): Promise<AgentTurnResult> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey })

  const contents: Content[] = toGoogleContents(history, message)
  let updatedState = { ...state }
  let finalText = ''
  const collectedToolResults: Record<string, unknown> = {}

  // Agentic loop: keep running until no more tool calls
  while (true) {
    const response = await ai.models.generateContent({
      model: config.model,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(user, state),
        tools: [{ functionDeclarations: toolDefinitions }],
      },
    })

    const parts: Part[] = response.candidates?.[0]?.content?.parts ?? []

    // Collect text from this turn
    const text = parts
      .filter((p) => p.text !== undefined)
      .map((p) => p.text)
      .join('')
    if (text) finalText = text

    // Check for function calls
    const functionCalls = parts.filter((p) => p.functionCall !== undefined)
    if (functionCalls.length === 0) break

    // Add the model's response (with function calls) to the contents
    contents.push({ role: 'model', parts })

    // Execute all tools and collect results
    const resultParts: Part[] = await Promise.all(
      functionCalls.map(async (p) => {
        const fc = p.functionCall!
        const toolName = fc.name ?? ''
        const result = await executeTool(
          toolName,
          (fc.args ?? {}) as Record<string, unknown>,
          user.id,
        )
        try {
          collectedToolResults[toolName] = JSON.parse(result)
        } catch {
          // ignore non-JSON results
        }
        return {
          functionResponse: {
            name: toolName,
            response: { result },
          },
        }
      }),
    )

    contents.push({ role: 'user', parts: resultParts })
  }

  return { text: finalText, updatedState, toolResults: collectedToolResults }
}
