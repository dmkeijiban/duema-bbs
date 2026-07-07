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
  const slug = normalizeArticleSlug(String(formData.get('slug') ?? '')) || buildDefaultArticleSlug({
    articleType,
    targetId,
    title: titleInput,
  })

  if (!articleType) return formError(formData, 'invalid_type')
  if (!targetId) return formError(formData, 'missing_target')
  if (!slug) return formError(formData, 'missing_slug')
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
  if (!id) {
    const { data: existingTarget } = await supabase
      .from('zukan_articles')
      .select('id')
      .eq('article_type', articleType)
      .eq('target_id', targetId)
      .limit(1)
    if (existingTarget?.[0]?.id) {
      return formError(formData, 'existing_target', existingTarget[0].id)
    }

    const { data: existingSlug } = await supabase
      .from('zukan_articles')
      .select('id')
      .eq('slug', slug)
      .limit(1)
    if (existingSlug?.[0]?.id) {
      return formError(formData, 'existing_slug', existingSlug[0].id)
    }
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
      return formError(formData, 'duplicate_slug')
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
