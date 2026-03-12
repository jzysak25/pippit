import { getDb, getUserById } from '@pippit/core'
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'

export async function GET() {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserById(getDb(), session.id)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { passwordHash: _, ...safeUser } = user
  return NextResponse.json(safeUser)
}
