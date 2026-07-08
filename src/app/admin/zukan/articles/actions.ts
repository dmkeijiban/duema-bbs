'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  normalizeZukanArticleStatus,
  normalizeZukanArticleTargetType,
  parseZukanArticleBlocks,
  parseZukanArticleJson,
  type ZukanArticleBlock,
} from '@/lib/zukan-articles'
import { parseZukanArticleBodyText } from '@/lib/zukan-article-markdown'
import { buildDefaultArticleSlug, normalizeArticleSlug } from '@/lib/zukan-article-slug'

export type ZukanArticleFormValues = {
  id: string
  articleType: string
  targetId: string
  slug: string
  title: string
  description: string
  status: string
  bodyText: string
  blocksJson: string
}

export type SaveZukanArticleState = {
  ok?: boolean
  error?: string
  existingId?: string
  values?: ZukanArticleFormValues
}

function normalizeTargetId(value: FormDataEntryValue | null) {
  return String(value ?? '').trim().toLowerCase()
}

async function requireAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get('admin_auth')?.value)) redirect('/admin')
}

function parseBlocksInput(raw: string): { blocks: ZukanArticleBlock[]; title?: string; description?: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('本文JSONをJSONとして読み取れませんでした。')
  }

  if (Array.isArray(parsed)) {
    const blocks = parseZukanArticleBlocks(parsed)
    if (!blocks) throw new Error('未対応または必須項目不足のブロックがあります。')
    return { blocks }
  }

  const article = parseZukanArticleJson(parsed)
  if (!article) throw new Error('記事JSONを読み取れませんでした。blocks配列、title、targetTypeなどを確認してください。')
  return { blocks: article.blocks, title: article.title, description: article.description }
}

