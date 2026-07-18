import { createHmac, timingSafeEqual } from 'node:crypto'

export const ADMIN_COOKIE = 'admin_auth'
export const ADMIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const ADMIN_COOKIE_VERSION = 'v2'
const ADMIN_COOKIE_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000

let hasLoggedMissingAdminSecret = false

function getAdminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null
}

function getAdminSecret(): string | null {
  const secret = process.env.ADMIN_COOKIE_SECRET || null

  if (!secret && !hasLoggedMissingAdminSecret) {
    console.error('[admin-auth] admin cookie secret is not configured')
    hasLoggedMissingAdminSecret = true
  }

  return secret
}

export function createAdminCookieValue(): string {
  const password = getAdminPassword()
  if (!password) throw new Error('ADMIN_PASSWORD is not configured')
  const secret = getAdminSecret()
  if (!secret) throw new Error('Admin cookie secret is not configured')
  const issuedAtMs = Date.now()
  const signature = createAdminCookieSignature(password, secret, issuedAtMs)

  return `${ADMIN_COOKIE_VERSION}.${issuedAtMs}.${signature}`
}

export function verifyAdminCookie(value: string | undefined | null): boolean {
  const password = getAdminPassword()
  const secret = getAdminSecret()
  if (!password || !secret || !value) return false

  const parts = value.split('.')
  if (parts.length !== 3 || parts[0] !== ADMIN_COOKIE_VERSION) return false

  const issuedAtMs = Number.parseInt(parts[1], 10)
  if (!Number.isSafeInteger(issuedAtMs) || String(issuedAtMs) !== parts[1]) return false

  const now = Date.now()
  if (issuedAtMs > now + ADMIN_COOKIE_MAX_FUTURE_SKEW_MS) return false
  if (now - issuedAtMs > ADMIN_COOKIE_MAX_AGE_SECONDS * 1000) return false

  const expected = createAdminCookieSignature(password, secret, issuedAtMs)
  const actualBuffer = Buffer.from(parts[2], 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')

  if (actualBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(actualBuffer, expectedBuffer)
}

export function isAdminPassword(value: string | null): boolean {
  const password = getAdminPassword()
  return !!password && value === password
}

function createAdminCookieSignature(password: string, secret: string, issuedAtMs: number): string {
  return createHmac('sha256', secret)
    .update(`${ADMIN_COOKIE_VERSION}:${issuedAtMs}:${password}`)
    .digest('hex')
}

function createAdminRateLimitBypassSignature(
  password: string,
  secret: string,
  threadId: number,
  expiresAtMs: number,
): string {
  return createHmac('sha256', secret)
    .update(`admin-rate-limit-bypass:v1:${threadId}:${expiresAtMs}:${password}`)
    .digest('hex')
}

export function createAdminRateLimitBypassToken(threadId: number): string | null {
  const password = getAdminPassword()
  const secret = getAdminSecret()
  if (!password || !secret || !Number.isFinite(threadId) || threadId <= 0) return null

  const expiresAtMs = Date.now() + 15 * 60 * 1000
  const signature = createAdminRateLimitBypassSignature(password, secret, threadId, expiresAtMs)
  return `v1.${expiresAtMs}.${signature}`
}

export function verifyAdminRateLimitBypassToken(
  value: string | undefined | null,
  threadId: number,
): boolean {
  const password = getAdminPassword()
  const secret = getAdminSecret()
  if (!password || !secret || !value || !Number.isFinite(threadId) || threadId <= 0) return false

  const [version, expiresAtRaw, signature] = value.split('.')
  if (version !== 'v1' || !expiresAtRaw || !signature) return false

  const expiresAtMs = Number.parseInt(expiresAtRaw, 10)
  if (!Number.isSafeInteger(expiresAtMs) || String(expiresAtMs) !== expiresAtRaw) return false
  if (expiresAtMs < Date.now()) return false

  const expected = createAdminRateLimitBypassSignature(password, secret, threadId, expiresAtMs)
  const actualBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')

  if (actualBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(actualBuffer, expectedBuffer)
}
