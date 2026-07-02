import { createAdminClient } from '@/lib/supabase-admin'
import { SITE_URL } from '@/lib/site-config'

// 自動生成スレを分類するカテゴリ（思い出・昔話・過去商品）。見つからなければ未分類。
const ZUKAN_CATEGORY_SLUG = 'classic'
const SCHEDULE_LOOKAHEAD_DAYS = 30

type DailyZukanCard = {
  slug: string
  name: string
  official_image_url: string | null
}

type DailyZukanScheduleRow = {
  scheduled_date: string
  card_slug: string
  status: 'planned' | 'completed' | 'error'
  thread_id: number | null
}

type DailyZukanScheduleFill = {
  checkedFrom: string
  checkedTo: string
  inserted: number
  missing: number
  reason?: string
}

export type DailyZukanResult =
  | {
      status: 'created'
      cardSlug: string
      cardName: string
      cardUrl: string
      imageUrl: string
      threadId: number
      cycleNo: number
      postedDate: string
      schedule: { status: 'used' | 'fallback_without_schedule'; filled: DailyZukanScheduleFill | null }
    }
  | { status: 'skipped'; reason: string; postedDate: string; schedule?: DailyZukanScheduleFill | null }
  | { status: 'error'; error: string; schedule?: DailyZukanScheduleFill | null }

// JST（UTC+9）基準の YYYY-MM-DD を返す。1日1スレの判定に使う。
export function getJstDateKey(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function buildDateKeys(startDate: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) => addDaysToDateKey(startDate, index))
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function shortenError(error: string): string {
  return error.length > 500 ? `${error.slice(0, 500)}...` : error
}

function isMissingScheduleTable(error: string): boolean {
  return error.includes('daily_zukan_thread_schedule') && /Could not find the table|schema cache/i.test(error)
}

function buildBody(cardName: string, cardUrl: string): string {
  return [
    `みんなの`,
    `「${cardName}」に対する`,
    `思い出を募集中です。`,
    ``,
    `当時の思い出でも、今の評価でもOKです。`,
    ``,
    `使っていたデッキ、当てた時の記憶`,
    `対戦で印象に残った場面など`,
    ``,
    `気軽にコメントしてください。`,
    ``,
    `思い出図鑑ページ：`,
    cardUrl,
  ].join('\n')
}

async function fetchPublishedCards(admin: ReturnType<typeof createAdminClient>): Promise<{
  cards: DailyZukanCard[] | null
  error: string | null
}> {
  const { data: cards, error } = await admin
    .from('zukan_cards')
    .select('slug, name, official_image_url')
    .eq('is_published', true)

  if (error) {
    return { cards: null, error: `cards: ${error.message}` }
  }
  return {
    cards: ((cards ?? []) as DailyZukanCard[]).filter((card) =>
      Boolean(card.slug && card.name && card.official_image_url?.trim()),
    ),
    error: null,
  }
}

function chooseScheduleCard(
  cards: DailyZukanCard[],
  usedLogSlugs: Set<string>,
  reservedSlugs: Set<string>,
): DailyZukanCard {
  const unusedAndUnreserved = cards.filter(
    (card) => !usedLogSlugs.has(card.slug) && !reservedSlugs.has(card.slug),
  )
  if (unusedAndUnreserved.length > 0) {
    return pickRandom(unusedAndUnreserved)
  }

  const unreserved = cards.filter((card) => !reservedSlugs.has(card.slug))
  if (unreserved.length > 0) {
    return pickRandom(unreserved)
  }

  return pickRandom(cards)
}

