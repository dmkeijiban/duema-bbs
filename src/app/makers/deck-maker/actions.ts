'use server'

import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { hashMakerAnonymousOwner, MAKER_ANONYMOUS_COOKIE } from '@/lib/maker-anonymous-owner'

const SOURCE_KEY_PATTERN = /^[a-zA-Z0-9._-]{1,100}$/
const KEY_CARD_COOKIE = 'duema_deck_key_card'

type PublishEntry = {
  id: string
  printingId?: string | null
  sourceKey?: string | null
  faceSideIndex?: number | null
  count: number
  zone?: 'main' | 'gr' | 'hyperspatial' | 'special'
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseSelectedKeyCard(value: string | undefined): { cardId: string; printingId: string | null } | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as { cardId?: unknown; printingId?: unknown }
    if (typeof parsed.cardId !== 'string' || !UUID_PATTERN.test(parsed.cardId)) return null
    const printingId = typeof parsed.printingId === 'string' && UUID_PATTERN.test(parsed.printingId) ? parsed.printingId : null
    return { cardId: parsed.cardId, printingId }
  } catch {
    return null
  }
}

export async function savePublishedDeck(input: { submissionId?: string | null; title: string; format?: 'original' | 'advance'; entries: PublishEntry[]; keyCardId?: string | null; keyCardPrintingId?: string | null }) {
  try {
    if (typeof input.title !== 'string' || input.title.trim().length > 60) return { ok: false, message: 'デッキ名は60文字以内で入力してください' }
    if (input.submissionId != null && !UUID_PATTERN.test(input.submissionId)) return { ok: false, message: '公開デッキの情報が不正です' }
    const title = input.title.trim() || 'メインデッキ'
    const format = input.format === 'advance' ? 'advance' : 'original'
    if (!Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 61) return { ok: false, message: 'デッキの内容が不正です' }

    const counts = new Map<string, number>()
    const zoneCounts = new Map<string, number>()
    let total = 0
    for (const entry of input.entries) {
      if (!UUID_PATTERN.test(entry.id) || !Number.isInteger(entry.count) || entry.count < 1 || entry.count > 4) return { ok: false, message: 'デッキの内容が不正です' }
      if (entry.sourceKey != null && !SOURCE_KEY_PATTERN.test(entry.sourceKey)) return { ok: false, message: 'カードの収録版情報が不正です' }
      if (entry.printingId != null && !UUID_PATTERN.test(entry.printingId)) return { ok: false, message: 'カードの収録版情報が不正です' }
      if (entry.faceSideIndex != null && (!Number.isInteger(entry.faceSideIndex) || entry.faceSideIndex < 0)) return { ok: false, message: 'カードの面情報が不正です' }
      const next = (counts.get(entry.id) ?? 0) + entry.count
      if (next > 4) return { ok: false, message: '同名カードは合計4枚までです' }
      counts.set(entry.id, next)
      const zone = format === 'advance' && ['main', 'gr', 'hyperspatial', 'special'].includes(entry.zone ?? '') ? entry.zone! : 'main'
      zoneCounts.set(zone, (zoneCounts.get(zone) ?? 0) + entry.count)
      total += entry.count
    }
    if ((zoneCounts.get('main') ?? 0) !== 40) return { ok: false, message: 'メインデッキ40枚をそろえてください' }
    if ((zoneCounts.get('gr') ?? 0) > 12 || (zoneCounts.get('hyperspatial') ?? 0) > 8 || (zoneCounts.get('special') ?? 0) > 1) return { ok: false, message: 'ゾーンの枚数上限を超えています' }
    if (format === 'original' && total !== 40) return { ok: false, message: '40枚そろったデッキを登録してください' }

    const cookieStore = await cookies()
    const selectedByMaker = parseSelectedKeyCard(cookieStore.get(KEY_CARD_COOKIE)?.value)
    const cardIds = [...counts.keys()]
    const requestedKeyCardId = selectedByMaker?.cardId ?? input.keyCardId
    const requestedPrintingId = selectedByMaker?.printingId ?? input.keyCardPrintingId
    const keyCardId = requestedKeyCardId && cardIds.includes(requestedKeyCardId) ? requestedKeyCardId : input.entries[0]?.id ?? null
    const keyCardEntry = input.entries.find(entry => entry.id === keyCardId && (!requestedPrintingId || entry.printingId === requestedPrintingId))
    const keyCardPrintingId = keyCardEntry?.printingId ?? null

    const admin = createAdminClient()
    const sourceKeys = input.entries.flatMap(entry => entry.sourceKey ? [entry.sourceKey] : [])
    const [{ data: cards, error: cardsError }, { data: printings, error: printingsError }] = await Promise.all([
      admin.from('cards').select('id,name,image_url').in('id', cardIds),
      sourceKeys.length ? admin.from('card_printings').select('id,card_id,source_key,image_url').in('source_key', sourceKeys) : Promise.resolve({ data: [], error: null }),
    ])
    if (cardsError || printingsError || (cards ?? []).length !== cardIds.length) {
      console.error('savePublishedDeck card lookup failed', { cardsCode: cardsError?.code, printingsCode: printingsError?.code, expectedCards: cardIds.length, resolvedCards: cards?.length ?? 0 })
      return { ok: false, message: 'カード情報を確認できませんでした' }
    }

    const cardById = new Map((cards ?? []).map(card => [card.id, card]))
    const printingByKey = new Map((printings ?? []).map(printing => [printing.source_key, printing]))
    const deckData = input.entries.map(entry => {
      const card = cardById.get(entry.id)!
      const printing = entry.sourceKey ? printingByKey.get(entry.sourceKey) : null
      if (entry.sourceKey && (!printing || printing.card_id !== entry.id)) throw new Error('PRINTING_MISMATCH')
      if (entry.printingId && (!printing || printing.id !== entry.printingId)) throw new Error('PRINTING_ID_MISMATCH')
      return { id: entry.id, printingId: printing?.id ?? null, name: card.name, imageUrl: printing?.image_url ?? card.image_url ?? null, sourceKey: entry.sourceKey ?? null, faceSideIndex: entry.faceSideIndex ?? 0, zone: format === 'advance' && ['main', 'gr', 'hyperspatial', 'special'].includes(entry.zone ?? '') ? entry.zone : 'main', count: entry.count }
    })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let anonymousId = cookieStore.get(MAKER_ANONYMOUS_COOKIE)?.value
    const hasValidAnonymousId = !user && anonymousId != null && /^[A-Za-z0-9_-]{40,100}$/.test(anonymousId)

    if (input.submissionId) {
      const { data: existing, error: existingError } = await admin.from('deck_submissions').select('id,user_id,anonymous_edit_token_hash').eq('id', input.submissionId).maybeSingle()
      if (existingError || !existing) return { ok: false, message: '公開デッキを更新できませんでした' }
      const ownedByUser = user != null && existing.user_id === user.id
      const ownedAnonymously = user == null && existing.user_id === null && hasValidAnonymousId && existing.anonymous_edit_token_hash === hashMakerAnonymousOwner(anonymousId!, 'edit')
      if (!ownedByUser && !ownedAnonymously) return { ok: false, message: 'この公開デッキを更新する権限がありません' }

      let updateQuery = admin.from('deck_submissions').update({ title, format, deck_data: deckData, key_card_id: keyCardId, key_card_printing_id: keyCardPrintingId, is_public: true, updated_at: new Date().toISOString() }).eq('id', input.submissionId)
      updateQuery = user ? updateQuery.eq('user_id', user.id) : updateQuery.is('user_id', null).eq('anonymous_edit_token_hash', hashMakerAnonymousOwner(anonymousId!, 'edit'))
      const { data, error } = await updateQuery.select('id').single()
      if (error || !data) return { ok: false, message: '公開デッキを更新できませんでした' }
      return { ok: true, submissionId: data.id }
    }

    if (!user && !hasValidAnonymousId) anonymousId = randomBytes(32).toString('base64url')
    const { data, error } = await admin.from('deck_submissions').insert({ user_id: user?.id ?? null, anonymous_edit_token_hash: user ? null : hashMakerAnonymousOwner(anonymousId!, 'edit'), title, format, deck_data: deckData, key_card_id: keyCardId, key_card_printing_id: keyCardPrintingId, is_public: true }).select('id').single()
    if (error || !data) {
      console.error('savePublishedDeck insert failed', { code: error?.code, message: error?.message })
      return { ok: false, message: 'みんなのデッキリストへの登録に失敗しました' }
    }

    if (!user) cookieStore.set(MAKER_ANONYMOUS_COOKIE, anonymousId!, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 31536000 })
    return { ok: true, submissionId: data.id }
  } catch (error) {
    console.error('savePublishedDeck failed', { message: error instanceof Error ? error.message : String(error) })
    return { ok: false, message: 'みんなのデッキリストへの登録に失敗しました' }
  }
}

