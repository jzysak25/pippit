import { validateApiKey } from '@pippit/core'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { apiKey } = await req.json()
  if (!apiKey) return NextResponse.json({ error: 'Missing apiKey' }, { status: 400 })
  try {
    await validateApiKey(apiKey)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid key' },
      { status: 400 },
    )
  }
}
