import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
const EXPIRY = '30d'

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: EXPIRY })
}

export function verifyToken(token: string): string {
  const payload = jwt.verify(token, JWT_SECRET)
  if (typeof payload === 'string' || !payload.sub) {
    throw new Error('Invalid token payload')
  }
  return payload.sub as string
}
