'use server'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import {
  MAKER_EVENT_DEDUP_SECONDS,
  isValidAnonymousId,
  isValidMakerEventType,
  isValidMakerSlug,
} from '@/lib/maker-events-shared'

type RecordMakerEventInput = {
  slug: string
  eventType: string
  anonymousId?: string | null
}

type RecordMakerPageViewInput = {
  slug: string
  anonymousId?: string | null
  viewId: string
}

const BOT_USER_AGENT_PATTERN = /bot|crawler|spider|preview|facebookexternalhit|twitterbot|slurp|bingbot|googlebot/i

/** 1回の実ブラウザ表示を、viewIdを冪等キーとして記録する。 */
export async function recordMakerPageView(input: RecordMakerPageViewInput): Promise<{ ok: boolean }> {
  try {
    if (!input || typeof input !== 'object' || !isValidMakerSlug(input.slug) || !isValidAnonymousId(input.viewId)) return { ok: false }
    const userAgent = (await headers()).get('user-agent') ?? ''
    if (!userAgent || BOT_USER_AGENT_PATTERN.test(userAgent)) return { ok: false }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? null
    const anonymousId = isValidAnonymousId(input.anonymousId) ? input.anonymousId : null
    if (!userId && !anonymousId) return { ok: false }

    const admin = createAdminClient()
    const { data: project, error: projectError } = await admin.from('maker_projects').select('id')
      .eq('slug', input.slug).eq('is_public', true).eq('status', 'published').maybeSingle()
    if (projectError || !project) return { ok: false }

    const { error } = await admin.rpc('record_maker_page_view', {
      p_project_id: project.id,
      p_user_id: userId,
      p_anonymous_id: userId ? null : anonymousId,
      p_view_id: input.viewId,
    })
    if (error) console.warn('recordMakerPageView failed', { slug: input.slug, message: error.message })
    return { ok: !error }
  } catch (error) {
    console.warn('recordMakerPageView failed', { message: error instanceof Error ? error.message : String(error) })
    return { ok: false }
  }
}

/**
 * メーカー企画の利用イベントを記録する（公開中の企画のみ）。
 * 不正な event_type / slug / anonymous_id は拒否。
 * 短時間の重複は record_maker_event 関数側で除外される。
 * 統計用途のみ：カード配置内容やIPアドレスは保存しない。
 */
export async function recordMakerEvent(input: RecordMakerEventInput): Promise<{ ok: boolean }> {
  try {
    if (!input || typeof input !== 'object') return { ok: false }
    const { slug, eventType, anonymousId } = input
    if (!isValidMakerSlug(slug) || !isValidMakerEventType(eventType)) return { ok: false }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const userId = user?.id ?? null
    const validAnonymousId = isValidAnonymousId(anonymousId) ? anonymousId : null
    if (!userId && !validAnonymousId) return { ok: false }

    const admin = createAdminClient()
    const { data: project, error: projectError } = await admin
      .from('maker_projects')
      .select('id')
      .eq('slug', slug)
      .eq('is_public', true)
      .eq('status', 'published')
      .maybeSingle()
    if (projectError || !project) return { ok: false }

    const { error } = await admin.rpc('record_maker_event', {
      p_project_id: project.id,
      p_event_type: eventType,
      p_user_id: userId,
      p_anonymous_id: userId ? null : validAnonymousId,
      p_dedup_seconds: MAKER_EVENT_DEDUP_SECONDS[eventType],
    })
    if (error) {
      console.warn('recordMakerEvent failed', { slug, eventType, message: error.message })
      return { ok: false }
    }
    return { ok: true }
  } catch (error) {
    console.warn('recordMakerEvent failed', { message: error instanceof Error ? error.message : String(error) })
    return { ok: false }
  }
}