// 今日以降の予定を30日分まで補充する。
// 既に予定がある日は上書きせず、カード候補が足りない場合だけ重複を許容する。
export async function fillDailyZukanThreadSchedule(
  admin: ReturnType<typeof createAdminClient>,
  startDate: string = getJstDateKey(),
  days: number = SCHEDULE_LOOKAHEAD_DAYS,
): Promise<DailyZukanScheduleFill> {
  const dateKeys = buildDateKeys(startDate, days)
  const endDate = dateKeys[dateKeys.length - 1] ?? startDate

  const { cards, error: cardsError } = await fetchPublishedCards(admin)
  if (cardsError) {
    return { checkedFrom: startDate, checkedTo: endDate, inserted: 0, missing: days, reason: cardsError }
  }
  if (!cards || cards.length === 0) {
    return {
      checkedFrom: startDate,
      checkedTo: endDate,
      inserted: 0,
      missing: days,
      reason: 'no_published_cards',
    }
  }

  const { data: existingRows, error: existingError } = await admin
    .from('daily_zukan_thread_schedule')
    .select('scheduled_date, card_slug')
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
  if (existingError) {
    return {
      checkedFrom: startDate,
      checkedTo: endDate,
      inserted: 0,
      missing: days,
      reason: `schedule-existing: ${existingError.message}`,
    }
  }

  const existingDates = new Set((existingRows ?? []).map((row) => row.scheduled_date as string))
  const reservedSlugs = new Set((existingRows ?? []).map((row) => row.card_slug as string))
  const missingDates = dateKeys.filter((dateKey) => !existingDates.has(dateKey))

  if (missingDates.length === 0) {
    return { checkedFrom: startDate, checkedTo: endDate, inserted: 0, missing: 0 }
  }

  const { data: usedRows, error: usedError } = await admin
    .from('daily_zukan_thread_logs')
    .select('card_slug')
  if (usedError) {
    return {
      checkedFrom: startDate,
      checkedTo: endDate,
      inserted: 0,
      missing: missingDates.length,
      reason: `schedule-used: ${usedError.message}`,
    }
  }
  const usedLogSlugs = new Set((usedRows ?? []).map((row) => row.card_slug as string))

  const inserts = missingDates.map((scheduledDate) => {
    const card = chooseScheduleCard(cards, usedLogSlugs, reservedSlugs)
    reservedSlugs.add(card.slug)
    return {
      scheduled_date: scheduledDate,
      card_slug: card.slug,
      status: 'planned',
    }
  })

  const { error: insertError } = await admin
    .from('daily_zukan_thread_schedule')
    .upsert(inserts, { onConflict: 'scheduled_date', ignoreDuplicates: true })
  if (insertError) {
    return {
      checkedFrom: startDate,
      checkedTo: endDate,
      inserted: 0,
      missing: missingDates.length,
      reason: `schedule-insert: ${insertError.message}`,
    }
  }

  return { checkedFrom: startDate, checkedTo: endDate, inserted: inserts.length, missing: missingDates.length }
}

async function getScheduleForDate(
  admin: ReturnType<typeof createAdminClient>,
  postedDate: string,
): Promise<{ row: DailyZukanScheduleRow | null; error: string | null }> {
  const { data, error } = await admin
    .from('daily_zukan_thread_schedule')
    .select('scheduled_date, card_slug, status, thread_id')
    .eq('scheduled_date', postedDate)
    .maybeSingle()

  if (error) {
    return { row: null, error: `schedule-today: ${error.message}` }
  }
  return { row: data as DailyZukanScheduleRow | null, error: null }
}

async function pickFallbackCardWithoutSchedule(
  admin: ReturnType<typeof createAdminClient>,
  cards: DailyZukanCard[],
): Promise<{ card: DailyZukanCard | null; error: string | null }> {
  const { data: usedRows, error } = await admin
    .from('daily_zukan_thread_logs')
    .select('card_slug')
  if (error) {
    return { card: null, error: `fallback-used: ${error.message}` }
  }

  const usedLogSlugs = new Set((usedRows ?? []).map((row) => row.card_slug as string))
  return { card: chooseScheduleCard(cards, usedLogSlugs, new Set()), error: null }
}

async function markScheduleError(
  admin: ReturnType<typeof createAdminClient>,
  postedDate: string,
  error: string,
): Promise<void> {
  await admin
    .from('daily_zukan_thread_schedule')
    .update({
      status: 'error',
      error: shortenError(error),
    })
    .eq('scheduled_date', postedDate)
}

