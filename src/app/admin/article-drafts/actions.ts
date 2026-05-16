'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { markdownToSummaryHtml, readArticleDraft, slugFromDraft } from '@/lib/article-drafts'

const OPT = { expire: 0 } as const

async function requireAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get('admin_auth')?.value)) redirect('/admin')
}

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

async function uniqueSlug(base: string) {
  const supabase = await createClient()
  const cleanBase = normalizeSlug(base) || 'article-draft'
  for (let i = 0; i < 100; i += 1) {
    const slug = i === 0 ? cleanBase : `${cleanBase}-${i + 1}`
    const { data } = await supabase.from('summaries').select('id').eq('slug', slug).maybeSingle()
    if (!data) return slug
  }
  return `${cleanBase}-${Date.now()}`
}

export async function importArticleDraft(formData: FormData) {
  await requireAdmin()
  const file = String(formData.get('file') ?? '')
  const draft = await readArticleDraft(file)
  const supabase = await createClient()
  const slug = await uniqueSlug(slugFromDraft(file))
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('summaries')
    .insert({
      type: 'manual',
      title: draft.title,
      slug,
      period_start: today,
      period_end: today,
      threads: [],
      published: false,
      body: markdownToSummaryHtml(draft.markdown),
    })
    .select('id, slug')
    .single()

  if (error || !data) {
    redirect(`/admin/article-drafts?error=${encodeURIComponent(error?.message ?? 'import failed')}`)
  }

  revalidateTag('summaries', OPT)
  redirect(`/admin/summary?imported=${encodeURIComponent(data.slug)}`)
}
