import { createHash, timingSafeEqual } from 'node:crypto'

export const ADMIN_COOKIE = 'admin_auth'

let hasLoggedMissingAdminSecret = false

function getAdminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null
}

function getAdminSecret(): string | null {
  const secret =
    process.env.ADMIN_COOKIE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    null

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

  return createHash('sha256')
    .update(`${password}:${secret}`)
    .digest('hex')
}

export function verifyAdminCookie(value: string | undefined | null): boolean {
  const password = getAdminPassword()
  const secret = getAdminSecret()
  if (!password || !secret || !value) return false

  const expected = createAdminCookieValue()
  const actualBuffer = Buffer.from(value)
  const expectedBuffer = Buffer.from(expected)

  if (actualBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(actualBuffer, expectedBuffer)
}

export function isAdminPassword(value: string | null): boolean {
  const password = getAdminPassword()
  return !!password && value === password
}
