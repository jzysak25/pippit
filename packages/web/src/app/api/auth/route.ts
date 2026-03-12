import { login, register } from '@pippit/core'
import { NextRequest, NextResponse } from 'next/server'

function setJwtCookie(res: NextResponse, jwt: string) {
  res.cookies.set('jwt', jwt, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body

  try {
    if (action === 'register') {
      const { username, email, password } = body
      const result = await register(username, email, password)
      const res = NextResponse.json({ userId: result.userId, username: result.username })
      setJwtCookie(res, result.jwt)
      return res
    }

    if (action === 'login') {
      const { identifier, password } = body
      const result = await login(identifier, password)
      const res = NextResponse.json({ userId: result.userId, username: result.username })
      setJwtCookie(res, result.jwt)
      return res
    }

    if (action === 'logout') {
      const res = NextResponse.json({ ok: true })
      res.cookies.delete('jwt')
      return res
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Auth failed' },
      { status: 401 },
    )
  }
}
