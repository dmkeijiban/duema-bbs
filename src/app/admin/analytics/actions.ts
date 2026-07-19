'use server'

import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

const OPT = { expire: 0 } as const

type ToggleResult =
  | { ok: true; isPublic: boolean; affectedPageTitles: string[] }
  | { ok: false; error: string }

type PublishToggleMarker = {
  previousStatus?: string
  autoUnpublishedFixedPageIds?: number[]
  unpublishedAt?: string
}

const RESTORABLE_STATUSES = ['published', 'scheduled', 'ended'] as const

function parseConfig(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
}

function parseMarker(config: Record<string, unknown>): PublishToggleMarker {
  const raw = config.publishToggle
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const m = raw as Record<string, unknown>
  return {
    previousStatus: typeof m.previousStatus === 'string' ? m.previousStatus : undefined,
    autoUnpublishedFixedPageIds: Array.isArray(m.autoUnpublishedFixedPageIds)
      ? m.autoUnpublishedFixedPageIds.filter((v): v is number => typeof v === 'number' && Number.isInteger(v))
      : undefined,
  }
}

function revalidateMakerPaths(slug: string) {
  revalidatePath('/makers')
  revalidatePath(`/makers/${slug}`)
  revalidatePath('/admin/analytics')
}

function revalidateFixedPages() {
  revalidateTag('fixed_pages', OPT)
  revalidateTag('nav-pages', OPT)
}

export async function toggleMakerPublication(slug: string, makePublic: boolean): Promise<ToggleResult> {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return { ok: false, error: '認証エラーです。再ログインしてください。' }
  }
  if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(slug)) return { ok: false, error: 'slugが不正です' }

  const admin = createAdminClient()
  const { data: project, error: lookupError } = await admin
    .from('maker_projects')
    .select('id,slug,status,is_public,config')
    .eq('slug', slug)
    .single()
  if (lookupError || !project) return { ok: false, error: '企画が見つかりませんでした' }
  if (project.status === 'admin_only') return { ok: false, error: '管理者限定の企画はここでは切り替えできません' }

  const config = parseConfig(project.config)

  if (makePublic === Boolean(project.is_public)) {
    return { ok: true, isPublic: Boolean(project.is_public), affectedPageTitles: [] }
  }

  const now = new Date().toISOString()

  if (!makePublic) {
    // 非公開化: 連動する固定ページ（external_url 完全一致のみ）を先に非公開にする
    const { data: pages, error: pagesError } = await admin
      .from('fixed_pages')
      .select('id,title,is_published')
      .eq('external_url', `/makers/${slug}`)
    if (pagesError) return { ok: false, error: `固定ページの確認に失敗しました: ${pagesError.message}` }

    const targets = (pages ?? []).filter(p => p.is_published)
    const targetIds = targets.map(p => p.id as number)

    if (targetIds.length > 0) {
      const { error: pageUpdateError } = await admin
        .from('fixed_pages')
        .update({ is_published: false })
        .in('id', targetIds)
      if (pageUpdateError) return { ok: false, error: `固定ページの非公開化に失敗しました: ${pageUpdateError.message}` }
    }

    const marker: PublishToggleMarker = {
      previousStatus: project.status,
      autoUnpublishedFixedPageIds: targetIds,
      unpublishedAt: now,
    }
    const { error: makerError } = await admin
      .from('maker_projects')
      .update({ status: 'draft', is_public: false, config: { ...config, publishToggle: marker }, updated_at: now })
      .eq('id', project.id)

    if (makerError) {
      // 企画側が失敗したら固定ページを公開に戻して不整合を避ける
      if (targetIds.length > 0) {
        const { error: rollbackError } = await admin
          .from('fixed_pages')
          .update({ is_published: true })
          .in('id', targetIds)
        if (rollbackError) {
          revalidateFixedPages()
          return { ok: false, error: `企画の非公開化に失敗し、固定ページの復元にも失敗しました。/admin/pages で「${targets.map(t => t.title).join('、')}」の公開状態を確認してください。` }
        }
      }
      return { ok: false, error: `企画の非公開化に失敗しました: ${makerError.message}` }
    }

    revalidateMakerPaths(slug)
    if (targetIds.length > 0) revalidateFixedPages()
    return { ok: true, isPublic: false, affectedPageTitles: targets.map(t => String(t.title ?? '')) }
  }

  // 公開化: 企画を先に公開し、自動非公開にした固定ページのみ復元する
  const marker = parseMarker(config)
  const restoredStatus = marker.previousStatus && (RESTORABLE_STATUSES as readonly string[]).includes(marker.previousStatus)
    ? marker.previousStatus
    : 'published'
  const nextConfig = { ...config }
  delete nextConfig.publishToggle

  const { error: makerError } = await admin
    .from('maker_projects')
    .update({ status: restoredStatus, is_public: true, config: nextConfig, updated_at: now })
    .eq('id', project.id)
  if (makerError) return { ok: false, error: `企画の公開化に失敗しました: ${makerError.message}` }

  const restoreIds = marker.autoUnpublishedFixedPageIds ?? []
  const restoredTitles: string[] = []
  if (restoreIds.length > 0) {
    // 自動非公開にしたIDのうち、今も当該企画に紐づき非公開のものだけ戻す（手動変更は尊重）
    const { data: pages, error: pagesError } = await admin
      .from('fixed_pages')
      .select('id,title,is_published')
      .eq('external_url', `/makers/${slug}`)
      .in('id', restoreIds)
    if (pagesError) {
      revalidateMakerPaths(slug)
      return { ok: false, error: `企画は公開しましたが、固定ページの確認に失敗しました。/admin/pages で公開状態を確認してください: ${pagesError.message}` }
    }
    const restoreTargets = (pages ?? []).filter(p => !p.is_published)
    if (restoreTargets.length > 0) {
      const { error: restoreError } = await admin
        .from('fixed_pages')
        .update({ is_published: true })
        .in('id', restoreTargets.map(p => p.id as number))
      if (restoreError) {
        revalidateMakerPaths(slug)
        return { ok: false, error: `企画は公開しましたが、固定ページの復元に失敗しました。/admin/pages で「${restoreTargets.map(t => t.title).join('、')}」を公開に戻してください。` }
      }
      restoredTitles.push(...restoreTargets.map(t => String(t.title ?? '')))
    }
  }

  revalidateMakerPaths(slug)
  if (restoredTitles.length > 0) revalidateFixedPages()
  return { ok: true, isPublic: true, affectedPageTitles: restoredTitles }
}