async function determineCycleNo(
  admin: ReturnType<typeof createAdminClient>,
  cards: DailyZukanCard[],
): Promise<{ cycleNo: number | null; error: string | null }> {
  const { data: cycleRow, error: cycleError } = await admin
    .from('daily_zukan_thread_logs')
    .select('cycle_no')
    .order('cycle_no', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (cycleError) {
    return { cycleNo: null, error: `cycle: ${cycleError.message}` }
  }

  let cycleNo = cycleRow?.cycle_no ?? 1
  const { data: usedRows, error: usedError } = await admin
    .from('daily_zukan_thread_logs')
    .select('card_slug')
    .eq('cycle_no', cycleNo)
  if (usedError) {
    return { cycleNo: null, error: `used: ${usedError.message}` }
  }

  const usedSlugs = new Set((usedRows ?? []).map((row) => row.card_slug as string))
  if (usedSlugs.size >= cards.length) {
    cycleNo += 1
  }

  return { cycleNo, error: null }
}

// 毎日1回呼ばれ、当日の予定カードを使って通常スレを作成する。
// - 同一日に2回目以降の呼び出しは作成しない（posted_date UNIQUE で保証）
// - 予定が無ければ今日以降30日分を補充してから当日分を使う
// - daily_zukan_thread_logs は実際にスレ作成が成功した履歴として維持する
export async function runDailyZukanThread(): Promise<DailyZukanResult> {
  const admin = createAdminClient()
  const postedDate = getJstDateKey()
  let scheduleFill: DailyZukanScheduleFill | null = null

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

  // 2. 今日の予定カードを取得。無ければ先30日分を補充してから再取得する。
  let scheduleResult = await getScheduleForDate(admin, postedDate)
  let scheduleUnavailable = false
  if (scheduleResult.error) {
    if (isMissingScheduleTable(scheduleResult.error)) {
      scheduleUnavailable = true
      scheduleResult = { row: null, error: null }
      console.warn('[daily-zukan-thread] daily_zukan_thread_schedule is unavailable; using log-only fallback')
    } else {
      return { status: 'error', error: scheduleResult.error }
    }
  }
  if (!scheduleResult.row && !scheduleUnavailable) {
    scheduleFill = await fillDailyZukanThreadSchedule(admin, postedDate)
    if (scheduleFill.reason) {
      return { status: 'error', error: scheduleFill.reason, schedule: scheduleFill }
    }
    scheduleResult = await getScheduleForDate(admin, postedDate)
    if (scheduleResult.error) {
      return { status: 'error', error: scheduleResult.error, schedule: scheduleFill }
    }
  }

  const schedule = scheduleResult.row
  if (!schedule && !scheduleUnavailable) {
    return { status: 'skipped', reason: 'no_schedule_for_today', postedDate, schedule: scheduleFill }
  }
  if (schedule?.status === 'completed') {
    return { status: 'skipped', reason: 'schedule_already_completed', postedDate, schedule: scheduleFill }
  }
  if (schedule?.status === 'error' && schedule.thread_id != null) {
    return { status: 'skipped', reason: 'schedule_error_has_thread_id', postedDate, schedule: scheduleFill }
  }

  // 3. 公開カードを全件取得し、今日の予定カードを解決する。
  const { cards, error: cardsError } = await fetchPublishedCards(admin)
  if (cardsError) {
    if (schedule) await markScheduleError(admin, postedDate, cardsError)
    return { status: 'error', error: cardsError, schedule: scheduleFill }
  }
  if (!cards || cards.length === 0) {
    if (schedule) await markScheduleError(admin, postedDate, 'no_published_cards')
    return { status: 'skipped', reason: 'no_published_cards', postedDate, schedule: scheduleFill }
  }

  const fallbackPick = schedule
    ? { card: null, error: null }
    : await pickFallbackCardWithoutSchedule(admin, cards)
  if (fallbackPick.error) {
    return { status: 'error', error: fallbackPick.error, schedule: scheduleFill }
  }

  const card = schedule
    ? cards.find((item) => item.slug === schedule.card_slug)
    : fallbackPick.card
  if (!card) {
    const error = schedule ? `scheduled_card_not_found: ${schedule.card_slug}` : 'fallback_card_not_found'
    if (schedule) await markScheduleError(admin, postedDate, error)
    return { status: 'error', error, schedule: scheduleFill }
  }

  // 4. 現在の周回番号を決定（履歴が無ければ1周目）。
  const cycleResult = await determineCycleNo(admin, cards)
  if (cycleResult.error || cycleResult.cycleNo == null) {
    const error = cycleResult.error ?? 'cycle: unknown'
    if (schedule) await markScheduleError(admin, postedDate, error)
    return { status: 'error', error, schedule: scheduleFill }
  }
  const cycleNo = cycleResult.cycleNo

  // 5. 先にログ行を確保（posted_date UNIQUE が多重起動の最終ガード）。
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
      return { status: 'skipped', reason: 'race_already_posted', postedDate, schedule: scheduleFill }
    }
    const error = `log: ${logError.message}`
    if (schedule) await markScheduleError(admin, postedDate, error)
    return { status: 'error', error, schedule: scheduleFill }
  }

  // 6. 通常スレとして作成（画像は図鑑のカード画像を流用）。
  const cardUrl = `${SITE_URL}/zukan/card/${card.slug}`
  const title = `${card.name}について語ろう`
  const body = buildBody(card.name, cardUrl)

  const { data: categoryRow } = await admin
    .from('categories')
    .select('id')
    .eq('slug', ZUKAN_CATEGORY_SLUG)
    .maybeSingle()
  const categoryId: number | null = categoryRow?.id ?? null

  let { data: thread, error: threadError } = await admin
    .from('threads')
    .insert({
      title,
      body,
      category_id: categoryId,
      author_name: '名無しのデュエリスト',
      auto_lock_exempt: true,
      ...(card.official_image_url ? { image_url: card.official_image_url } : {}),
    })
    .select('id')
    .single()

  if (threadError && (threadError.code === '42703' || threadError.message?.includes('auto_lock_exempt'))) {
    const retry = await admin
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
    thread = retry.data
    threadError = retry.error
  }

  if (threadError || !thread) {
    // スレ作成に失敗したらログ行を削除し、同日の再試行でカードを消費しない。
    await admin.from('daily_zukan_thread_logs').delete().eq('id', logRow.id)
    const error = `thread: ${threadError?.message ?? 'unknown'}`
    if (schedule) await markScheduleError(admin, postedDate, error)
    return { status: 'error', error, schedule: scheduleFill }
  }

  // 7. ログと予定に thread_id / 完了状態を反映。
  await admin
    .from('daily_zukan_thread_logs')
    .update({ thread_id: thread.id })
    .eq('id', logRow.id)
  if (schedule) {
    const { error: scheduleUpdateError } = await admin
      .from('daily_zukan_thread_schedule')
      .update({
        status: 'completed',
        thread_id: thread.id,
        completed_at: new Date().toISOString(),
        error: null,
      })
      .eq('scheduled_date', postedDate)
    if (scheduleUpdateError) {
      return {
        status: 'error',
        error: `schedule-complete: ${scheduleUpdateError.message}`,
        schedule: scheduleFill,
      }
    }
  }

  return {
    status: 'created',
    cardSlug: card.slug,
    cardName: card.name,
    cardUrl,
    imageUrl: card.official_image_url ?? '',
    threadId: thread.id,
    cycleNo,
    postedDate,
    schedule: { status: schedule ? 'used' : 'fallback_without_schedule', filled: scheduleFill },
  }
}

