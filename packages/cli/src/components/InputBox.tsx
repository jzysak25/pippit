import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import React from 'react'

interface InputBoxProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  disabled?: boolean
}

export function InputBox({ value, onChange, onSubmit, disabled }: InputBoxProps) {
  return (
    <Box borderStyle="round" borderColor={disabled ? 'gray' : 'cyan'} paddingX={1}>
      <Text color="cyan">{'> '}</Text>
      <TextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder={disabled ? 'Waiting...' : 'Type a message...'}
      />
    </Box>
  )
}
