import { cookies } from 'next/headers'
import { verifyToken } from '@pippit/core'

export async function getSessionUser(): Promise<{ id: string } | null> {
  const jar = await cookies()
  const jwt = jar.get('jwt')?.value
  if (!jwt) return null
  try {
    const id = verifyToken(jwt)
    return { id }
  } catch {
    return null
  }
}
