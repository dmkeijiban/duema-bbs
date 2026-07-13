'use server'

import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { isValidAnonymousId } from '@/lib/maker-events-shared'

const COOKIE = 'maker_signup_source'
const SLUG = 'dm26-ex2-charisma-best-tier'
const MAX_AGE_SECONDS = 86400
type Payload = { anonymousId: string; issuedAt: number }

function secret() {
  return process.env.ADMIN_COOKIE_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}
function signature(encoded: string) { return createHmac('sha256', secret()).update(encoded).digest('base64url') }
function encode(payload: Payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${signature(encoded)}`
}
function decode(value: string): Payload | null {
  const [encoded, signed] = value.split('.')
  if (!encoded || !signed || !secret()) return null
  const actual = Buffer.from(signed)
  const expected = Buffer.from(signature(encoded))
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as Payload
    return isValidAnonymousId(payload.anonymousId) && Date.now() - payload.issuedAt <= MAX_AGE_SECONDS * 1000 ? payload : null
  } catch { return null }
}

export async function beginMakerSignup(anonymousId: string) {
  if (!isValidAnonymousId(anonymousId) || !secret()) return { ok: false }
  const admin = createAdminClient()
  const { data: project } = await admin.from('maker_projects').select('id').eq('slug', SLUG).eq('is_public', true).eq('status', 'published').maybeSingle()
  if (!project) return { ok: false }
  await admin.rpc('record_maker_event', { p_project_id: project.id, p_event_type: 'auth_cta_clicked', p_user_id: null, p_anonymous_id: anonymousId, p_dedup_seconds: 60 })
  ;(await cookies()).set(COOKIE, encode({ anonymousId, issuedAt: Date.now() }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: MAX_AGE_SECONDS })
  return { ok: true }
}

export async function completeMakerSignup(userId: string) {
  const cookieStore = await cookies()
  const payload = decode(cookieStore.get(COOKIE)?.value ?? '')
  if (!payload) return false
  const admin = createAdminClient()
  const [{ data: authData }, { data: project }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from('maker_projects').select('id').eq('slug', SLUG).maybeSingle(),
  ])
  const createdAt = authData.user?.created_at ? new Date(authData.user.created_at).getTime() : 0
  if (!project || !createdAt || createdAt < payload.issuedAt - 60000) return false
  await admin.rpc('record_maker_event', { p_project_id: project.id, p_event_type: 'signup_completed', p_user_id: userId, p_anonymous_id: payload.anonymousId, p_dedup_seconds: 315360000 })
  cookieStore.delete(COOKIE)
  return true
}