// retry_typefully モード用：指定日のログから既存スレ情報を引く。
// スレは作り直さず、Typefully再投稿に必要な threadId / cardName だけ返す。
export type DailyZukanRetryLookup =
  | { status: 'found'; threadId: number; cardName: string; cardUrl: string; imageUrl: string; postedDate: string }
  | { status: 'not_found'; reason: string; postedDate: string }
  | { status: 'error'; error: string }

export async function getDailyZukanThreadForRetry(
  postedDate: string,
): Promise<DailyZukanRetryLookup> {
  const admin = createAdminClient()

  // 1. 該当日のログ行を取得。
  const { data: log, error: logError } = await admin
    .from('daily_zukan_thread_logs')
    .select('card_slug, thread_id')
    .eq('posted_date', postedDate)
    .maybeSingle()
  if (logError) {
    return { status: 'error', error: `log: ${logError.message}` }
  }
  if (!log) {
    return { status: 'not_found', reason: 'no_log_for_date', postedDate }
  }
  if (log.thread_id == null) {
    // スレ未作成（作成途中で失敗した日）。Typefullyだけ再試行はできない。
    return { status: 'not_found', reason: 'no_thread_id', postedDate }
  }

  // 2. Typefully文面に使うカード名を取得。カードが見つからなければslugで代替。
  const { data: card } = await admin
    .from('zukan_cards')
    .select('name, slug, official_image_url')
    .eq('slug', log.card_slug)
    .maybeSingle()
  const cardName = card?.name ?? log.card_slug
  const cardSlug = card?.slug ?? log.card_slug
  const imageUrl = card?.official_image_url ?? ''

  return {
    status: 'found',
    threadId: log.thread_id,
    cardName,
    cardUrl: `${SITE_URL}/zukan/card/${cardSlug}`,
    imageUrl,
    postedDate,
  }
}
