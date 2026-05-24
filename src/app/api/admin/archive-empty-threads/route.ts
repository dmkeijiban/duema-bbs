/**
 * /api/admin/archive-empty-threads
 *
 * 24時間以上経過した有効コメント0件スレを自動アーカイブするAPIルート。
 *
 * GET  ?dry_run=1  → 対象スレ一覧を返す（DBは変更しない）
 * GET  （なし）    → 実際にアーカイブを実行する
 *
 * 認証: admin_auth cookie または Authorization: Bearer $CRON_SECRET
 *
 * 自動アーカイブの除外条件:
 *   - is_protected = true
 *   - is_archived = true（既にアーカイブ済み）
 *   - created_at < 24時間前 でない（まだ新しい）
 *   - 有効コメント（is_deleted=false）が1件以上ある
 *
 * 将来の Vercel Cron 設定例（vercel.json）:
 *   { "crons": [{ "path": "/api/admin/archive-empty-threads", "schedule": "0 3 * * *" }] }
 *   → 毎日 JST 12:00 に実行（UTC 3:00）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { revalidatePath, revalidateTag } from 'next/cache'

export const runtime = 'nodejs'
export const maxDuration = 60

const ADMIN_COOKIE = 'admin_auth'

/** 認証チェック: admin cookie または CRON_SECRET Bearer トークン */
async function isAuthorized(req: NextRequest): Promise<boolean> {
  // 1) Cron / API キーでの呼び出し
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true

  // 2) 管理者ブラウザセッション
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)
}

/** Supabase service role client（PostgREST行数制限なし・RLS回避） */
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  // サービスロールキーがあれば使用、なければ anon key にフォールバック
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isDryRun = req.nextUrl.searchParams.get('dry_run') === '1'
  const supabase = createServiceClient()

  // -----------------------------------------------------------------
  // 自動アーカイブ対象を SQL で取得
  // NOT EXISTS を使うことで PostgREST の行数制限バグを回避する
  // （JS側で posts を全件取得して突き合わせると行数上限で誤判定が起きる）
  // -----------------------------------------------------------------
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error } = await supabase
    .from('threads')
    .select('id, title, created_at, post_count, is_protected, category_id')
    .eq('is_archived', false)
    .eq('is_protected', false)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 有効コメントが0件のものだけに絞る
  // Supabase JS では NOT EXISTS が直接書けないため、
  // 対象スレの posts(is_deleted=false) を一括取得して JS 側でフィルタ
  const candidateIds = (candidates ?? []).map(t => t.id)
  if (candidateIds.length === 0) {
    return NextResponse.json({
      dry_run: isDryRun,
      archived_count: 0,
      candidates: [],
      executed_at: new Date().toISOString(),
    })
  }

  // service role key があれば行数制限なし。なければ limit を大きく設定
  const { data: activePosts } = await supabase
    .from('posts')
    .select('thread_id')
    .eq('is_deleted', false)
    .in('thread_id', candidateIds)
    .limit(100000)

  const activeThreadIdSet = new Set((activePosts ?? []).map(p => p.thread_id))

  const targets = (candidates ?? []).filter(t => !activeThreadIdSet.has(t.id))

  // dry_run の場合はここで返す
  if (isDryRun) {
    return NextResponse.json({
      dry_run: true,
      target_count: targets.length,
      candidates: targets.map(t => ({
        thread_id: t.id,
        title: t.title,
        created_at: t.created_at,
        post_count: t.post_count,
        valid_post_count: 0,
        reason: '24時間以上経過かつ有効コメント0件',
      })),
      executed_at: new Date().toISOString(),
    })
  }

  // -----------------------------------------------------------------
  // 実際にアーカイブを実行
  // -----------------------------------------------------------------
  if (targets.length === 0) {
    return NextResponse.json({
      dry_run: false,
      archived_count: 0,
      archived_ids: [],
      executed_at: new Date().toISOString(),
    })
  }

  const targetIds = targets.map(t => t.id)
  const { error: updateError } = await supabase
    .from('threads')
    .update({
      is_archived: true,
    })
    .in('id', targetIds)
    .eq('is_protected', false) // 二重安全ガード

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // キャッシュ再検証
  revalidatePath('/')
  revalidateTag('threads', { expire: 0 })

  return NextResponse.json({
    dry_run: false,
    archived_count: targetIds.length,
    archived_ids: targetIds,
    archived_titles: targets.map(t => t.title),
    executed_at: new Date().toISOString(),
  })
}
