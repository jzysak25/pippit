import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { getDb } from '../db/client.js'
import { createUser, getUserByEmail, getUserByUsername } from '../db/queries/users.js'
import { signToken } from './tokens.js'

const scryptAsync = promisify(scrypt)

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${hash.toString('hex')}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(':')
  if (!salt || !hashHex) return false
  const hash = (await scryptAsync(password, salt, 64)) as Buffer
  const storedHash = Buffer.from(hashHex, 'hex')
  if (hash.length !== storedHash.length) return false
  return timingSafeEqual(hash, storedHash)
}

export async function validateApiKey(key: string): Promise<void> {
  const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `Invalid API key (${res.status})`)
  }
}

export interface AuthResult {
  userId: string
  username: string
  jwt: string
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  const db = getDb()

  const existingByUsername = await getUserByUsername(db, username)
  if (existingByUsername) throw new Error('Username already taken')

  const existingByEmail = await getUserByEmail(db, email)
  if (existingByEmail) throw new Error('Email already registered')

  const passwordHash = await hashPassword(password)
  const user = await createUser(db, {
    id: randomUUID(),
    username,
    email,
    passwordHash,
  })

  const jwt = signToken(user.id)
  return { userId: user.id, username: user.username, jwt }
}

export async function login(
  identifier: string, // username or email
  password: string,
): Promise<AuthResult> {
  const db = getDb()

  const user =
    (await getUserByEmail(db, identifier)) ??
    (await getUserByUsername(db, identifier))

  if (!user) throw new Error('No account found with that username or email')

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw new Error('Incorrect password')

  const jwt = signToken(user.id)
  return { userId: user.id, username: user.username, jwt }
}
