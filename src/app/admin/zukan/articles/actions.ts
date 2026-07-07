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

function normalizeTargetId(value: FormDataEntryValue | null) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeArticleSlug(value: FormDataEntryValue | null) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
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

export async function saveZukanArticle(formData: FormData) {
  await requireAdmin()

  const id = String(formData.get('id') ?? '').trim()
  const articleType = normalizeZukanArticleTargetType(formData.get('article_type'))
  const targetId = normalizeTargetId(formData.get('target_id'))
  const slug = normalizeArticleSlug(formData.get('slug')) || targetId
  const intent = String(formData.get('intent') ?? '')
  const status = intent === 'publish'
    ? 'published'
    : intent === 'draft'
      ? 'draft'
      : normalizeZukanArticleStatus(formData.get('status')) ?? 'draft'
  const blocksRaw = String(formData.get('blocks_json') ?? '').trim()

  if (!articleType) redirect('/admin/zukan/articles?error=invalid_type')
  if (!targetId) redirect('/admin/zukan/articles?error=missing_target')
  if (!slug) redirect('/admin/zukan/articles?error=missing_slug')
  if (!blocksRaw) redirect('/admin/zukan/articles?error=missing_blocks')

  let parsed: { blocks: ZukanArticleBlock[]; title?: string; description?: string }
  try {
    parsed = parseBlocksInput(blocksRaw)
  } catch (error) {
    redirect(`/admin/zukan/articles?error=${encodeURIComponent(error instanceof Error ? error.message : 'invalid json')}`)
  }

  const title = String(formData.get('title') ?? '').trim() || parsed.title
  const description = String(formData.get('description') ?? '').trim() || parsed.description || null
  if (!title) redirect('/admin/zukan/articles?error=missing_title')

  const supabase = createAdminClient()
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
    redirect(`/admin/zukan/articles?error=${encodeURIComponent(error?.message ?? 'save failed')}`)
  }

  revalidatePath('/admin/zukan/articles')
  revalidatePath('/zukan/articles')
  revalidatePath(`/zukan/articles/${slug}`)
  redirect(`/admin/zukan/articles?edit=${encodeURIComponent(data.id)}&saved=1&preview=1`)
}