function submittedValues(formData: FormData): ZukanArticleFormValues {
  return {
    id: String(formData.get('id') ?? '').trim(),
    articleType: String(formData.get('article_type') ?? ''),
    targetId: String(formData.get('target_id') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    status: String(formData.get('status') ?? ''),
    bodyText: String(formData.get('body_text') ?? ''),
    blocksJson: String(formData.get('blocks_json') ?? ''),
  }
}

function formError(formData: FormData, error: string, existingId?: string): SaveZukanArticleState {
  return {
    ok: false,
    error,
    existingId,
    values: submittedValues(formData),
  }
}

async function makeUniqueArticleSlug(supabase: ReturnType<typeof createAdminClient>, baseSlug: string, currentId?: string) {
  const normalizedBase = normalizeArticleSlug(baseSlug) || 'article'
  const candidates = [
    normalizedBase,
    ...Array.from({ length: 49 }, (_, index) => `${normalizedBase}-${index + 2}`),
  ]

  const { data, error } = await supabase
    .from('zukan_articles')
    .select('id, slug')
    .in('slug', candidates)

  if (error) throw new Error(error.message)

  const used = new Set(
    (data ?? [])
      .filter(row => !currentId || row.id !== currentId)
      .map(row => row.slug),
  )

  return candidates.find(candidate => !used.has(candidate)) ?? `${normalizedBase}-${Date.now()}`
}

export async function saveZukanArticle(_prevState: SaveZukanArticleState, formData: FormData): Promise<SaveZukanArticleState> {
  await requireAdmin()

  const id = String(formData.get('id') ?? '').trim()
  const articleType = normalizeZukanArticleTargetType(formData.get('article_type'))
  const targetId = normalizeTargetId(formData.get('target_id'))
  const intent = String(formData.get('intent') ?? '')
  const status = intent === 'publish'
    ? 'published'
    : intent === 'draft'
      ? 'draft'
      : normalizeZukanArticleStatus(formData.get('status')) ?? 'draft'
  const blocksRaw = String(formData.get('blocks_json') ?? '')
  const bodyText = String(formData.get('body_text') ?? '')
  const titleInput = String(formData.get('title') ?? '').trim()
  const slugInput = normalizeArticleSlug(String(formData.get('slug') ?? ''))
  const baseSlug = slugInput || buildDefaultArticleSlug({
    articleType,
    targetId,
    title: titleInput,
  })

  if (!articleType) return formError(formData, 'invalid_type')
  if (!targetId) return formError(formData, 'missing_target')
  if (!baseSlug) return formError(formData, 'missing_slug')
  if (!blocksRaw.trim() && !bodyText.trim()) return formError(formData, 'missing_blocks')

  let parsed: { blocks: ZukanArticleBlock[]; title?: string; description?: string }
  if (bodyText.trim()) {
    const bodyResult = parseZukanArticleBodyText(bodyText)
    if (!bodyResult.ok) {
      return formError(formData, bodyResult.error)
    }
    parsed = { blocks: bodyResult.blocks }
  } else if (blocksRaw.trim()) {
    try {
      parsed = parseBlocksInput(blocksRaw)
    } catch (error) {
      return formError(formData, error instanceof Error ? error.message : 'invalid json')
    }
  } else {
    parsed = { blocks: [] }
  }
  if (parsed.blocks.length === 0) return formError(formData, 'missing_blocks')

  const title = titleInput || parsed.title
  const description = String(formData.get('description') ?? '').trim() || parsed.description || null
  if (!title) return formError(formData, 'missing_title')

  const supabase = createAdminClient()
  let slug: string
  try {
    slug = await makeUniqueArticleSlug(supabase, baseSlug, id || undefined)
  } catch (error) {
    return formError(formData, error instanceof Error ? error.message : 'slug_check_failed')
  }

  const payload = {
    slug,
    article_type: articleType,
    target_id: targetId,
    title,
    description,
    status,
    blocks: parsed.blocks,
    published_at: status === 'published' ? new Date().toISOString() : null,
  }

  const query = id
    ? supabase.from('zukan_articles').update(payload).eq('id', id).select('id').single()
    : supabase.from('zukan_articles').insert(payload).select('id').single()

  const { data, error } = await query
  if (error || !data) {
    if (error?.code === '23505') {
      const retrySlug = await makeUniqueArticleSlug(supabase, slug, id || undefined)
      const retryPayload = { ...payload, slug: retrySlug }
      const retryQuery = id
        ? supabase.from('zukan_articles').update(retryPayload).eq('id', id).select('id').single()
        : supabase.from('zukan_articles').insert(retryPayload).select('id').single()
      const retryResult = await retryQuery
      if (retryResult.error || !retryResult.data) {
        return formError(formData, retryResult.error?.message ?? 'save failed')
      }
      revalidatePath('/admin/zukan/articles')
      revalidatePath('/zukan/articles')
      revalidatePath(`/zukan/articles/${retrySlug}`)
      redirect(`/admin/zukan/articles?edit=${encodeURIComponent(retryResult.data.id)}&saved=1&preview=1`)
    }
    return formError(formData, error?.message ?? 'save failed')
  }

  revalidatePath('/admin/zukan/articles')
  revalidatePath('/zukan/articles')
  revalidatePath(`/zukan/articles/${slug}`)
  redirect(`/admin/zukan/articles?edit=${encodeURIComponent(data.id)}&saved=1&preview=1`)
}

export async function archiveZukanArticle(formData: FormData) {
  await requireAdmin()

  const id = String(formData.get('id') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim()
  if (!id) redirect('/admin/zukan/articles?error=missing_id')

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('zukan_articles')
    .update({
      status: 'archived',
      published_at: null,
    })
    .eq('id', id)

  if (error) {
    redirect(`/admin/zukan/articles?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/admin/zukan/articles')
  revalidatePath('/zukan/articles')
  if (slug) revalidatePath(`/zukan/articles/${slug}`)
  redirect(`/admin/zukan/articles?edit=${encodeURIComponent(id)}&archived=1`)
}
