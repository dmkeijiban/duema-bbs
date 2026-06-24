import { createAdminClient } from '@/lib/supabase-admin'
import { SITE_URL } from '@/lib/site-config'

// 自動生成スレを分類するカテゴリ（思い出・昔話・過去商品）。見つからなければ未分類。
const ZUKAN_CATEGORY_SLUG = 'classic'

export type DailyZukanResult =
  | {
      status: 'created'
      cardSlug: string
      cardName: string
      threadId: number
      cycleNo: number
      postedDate: string
    }
  | { status: 'skipped'; reason: string; postedDate: string }
  | { status: 'error'; error: string }

// JST（UTC+9）基準の YYYY-MM-DD を返す。1日1スレの判定に使う。
export function getJstDateKey(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

function buildBody(cardName: string, cardUrl: string): string {
  return [
    `みんなの「${cardName}」に対する思い出を募集中です。`,
    ``,
    `当時の思い出でも、今の評価でもOKです。`,
    ``,
    `使っていたデッキ、当てた時の記憶`,
    `対戦で印象に残った場面など、気軽にコメントしてください。`,
    ``,
    `思い出図鑑ページ：`,
    cardUrl,
  ].join('\n')
}

// 毎日1回呼ばれ、公開カードから1枚選んで通常スレを作成する。
// - 同一日に2回目以降の呼び出しは作成しない（posted_date UNIQUE で保証）
// - 同一周回内ではカード重複なし。全カード消化で次の周回へ（全カード未使用扱い）
export async function runDailyZukanThread(): Promise<DailyZukanResult> {
  const admin = createAdminClient()
  const postedDate = getJstDateKey()

  // 1. 同一日チェック（高速パス）。既にある場合はスキップ。
  const { data: existing, error: existingError } = await admin
    .from('daily_zukan_thread_logs')
    .select('id')
    .eq('posted_date', postedDate)
    .maybeSingle()
  if (existingError) {
    return { status: 'error', error: `existing-check: ${existingError.message}` }
  }
  if (existing) {
    return { status: 'skipped', reason: 'already_posted_today', postedDate }
  }

  // 2. 公開カードを全件取得。
  const { data: cards, error: cardsError } = await admin
    .from('zukan_cards')
    .select('slug, name, official_image_url')
    .eq('is_published', true)
  if (cardsError) {
    return { status: 'error', error: `cards: ${cardsError.message}` }
  }
  if (!cards || cards.length === 0) {
    return { status: 'skipped', reason: 'no_published_cards', postedDate }
  }

  // 3. 現在の周回番号を決定（履歴が無ければ1周目）。
  const { data: cycleRow, error: cycleError } = await admin
    .from('daily_zukan_thread_logs')
    .select('cycle_no')
    .order('cycle_no', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (cycleError) {
    return { status: 'error', error: `cycle: ${cycleError.message}` }
  }
  let cycleNo = cycleRow?.cycle_no ?? 1

  // 4. 現周回で使用済みのカードslugを取得。
  const { data: usedRows, error: usedError } = await admin
    .from('daily_zukan_thread_logs')
    .select('card_slug')
    .eq('cycle_no', cycleNo)
  if (usedError) {
    return { status: 'error', error: `used: ${usedError.message}` }
  }
  const usedSlugs = new Set((usedRows ?? []).map((r) => r.card_slug))

  // 5. 未使用カードプール。全消化なら次の周回に入り、全カードを未使用扱いにする。
  let pool = cards.filter((c) => !usedSlugs.has(c.slug))
  if (pool.length === 0) {
    cycleNo += 1
    pool = cards
  }

  // 6. ランダムに1枚選択。
  const card = pool[Math.floor(Math.random() * pool.length)]

  // 7. 先にログ行を確保（posted_date UNIQUE が多重起動の最終ガード）。
  const { data: logRow, error: logError } = await admin
    .from('daily_zukan_thread_logs')
    .insert({
      card_slug: card.slug,
      cycle_no: cycleNo,
      posted_date: postedDate,
      thread_id: null,
    })
    .select('id')
    .single()
  if (logError) {
    if (logError.code === '23505') {
      // 別プロセスが同日分を先行作成済み。
      return { status: 'skipped', reason: 'race_already_posted', postedDate }
    }
    return { status: 'error', error: `log: ${logError.message}` }
  }

  // 8. 通常スレとして作成（画像は図鑑のカード画像を流用）。
  const cardUrl = `${SITE_URL}/zukan/card/${card.slug}`
  const title = `${card.name}について語ろう`
  const body = buildBody(card.name, cardUrl)

  const { data: categoryRow } = await admin
    .from('categories')
    .select('id')
    .eq('slug', ZUKAN_CATEGORY_SLUG)
    .maybeSingle()
  const categoryId: number | null = categoryRow?.id ?? null

  const { data: thread, error: threadError } = await admin
    .from('threads')
    .insert({
      title,
      body,
      category_id: categoryId,
      author_name: '名無しのデュエリスト',
      ...(card.official_image_url ? { image_url: card.official_image_url } : {}),
    })
    .select('id')
    .single()

  if (threadError || !thread) {
    // スレ作成に失敗したらログ行を削除し、翌日リトライ可能にする（カードを消費しない）。
    await admin.from('daily_zukan_thread_logs').delete().eq('id', logRow.id)
    return { status: 'error', error: `thread: ${threadError?.message ?? 'unknown'}` }
  }

  // 9. ログに thread_id を反映。
  await admin
    .from('daily_zukan_thread_logs')
    .update({ thread_id: thread.id })
    .eq('id', logRow.id)

  return {
    status: 'created',
    cardSlug: card.slug,
    cardName: card.name,
    threadId: thread.id,
    cycleNo,
    postedDate,
  }
}
