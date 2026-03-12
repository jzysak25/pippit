import { Box, Text } from 'ink'
import React from 'react'

export interface ThreadMessage {
  id: string
  senderId: string
  body: string
  createdAt: number | null
}

interface Props {
  messages: ThreadMessage[]
  currentUserId: string
}

function formatTime(createdAt: number | null): string {
  if (!createdAt) return ''
  return new Date(createdAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ThreadView({ messages, currentUserId }: Props) {
  if (messages.length === 0) {
    return (
      <Box paddingX={1} marginBottom={1}>
        <Text color="gray" dimColor>
          No messages yet.
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" marginBottom={1} paddingX={1}>
      <Box marginBottom={1}>
        <Text color="gray" dimColor>
          ── thread ──────────────────────────
        </Text>
      </Box>
      {messages.map((msg) => {
        const isMe = msg.senderId === currentUserId
        return (
          <Box key={msg.id} flexDirection="column" marginBottom={1} alignItems={isMe ? 'flex-end' : 'flex-start'}>
            <Box>
              <Text color={isMe ? 'cyan' : 'white'} bold>
                {isMe ? 'You' : 'Them'}
              </Text>
              {msg.createdAt ? (
                <Text color="gray" dimColor>
                  {' '}
                  {formatTime(msg.createdAt)}
                </Text>
              ) : null}
            </Box>
            <Box borderStyle="round" borderColor={isMe ? 'cyan' : 'gray'} paddingX={1}>
              <Text>{msg.body}</Text>
            </Box>
          </Box>
        )
      })}
      <Box>
        <Text color="gray" dimColor>
          ────────────────────────────────────
        </Text>
      </Box>
    </Box>
  )
}
