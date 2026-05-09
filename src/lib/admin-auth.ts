import { createHash, timingSafeEqual } from 'node:crypto'

export const ADMIN_COOKIE = 'admin_auth'

function getAdminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null
}

function getAdminSecret(): string {
  return (
    process.env.ADMIN_COOKIE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'duema-bbs-admin-cookie-v1'
  )
}

export function createAdminCookieValue(): string {
  const password = getAdminPassword()
  if (!password) throw new Error('ADMIN_PASSWORD is not configured')

  return createHash('sha256')
    .update(`${password}:${getAdminSecret()}`)
    .digest('hex')
}

export function verifyAdminCookie(value: string | undefined | null): boolean {
  const password = getAdminPassword()
  if (!password || !value) return false

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
