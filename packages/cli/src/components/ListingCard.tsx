import { Box, Text } from 'ink'
import React from 'react'

export interface ListingData {
  id: string
  title: string
  price: number // cents
  price_display?: string
  category: string
  condition?: string
  location?: string
  delivery_options?: string
  status?: string
}

export function ListingCard({ listing }: { listing: ListingData }) {
  const price = listing.price_display ?? `$${(listing.price / 100).toFixed(2)}`

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      marginBottom={1}
    >
      <Box justifyContent="space-between">
        <Text bold color="white">
          {listing.title}
        </Text>
        <Text bold color="green">
          {price}
        </Text>
      </Box>

      <Box gap={2}>
        <Text color="gray">{listing.category}</Text>
        {listing.condition && <Text color="gray">{listing.condition}</Text>}
        {listing.delivery_options && (
          <Text color="gray">{listing.delivery_options}</Text>
        )}
      </Box>

      {listing.location && (
        <Text color="gray" dimColor>
          {listing.location}
        </Text>
      )}

      {listing.status && listing.status !== 'active' && (
        <Text color="yellow">{listing.status.toUpperCase()}</Text>
      )}
    </Box>
  )
}
