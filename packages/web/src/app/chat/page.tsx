'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type ChatMessage = { role: 'user' | 'assistant'; content: string }
type ConversationState = { mode: string; draft?: Record<string, unknown> }
const initialState = (): ConversationState => ({ mode: 'idle' })

interface DisplayMessage {
  role: 'user' | 'assistant' | 'thread'
  text: string
  threadMessages?: Array<{ id: string; senderId: string; body: string; createdAt: number | null }>
  currentUserId?: string
}

export default function ChatPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; username: string } | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [state, setState] = useState<ConversationState | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Verify session
    fetch('/api/me').then(async res => {
      if (!res.ok) { router.push('/setup'); return }
      const u = await res.json()
      setUser(u)
    })

    const key = localStorage.getItem('apiKey')
    if (!key) { router.push('/setup'); return }
    setApiKey(key)

    setState(initialState())
    setMessages([{ role: 'assistant', text: 'Welcome back to Pippit! What would you like to do?' }])
  }, [router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading || !user || !apiKey || !state) return

    const msg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history, state, apiKey }),
      })

      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))

          if (data.type === 'done') {
            setHistory(prev => [
              ...prev,
              { role: 'user', content: msg },
              { role: 'assistant', content: data.text },
            ])
            setState(data.state)

            // Inject thread view if get_thread was called
            const thread = data.toolResults?.get_thread as
              | { messages: DisplayMessage['threadMessages']; current_user_id: string }
              | undefined
            if (thread?.messages?.length) {
              setMessages(prev => [...prev, {
                role: 'thread',
                text: '',
                threadMessages: thread.messages,
                currentUserId: thread.current_user_id,
              }])
            }

            setMessages(prev => [...prev, { role: 'assistant', text: data.text }])
          } else if (data.type === 'error') {
            setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${data.error}` }])
          }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${err instanceof Error ? err.message : String(err)}` }])
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) })
    localStorage.removeItem('apiKey')
    router.push('/setup')
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Pippit</span>
          {user && <span style={{ color: 'var(--muted)', fontSize: 14 }}>· {user.username}</span>}
        </div>
        <button onClick={logout} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', padding: '5px 12px', borderRadius: 6, fontSize: 13 }}>
          Log out
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px' }}>
          {messages.map((msg, i) => {
            if (msg.role === 'thread' && msg.threadMessages) {
              return (
                <div key={i} style={{ margin: '16px 0', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 16px', background: 'var(--border)', fontSize: 12, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Thread
                  </div>
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {msg.threadMessages.map(m => {
                      const isMe = m.senderId === msg.currentUserId
                      return (
                        <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                          <span style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{isMe ? 'You' : 'Them'}</span>
                          <div style={{ maxWidth: '75%', padding: '8px 12px', borderRadius: 10, background: isMe ? 'var(--accent-dim)' : 'var(--surface)', border: '1px solid var(--border)', fontSize: 14 }}>
                            {m.body}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            }

            const isUser = msg.role === 'user'
            return (
              <div key={i} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: isUser ? 'var(--accent)' : 'var(--muted)', marginBottom: 4 }}>
                  {isUser ? 'You' : 'Pippit'}
                </div>
                <div style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                  {msg.text}
                </div>
              </div>
            )
          })}

          {loading && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Pippit</div>
              <div style={{ color: 'var(--muted)', fontSize: 14 }}>Thinking…</div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', background: 'var(--surface)' }}>
        <form onSubmit={send} style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 10 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Message Pippit…"
            disabled={loading}
            style={{ flex: 1, padding: '10px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 24, color: 'var(--text)', outline: 'none' }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{ padding: '10px 20px', background: 'var(--accent)', border: 'none', borderRadius: 24, color: '#fff', fontWeight: 600, opacity: loading || !input.trim() ? 0.5 : 1 }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
