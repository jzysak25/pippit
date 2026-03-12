import { agentTurn, expireStaleListings, getDb, initialState, login, register, validateApiKey, verifyToken } from '@pippit/core'
import type { ChatMessage, ConversationState } from '@pippit/core'
import { Box, Text } from 'ink'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChatThread } from './components/ChatThread.js'
import { InputBox } from './components/InputBox.js'
import { type Message } from './components/MessageBubble.js'
import { Spinner } from './components/Spinner.js'
import type { ThreadMessage } from './components/ThreadView.js'
import { readConfig, writeConfig } from './session.js'

type SetupMode = 'checking' | 'needs_key' | 'validating_key' | 'needs_auth' | 'ready'

type AuthStep =
  | 'new_or_existing'
  | 'reg_username'
  | 'reg_email'
  | 'reg_password'
  | 'login_identifier'
  | 'login_password'

interface UserContext {
  id: string
  username: string
}

function systemMsg(text: string): Message {
  return { role: 'assistant', text }
}


export function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [model, setModel] = useState('openrouter/auto:free') // overridden by config on load
  const [state, setState] = useState<ConversationState>(initialState())
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [setupMode, setSetupMode] = useState<SetupMode>('checking')
  const [authStep, setAuthStep] = useState<AuthStep>('new_or_existing')
  const [user, setUser] = useState<UserContext | null>(null)

  // Accumulate auth fields across steps
  const authData = useRef<{
    isNew?: boolean
    username?: string
    email?: string
    identifier?: string
  }>({})

  const addMsg = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  useEffect(() => {
    if (setupMode === 'ready') {
      expireStaleListings(getDb()).catch(() => {/* silent */})
    }
  }, [setupMode])

  useEffect(() => {
    readConfig().then((cfg) => {
      if (cfg.apiKey) {
        setApiKey(cfg.apiKey)
        setModel(cfg.preferredModel)
        if (cfg.jwt) {
          // JWT present — verify it and extract user
          try {
            const userId = verifyToken(cfg.jwt)
            // We'll load username from DB lazily; for now set a placeholder that gets
            // replaced by the agent's greeting via get_user_profile
            setUser({ id: userId, username: 'you' })
            setSetupMode('ready')
            setMessages([systemMsg('Welcome back to Pippit! What would you like to do?')])
          } catch {
            // JWT invalid — re-auth
            setSetupMode('needs_auth')
            setAuthStep('new_or_existing')
            setMessages([systemMsg('Do you have an existing Pippit account? (yes / no)')])
          }
        } else {
          setSetupMode('needs_auth')
          setAuthStep('new_or_existing')
          setMessages([systemMsg('Do you have an existing Pippit account? (yes / no)')])
        }
      } else {
        setSetupMode('needs_key')
        setMessages([
          systemMsg(
            'Welcome to Pippit — an AI-powered peer-to-peer marketplace!\n\nTo get started, enter your OpenRouter API key.\nGet one free at openrouter.ai — it stays on your machine only.',
          ),
        ])
      }
    })
  }, [])

  const handleAuthStep = useCallback(
    async (value: string) => {
      const v = value.trim()

      switch (authStep) {
        case 'new_or_existing': {
          const isNew = /^n/i.test(v)
          authData.current.isNew = isNew
          if (isNew) {
            setAuthStep('reg_username')
            addMsg({ role: 'user', text: v })
            addMsg(systemMsg('Choose a username:'))
          } else {
            setAuthStep('login_identifier')
            addMsg({ role: 'user', text: v })
            addMsg(systemMsg('Enter your username or email:'))
          }
          break
        }

        case 'reg_username': {
          authData.current.username = v
          setAuthStep('reg_email')
          addMsg({ role: 'user', text: v })
          addMsg(systemMsg('Enter your email address:'))
          break
        }

        case 'reg_email': {
          authData.current.email = v
          setAuthStep('reg_password')
          addMsg({ role: 'user', text: v })
          addMsg(systemMsg('Choose a password:'))
          break
        }

        case 'reg_password': {
          addMsg({ role: 'user', text: '••••••••' })
          setLoading(true)
          try {
            const result = await register(
              authData.current.username!,
              authData.current.email!,
              v,
            )
            await writeConfig({ jwt: result.jwt })
            setUser({ id: result.userId, username: result.username })
            setSetupMode('ready')
            setMessages((prev) => [
              ...prev,
              systemMsg(
                `Account created! Welcome to Pippit, ${result.username}. What would you like to do — buy or sell?`,
              ),
            ])
          } catch (err) {
            addMsg(
              systemMsg(
                `Registration failed: ${err instanceof Error ? err.message : String(err)}\n\nLet's try again. Do you have an existing account? (yes / no)`,
              ),
            )
            authData.current = {}
            setAuthStep('new_or_existing')
          } finally {
            setLoading(false)
          }
          break
        }

        case 'login_identifier': {
          authData.current.identifier = v
          setAuthStep('login_password')
          addMsg({ role: 'user', text: v })
          addMsg(systemMsg('Enter your password:'))
          break
        }

        case 'login_password': {
          addMsg({ role: 'user', text: '••••••••' })
          setLoading(true)
          try {
            const result = await login(authData.current.identifier!, v)
            await writeConfig({ jwt: result.jwt })
            setUser({ id: result.userId, username: result.username })
            setSetupMode('ready')
            setMessages((prev) => [
              ...prev,
              systemMsg(`Welcome back, ${result.username}! What would you like to do?`),
            ])
          } catch (err) {
            addMsg(
              systemMsg(
                `Login failed: ${err instanceof Error ? err.message : String(err)}\n\nTry again. Do you have an existing account? (yes / no)`,
              ),
            )
            authData.current = {}
            setAuthStep('new_or_existing')
          } finally {
            setLoading(false)
          }
          break
        }
      }
    },
    [authStep, addMsg],
  )

  const handleSubmit = useCallback(
    async (value: string) => {
      if (!value.trim() || loading) return
      setInput('')

      // --- API key setup ---
      if (setupMode === 'needs_key') {
        const key = value.trim()
        addMsg({ role: 'user', text: '(API key entered)' })
        setSetupMode('validating_key')
        addMsg(systemMsg('Validating your API key...'))
        setLoading(true)
        try {
          await validateApiKey(key)
          await writeConfig({ apiKey: key })
          setApiKey(key)
          setLoading(false)
          setSetupMode('needs_auth')
          setAuthStep('new_or_existing')
          setMessages((prev) => [
            ...prev,
            systemMsg('Key saved! Do you have an existing Pippit account? (yes / no)'),
          ])
        } catch (err) {
          setLoading(false)
          setSetupMode('needs_key')
          addMsg(
            systemMsg(
              `That key didn't work — ${err instanceof Error ? err.message : String(err)}\n\nPlease check it and try again. Get one at openrouter.ai.`,
            ),
          )
        }
        return
      }

      // --- Auth flow ---
      if (setupMode === 'needs_auth') {
        await handleAuthStep(value)
        return
      }

      // --- Main chat ---
      if (!apiKey || !user) return

      addMsg({ role: 'user', text: value })
      setLoading(true)

      try {
        const result = await agentTurn(user, value, history, { apiKey, model }, state)

        setHistory((prev) => [
          ...prev,
          { role: 'user', content: value },
          { role: 'assistant', content: result.text },
        ])
        setState(result.updatedState)

        // Inject thread view if agent fetched a message thread
        const threadResult = result.toolResults?.['get_thread'] as
          | { messages: unknown[]; current_user_id: string }
          | undefined
        if (threadResult?.messages?.length) {
          addMsg({
            role: 'thread',
            text: '',
            threadData: {
              messages: threadResult.messages as ThreadMessage[],
              currentUserId: threadResult.current_user_id,
            },
          })
        }

        addMsg({ role: 'assistant', text: result.text })
      } catch (err) {
        addMsg({
          role: 'assistant',
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        })
      } finally {
        setLoading(false)
      }
    },
    [setupMode, apiKey, user, model, history, state, loading, handleAuthStep, addMsg],
  )

  if (setupMode === 'checking') {
    return (
      <Box padding={1}>
        <Spinner label="Loading..." />
      </Box>
    )
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Pippit
        </Text>
        {user ? (
          <Text color="gray"> · {user.username}</Text>
        ) : (
          <Text color="gray"> — AI peer-to-peer marketplace</Text>
        )}
      </Box>

      <ChatThread messages={messages} />

      {loading && (
        <Box marginBottom={1} paddingX={1}>
          <Spinner label={setupMode === 'validating_key' ? 'Validating key...' : 'Thinking...'} />
        </Box>
      )}

      <InputBox
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={loading}
      />

      <Box marginTop={1} paddingX={1}>
        <Text color="gray" dimColor>
          Press Ctrl+C to exit
        </Text>
      </Box>
    </Box>
  )
}
