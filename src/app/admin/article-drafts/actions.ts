'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { readArticleDraft, slugFromDraft } from '@/lib/article-drafts'

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
    const { data } = await supabase.from('fixed_pages').select('id').eq('slug', slug).maybeSingle()
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

  const { data, error } = await supabase
    .from('fixed_pages')
    .insert({
      title: draft.title,
      slug,
      nav_label: draft.title,
      content: draft.blocks as unknown as Record<string, unknown>[],
      is_published: false,
      show_in_nav: false,
      sort_order: 80,
      external_url: null,
    })
    .select('id')
    .single()

  if (error || !data) {
    redirect(`/admin/article-drafts?error=${encodeURIComponent(error?.message ?? 'import failed')}`)
  }

  revalidateTag('fixed_pages', OPT)
  revalidateTag('nav-pages', OPT)
  redirect(`/admin/pages/${data.id}`)
}