export async function copyPublishedDeck(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!UUID_PATTERN.test(id)) redirect('/makers/deck-maker')
  const admin = createAdminClient()
  await admin.rpc('increment_deck_submission_metric', { target_id: id, metric_name: 'copy' })
  redirect(`/makers/deck-maker?copy=${id}`)
}

export async function deletePublishedDeck(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!UUID_PATTERN.test(id)) return
  const admin = createAdminClient()
  const { data: existing } = await admin.from('deck_submissions').select('id,user_id,anonymous_edit_token_hash').eq('id', id).maybeSingle()
  if (!existing) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const anonymousId = (await cookies()).get(MAKER_ANONYMOUS_COOKIE)?.value
  const owned = (user && existing.user_id === user.id) || (!user && existing.user_id === null && anonymousId && /^[A-Za-z0-9_-]{40,100}$/.test(anonymousId) && existing.anonymous_edit_token_hash === hashMakerAnonymousOwner(anonymousId, 'edit'))
  if (!owned) return
  await admin.from('deck_submissions').update({ is_public: false, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/makers/deck-maker/submissions')
  redirect('/makers/deck-maker/submissions')
}

export async function deleteMyDeck(id: string) {
  if (!UUID_PATTERN.test(id)) return { ok: false }
  const admin = createAdminClient()
  const { data: existing } = await admin.from('deck_submissions').select('id,user_id,anonymous_edit_token_hash').eq('id', id).maybeSingle()
  if (!existing) return { ok: false }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const anonymousId = (await cookies()).get(MAKER_ANONYMOUS_COOKIE)?.value
  const owned = (user && existing.user_id === user.id) || (existing.user_id === null && anonymousId && /^[A-Za-z0-9_-]{40,100}$/.test(anonymousId) && existing.anonymous_edit_token_hash === hashMakerAnonymousOwner(anonymousId, 'edit'))
  if (!owned) return { ok: false }
  const { error } = await admin.from('deck_submissions').update({ is_public: false, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { ok: false }
  revalidatePath('/makers/deck-maker')
  revalidatePath('/makers/deck-maker/submissions')
  return { ok: true }
}
