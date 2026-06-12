'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'

import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

export type ZukanActionState = {
  ok: boolean
  message?: string
  error?: string
}

const RATE_LIMIT_SECONDS = 60
const MIN_BODY_LENGTH = 3
const MAX_BODY_LENGTH = 1000
const MAX_AUTHOR_LENGTH = 30

type ActiveProfile = {
  userId: string
  displayName: string
} | null

function normalizeText(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get('bbs_session')?.value
  if (existing) return existing

  const sessionId = uuidv4()
  cookieStore.set('bbs_session', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  return sessionId
}

async function getActiveProfile(): Promise<ActiveProfile> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('id, display_name, profile_hidden, account_suspended, withdrawn_at')
    .eq('id', user.id)
    .maybeSingle()

  if (
    error ||
    !data ||
    data.profile_hidden ||
    data.account_suspended ||
    data.withdrawn_at
  ) {
    return null
  }

  return {
    userId: user.id,
    displayName: String(data.display_name || '匿名').trim() || '匿名',
  }
}

function resolveAuthorName(profile: ActiveProfile, formData: FormData): string {
  if (profile) return profile.displayName
  const authorName = normalizeText(formData.get('author_name'))
  return authorName.slice(0, MAX_AUTHOR_LENGTH) || '匿名'
}

function validateBody(body: string): string | null {
  if (body.length < MIN_BODY_LENGTH) {
    return '本文は3文字以上で入力してください。'
  }
  if (body.length > MAX_BODY_LENGTH) {
    return '本文は1000文字以内で入力してください。'
  }
  return null
}

async function hasRecentPost(
  table: 'zukan_pack_reviews' | 'zukan_card_reviews',
  targetColumn: 'pack_id' | 'card_id',
  targetId: string,
  identity: { userId: string | null; sessionId: string }
): Promise<boolean> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - RATE_LIMIT_SECONDS * 1000).toISOString()
  let query = admin
    .from(table)
    .select('id')
    .eq(targetColumn, targetId)
    .eq('is_deleted', false)
    .gte('created_at', since)
    .limit(1)

  if (identity.userId) {
    query = query.eq('user_id', identity.userId)
  } else {
    query = query.eq('anonymous_session_id', identity.sessionId)
  }

  const { data, error } = await query
  if (error) return false
  return Boolean(data && data.length > 0)
}

export async function submitPackReview(
  _prevState: ZukanActionState,
  formData: FormData
): Promise<ZukanActionState> {
  const packId = normalizeText(formData.get('pack_id'))
  const packSlug = normalizeText(formData.get('pack_slug')) || 'dm-01'
  const body = normalizeText(formData.get('body'))
  const bodyError = validateBody(body)
  if (!packId || bodyError) return { ok: false, error: bodyError || 'パック情報が見つかりません。' }

  const sessionId = await getOrCreateSessionId()
  const profile = await getActiveProfile()
  const userId = profile?.userId ?? null

  if (await hasRecentPost('zukan_pack_reviews', 'pack_id', packId, { userId, sessionId })) {
    return { ok: false, error: '短時間に連続して投稿されています。少し待ってから投稿してください。' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('zukan_pack_reviews').insert({
    pack_id: packId,
    user_id: userId,
    anonymous_session_id: sessionId,
    author_name: resolveAuthorName(profile, formData),
    body,
  })

  if (error) return { ok: false, error: '投稿に失敗しました。時間をおいて再度お試しください。' }

  revalidatePath(`/zukan/${packSlug}`)
  return { ok: true, message: '思い出を投稿しました。' }
}

export async function submitCardReview(
  _prevState: ZukanActionState,
  formData: FormData
): Promise<ZukanActionState> {
  const cardId = normalizeText(formData.get('card_id'))
  const cardSlug = normalizeText(formData.get('card_slug'))
  const body = normalizeText(formData.get('body'))
  const bodyError = validateBody(body)
  if (!cardId || !cardSlug || bodyError) {
    return { ok: false, error: bodyError || 'カード情報が見つかりません。' }
  }

  const sessionId = await getOrCreateSessionId()
  const profile = await getActiveProfile()
  const userId = profile?.userId ?? null

  if (await hasRecentPost('zukan_card_reviews', 'card_id', cardId, { userId, sessionId })) {
    return { ok: false, error: '短時間に連続して投稿されています。少し待ってから投稿してください。' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('zukan_card_reviews').insert({
    card_id: cardId,
    user_id: userId,
    anonymous_session_id: sessionId,
    author_name: resolveAuthorName(profile, formData),
    body,
  })

  if (error) return { ok: false, error: '投稿に失敗しました。時間をおいて再度お試しください。' }

  revalidatePath(`/zukan/card/${cardSlug}`)
  return { ok: true, message: 'レビューを投稿しました。' }
}

function readScore(formData: FormData, key: string): number | null {
  const value = Number(normalizeText(formData.get(key)))
  if (!Number.isInteger(value) || value < 1 || value > 5) return null
  return value
}

export async function submitCardRating(
  _prevState: ZukanActionState,
  formData: FormData
): Promise<ZukanActionState> {
  const cardId = normalizeText(formData.get('card_id'))
  const cardSlug = normalizeText(formData.get('card_slug'))
  if (!cardId || !cardSlug) {
    return { ok: false, error: 'カード情報が見つかりません。' }
  }

  const scores = {
    nostalgia_score: readScore(formData, 'nostalgia_score'),
    play_score: readScore(formData, 'play_score'),
    now_score: readScore(formData, 'now_score'),
    name_score: readScore(formData, 'name_score'),
    illustration_score: readScore(formData, 'illustration_score'),
  }

  if (Object.values(scores).some((score) => score === null)) {
    return { ok: false, error: '評価はすべて1〜5で選んでください。' }
  }

  const sessionId = await getOrCreateSessionId()
  const profile = await getActiveProfile()
  const userId = profile?.userId ?? null
  const admin = createAdminClient()

  let existingQuery = admin
    .from('zukan_card_ratings')
    .select('id')
    .eq('card_id', cardId)
    .eq('is_deleted', false)
    .limit(1)

  if (userId) {
    existingQuery = existingQuery.eq('user_id', userId)
  } else {
    existingQuery = existingQuery.eq('anonymous_session_id', sessionId).is('user_id', null)
  }

  const { data: existingRows, error: findError } = await existingQuery
  if (findError) return { ok: false, error: '評価の確認に失敗しました。' }

  const payload = {
    ...scores,
    user_id: userId,
    anonymous_session_id: sessionId,
    author_name: resolveAuthorName(profile, formData),
    updated_at: new Date().toISOString(),
  }

  const existingId = existingRows?.[0]?.id
  const { error } = existingId
    ? await admin.from('zukan_card_ratings').update(payload).eq('id', existingId)
    : await admin.from('zukan_card_ratings').insert({
        card_id: cardId,
        is_hidden: false,
        ...payload,
      })

  if (error) return { ok: false, error: '評価の保存に失敗しました。時間をおいて再度お試しください。' }

  revalidatePath(`/zukan/card/${cardSlug}`)
  return {
    ok: true,
    message: existingId ? '評価を更新しました。' : '評価を投稿しました。',
  }
}
