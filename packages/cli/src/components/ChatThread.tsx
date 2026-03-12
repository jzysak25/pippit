import { Box } from 'ink'
import React from 'react'
import { MessageBubble, type Message } from './MessageBubble.js'

export function ChatThread({ messages }: { messages: Message[] }) {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
    </Box>
  )
}
