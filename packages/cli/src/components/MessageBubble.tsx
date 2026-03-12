import { Box, Text } from 'ink'
import React from 'react'
import { ThreadView, type ThreadMessage } from './ThreadView.js'

export interface Message {
  role: 'user' | 'assistant' | 'thread'
  text: string
  threadData?: { messages: ThreadMessage[]; currentUserId: string }
}

export function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'thread' && message.threadData) {
    return (
      <ThreadView
        messages={message.threadData.messages}
        currentUserId={message.threadData.currentUserId}
      />
    )
  }

  const isUser = message.role === 'user'

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={isUser ? 'white' : 'cyan'} bold>
        {isUser ? 'You' : 'Pippit'}
      </Text>
      <Text color={isUser ? 'white' : 'cyan'}>{message.text}</Text>
    </Box>
  )
}
