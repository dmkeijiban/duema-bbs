'use server'

import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { hashMakerAnonymousOwner, MAKER_ANONYMOUS_COOKIE } from '@/lib/maker-anonymous-owner'

const SOURCE_KEY_PATTERN = /^[a-zA-Z0-9._-]{1,100}$/

type PublishEntry = {
  id: string
  sourceKey?: string | null
  count: number
}

export async function publishDeck(input: { title: string; entries: PublishEntry[] }) {
  try {
    const title = input.title.trim().slice(0, 60) || 'メインデッキ'
    if (!Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 40) {
      return { ok: false, message: 'デッキの内容が不正です' }
    }

    const counts = new Map<string, number>()
    let total = 0
    for (const entry of input.entries) {
      if (!/^[0-9a-f-]{36}$/i.test(entry.id) || !Number.isInteger(entry.count) || entry.count < 1 || entry.count > 4) {
        return { ok: false, message: 'デッキの内容が不正です' }
      }
      if (entry.sourceKey != null && !SOURCE_KEY_PATTERN.test(entry.sourceKey)) {
        return { ok: false, message: 'カードの収録版情報が不正です' }
      }
      const next = (counts.get(entry.id) ?? 0) + entry.count
      if (next > 4) return { ok: false, message: '同名カードは合計4枚までです' }
      counts.set(entry.id, next)
      total += entry.count
    }
    if (total !== 40) return { ok: false, message: '40枚そろったデッキを登録してください' }

    const admin = createAdminClient()
    const cardIds = [...counts.keys()]
    const sourceKeys = input.entries.flatMap(entry => entry.sourceKey ? [entry.sourceKey] : [])
    const [{ data: cards, error: cardsError }, { data: printings, error: printingsError }] = await Promise.all([
      admin.from('cards').select('id,name,image_url').in('id', cardIds),
      sourceKeys.length
        ? admin.from('card_printings').select('card_id,source_key,image_url').in('source_key', sourceKeys)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (cardsError || printingsError || (cards ?? []).length !== cardIds.length) {
      return { ok: false, message: 'カード情報を確認できませんでした' }
    }

    const cardById = new Map((cards ?? []).map(card => [card.id, card]))
    const printingByKey = new Map((printings ?? []).map(printing => [printing.source_key, printing]))
    const deckData = input.entries.map(entry => {
      const card = cardById.get(entry.id)!
      const printing = entry.sourceKey ? printingByKey.get(entry.sourceKey) : null
      if (entry.sourceKey && (!printing || printing.card_id !== entry.id)) throw new Error('PRINTING_MISMATCH')
      return {
        id: entry.id,
        name: card.name,
        imageUrl: printing?.image_url ?? card.image_url ?? null,
        sourceKey: entry.sourceKey ?? null,
        count: entry.count,
      }
    })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const cookieStore = await cookies()
    let anonymousId = cookieStore.get(MAKER_ANONYMOUS_COOKIE)?.value
    if (!user && (!anonymousId || !/^[A-Za-z0-9_-]{40,100}$/.test(anonymousId))) {
      anonymousId = randomBytes(32).toString('base64url')
    }

    const { data, error } = await admin.from('deck_submissions').insert({
      user_id: user?.id ?? null,
      anonymous_edit_token_hash: user ? null : hashMakerAnonymousOwner(anonymousId!, 'edit'),
      title,
      format: 'original',
      deck_data: deckData,
      is_public: true,
    }).select('id').single()
    if (error || !data) return { ok: false, message: 'みんなのデッキリストへの登録に失敗しました' }

    if (!user) {
      cookieStore.set(MAKER_ANONYMOUS_COOKIE, anonymousId!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 31536000,
      })
    }
    return { ok: true, message: 'みんなのデッキリストに登録しました', submissionId: data.id }
  } catch (error) {
    console.error('publishDeck failed', { message: error instanceof Error ? error.message : String(error) })
    return { ok: false, message: 'みんなのデッキリストへの登録に失敗しました' }
  }
}
