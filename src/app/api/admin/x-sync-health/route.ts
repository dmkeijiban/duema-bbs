/**
 * GET /api/admin/x-sync-health
 * Xスレ化（sync-typefully）の健全性チェックエンドポイント
 *
 * 確認できること：
 * - 環境変数の存在確認（値は表示しない）
 * - Typefully API 接続確認（サイレント認証エラーも検知）
 * - DB未反映件数（Typefully公開済み vs DBのsource_idマッチ）
 * - 未反映drafts一覧（最大10件）
 * - 直近同期スレ情報
 *
 * 手動実行: Authorization: Bearer ${INTERNAL_POST_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const maxDuration = 30

const TYPEFULLY_API = 'https://api.typefully.com/v2'

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 認証チェック
  const authHeader = req.headers.get('authorization')
  const internalSecret = process.env.INTERNAL_POST_SECRET
  if (!internalSecret || authHeader !== `Bearer ${internalSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result: Record<string, unknown> = {}

  // ── 1. 環境変数の存在確認（値は表示しない） ──────────────────────────────
  result.envVars = {
    TYPEFULLY_API_KEY: !!process.env.TYPEFULLY_API_KEY,
    TYPEFULLY_SOCIAL_SET_ID: !!process.env.TYPEFULLY_SOCIAL_SET_ID,
    INTERNAL_POST_SECRET: !!process.env.INTERNAL_POST_SECRET,
    DISCORD_WEBHOOK_URL: !!process.env.DISCORD_WEBHOOK_URL,
    CRON_SECRET: !!process.env.CRON_SECRET,
  }

  const apiKey = process.env.TYPEFULLY_API_KEY?.replace(/^﻿/, '')
  const socialSetId = process.env.TYPEFULLY_SOCIAL_SET_ID?.replace(/^﻿/, '')

  if (!apiKey || !socialSetId) {
    return NextResponse.json({
      ...result,
      error: 'TYPEFULLY_API_KEY または TYPEFULLY_SOCIAL_SET_ID が未設定',
    }, { status: 200 })
  }

  // ── 2. Typefully API 接続確認 ────────────────────────────────────────────
  let typefullyDrafts: Array<{ id: number; preview: string; published_at: string | null }> = []
  let typefullyStatus: 'ok' | 'auth_error' | 'api_error' | 'network_error' = 'ok'
  let typefullyErrorDetail: string | null = null

  try {
    const url = `${TYPEFULLY_API}/social-sets/${socialSetId}/drafts?status=published&order_by=-published_at&limit=50`
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      typefullyStatus = 'api_error'
      typefullyErrorDetail = `HTTP ${res.status}`
    } else {
      const json = await res.json()

      // サイレント認証エラー検知（HTTP 200 でも {"detail":"Token is not valid"} を返すことがある）
      const errField = json.detail ?? json.error ?? json.errors ?? json.message
      if (errField) {
        const errStr = String(errField)
        if (/token|unauthorized|invalid|forbidden/i.test(errStr)) {
          typefullyStatus = 'auth_error'
          typefullyErrorDetail = errStr.slice(0, 200)
        } else {
          typefullyStatus = 'api_error'
          typefullyErrorDetail = errStr.slice(0, 200)
        }
      } else if (!Array.isArray(json.results)) {
        typefullyStatus = 'api_error'
        typefullyErrorDetail = `unexpected response: ${JSON.stringify(json).slice(0, 100)}`
      } else {
        typefullyDrafts = json.results
      }
    }
  } catch (err) {
    typefullyStatus = 'network_error'
    typefullyErrorDetail = String(err).slice(0, 200)
  }

  result.typefully = {
    status: typefullyStatus,
    publishedDraftsCount: typefullyDrafts.length,
    ...(typefullyErrorDetail ? { errorDetail: typefullyErrorDetail } : {}),
  }

  // ── 3. DB未反映件数の計算 ────────────────────────────────────────────────
  const supabase = createAdminClient()

  // X_THREAD_SYNC_START_AT: カットオフ日時。これより前に公開されたdraftは対象外にする。
  // sync-typefully と同じロジックで、health check でも過去スキップ分を除外する。
  const syncStartAt = process.env.X_THREAD_SYNC_START_AT
    ? new Date(process.env.X_THREAD_SYNC_START_AT)
    : null

  // カットオフ以降の公開済みdraftだけをチェック対象にする
  const candidateDrafts = syncStartAt
    ? typefullyDrafts.filter(d => !d.published_at || new Date(d.published_at) >= syncStartAt)
    : typefullyDrafts

  // Typefullyの公開済みdraft IDリスト（カットオフ以降のみ）
  const draftIds = candidateDrafts.map(d => String(d.id))

  // DBに登録済みのsource_idを一括取得
  let unmatchedDrafts: typeof typefullyDrafts = []
  let dbCheckError: string | null = null

  if (draftIds.length > 0) {
    const { data: existingThreads, error: dbError } = await supabase
      .from('threads')
      .select('source_id')
      .in('source_id', draftIds)

    if (dbError) {
      dbCheckError = dbError.message
    } else {
      const existingSourceIds = new Set((existingThreads ?? []).map(t => t.source_id))
      unmatchedDrafts = candidateDrafts.filter(d => !existingSourceIds.has(String(d.id)))
    }
  }

  result.dbCheck = {
    ...(dbCheckError ? { error: dbCheckError } : {}),
    unmatchedCount: unmatchedDrafts.length,
    // 未反映drafts一覧（最大10件、previewは先頭50文字）
    unmatchedDrafts: unmatchedDrafts.slice(0, 10).map(d => ({
      draftId: d.id,
      publishedAt: d.published_at,
      preview: d.preview?.trim().slice(0, 50) ?? '',
    })),
  }

  // ── 4. 直近同期スレ情報 ──────────────────────────────────────────────────
  const { data: recentThreads, error: recentError } = await supabase
    .from('threads')
    .select('id, title, source_id, created_at, image_url')
    .eq('source', 'typefully')
    .order('created_at', { ascending: false })
    .limit(5)

  result.recentSyncedThreads = recentError
    ? { error: recentError.message }
    : (recentThreads ?? []).map(t => ({
        threadId: t.id,
        sourceId: t.source_id,
        title: (t.title as string)?.slice(0, 60),
        hasImage: !!t.image_url,
        createdAt: t.created_at,
      }))

  // ── 5. 全体ステータスサマリー ────────────────────────────────────────────
  const isHealthy =
    typefullyStatus === 'ok' &&
    !dbCheckError &&
    unmatchedDrafts.length === 0

  result.summary = {
    healthy: isHealthy,
    typefullyConnection: typefullyStatus,
    unmatchedDrafts: unmatchedDrafts.length,
    syncStartAt: syncStartAt ? syncStartAt.toISOString() : null,
    skippedOldCount: typefullyDrafts.length - candidateDrafts.length,
    backfillCommand: unmatchedDrafts.length > 0
      ? 'GET /api/internal/sync-typefully?max_new=50 (Authorization: Bearer INTERNAL_POST_SECRET)'
      : null,
    dryRunCommand: unmatchedDrafts.length > 0
      ? 'GET /api/internal/sync-typefully?dry_run=1&max_new=50 (Authorization: Bearer INTERNAL_POST_SECRET)'
      : null,
  }

  return NextResponse.json(result)
}
