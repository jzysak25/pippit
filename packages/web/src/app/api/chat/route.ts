import { agentTurn, getDb, getUserById } from '@pippit/core'
import type { ChatMessage, ConversationState } from '@pippit/core'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getSessionUser()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { message, history, state, apiKey } = (await req.json()) as {
    message: string
    history: ChatMessage[]
    state: ConversationState
    apiKey: string
  }

  if (!apiKey) return new Response('Missing apiKey', { status: 400 })

  const user = await getUserById(getDb(), session.id)
  if (!user) return new Response('User not found', { status: 404 })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send({ type: 'thinking' })

        const result = await agentTurn(
          { id: user.id, username: user.username, location: user.location ?? undefined, preferences: user.preferences ?? undefined },
          message,
          history,
          { apiKey, model: 'gemini-3-flash-preview' },
          state,
        )

        send({ type: 'done', text: result.text, state: result.updatedState, toolResults: result.toolResults })
      } catch (err) {
        send({ type: 'error', error: err instanceof Error ? err.message : String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
