/**
 * GET /api/internal/daily-zukan-thread
 * 思い出図鑑の公開カードから1枚選び、通常スレを自動作成する。
 * Vercel Cron から毎日 JST 0:00（UTC 15:00）に呼ばれる。
 * 手動実行: Authorization: Bearer ${CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server'
import { runDailyZukanThread } from '@/lib/daily-zukan-thread'
import { createTypefullyDraft } from '@/lib/typefully'
import { SITE_URL } from '@/lib/site-config'

export const runtime = 'nodejs'
export const maxDuration = 60

// Typefully投稿の結果（APIレスポンス・ログ用）。
type TypefullyOutcome =
  | { status: 'created'; id: string; shareUrl: string }
  | { status: 'error'; error: string }

// 作成済み思い出図鑑スレを X/Typefully へ投稿する文面を組み立てる。
function buildTypefullyText(cardName: string, threadUrl: string): string {
  return [
    '本日の思い出図鑑スレ',
    '',
    `${cardName}について語ろう`,
    '',
    '当時の思い出、使っていたデッキ、今の評価など',
    '気軽にコメントしてください。',
    '',
    threadUrl,
  ].join('\n')
}

function assertCronAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(req: NextRequest) {
  const authError = assertCronAuth(req)
  if (authError) return authError

  try {
    const result = await runDailyZukanThread()

    // Typefully投稿は created のときだけ実行する。
    // skipped / error では投稿しない。created は posted_date UNIQUE により
    // 1日1回しか発生しないため、同じ日に二重投稿されることはない。
    let typefully: TypefullyOutcome | undefined

    if (result.status === 'created') {
      console.log('[daily-zukan-thread] created', {
        postedDate: result.postedDate,
        cardName: result.cardName,
        cardSlug: result.cardSlug,
        threadId: result.threadId,
        cycleNo: result.cycleNo,
      })

      const threadUrl = `${SITE_URL}/thread/${result.threadId}`
      const text = buildTypefullyText(result.cardName, threadUrl)
      const tf = await createTypefullyDraft({ threadLines: [text] })

      if ('error' in tf) {
        // Typefully投稿の失敗だけでは作成済みスレ・ログは削除しない（ここでは触らない）。
        console.error('[daily-zukan-thread] typefully error', {
          threadId: result.threadId,
          error: tf.error,
        })
        typefully = { status: 'error', error: tf.error }
      } else {
        console.log('[daily-zukan-thread] typefully created', {
          threadId: result.threadId,
          id: tf.id,
          shareUrl: tf.share_url,
        })
        typefully = { status: 'created', id: tf.id, shareUrl: tf.share_url }
      }
    } else if (result.status === 'skipped') {
      console.log('[daily-zukan-thread] skipped', {
        postedDate: result.postedDate,
        reason: result.reason,
      })
    } else {
      console.error('[daily-zukan-thread] error', result)
    }

    // HTTPステータスはスレ作成結果のみで決める。Typefully投稿の失敗は
    // body の typefully フィールドで知らせるだけで、200のまま（スレ作成は成功している）。
    const httpStatus = result.status === 'error' ? 500 : 200
    return NextResponse.json(
      typefully ? { ...result, typefully } : result,
      { status: httpStatus }
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    console.error('[daily-zukan-thread] unexpected error:', message)
    return NextResponse.json({ status: 'error', error: message }, { status: 500 })
  }
}
