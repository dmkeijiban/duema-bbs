'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { parseSelectMakerConfig } from '@/lib/maker'
import { MAKER_CATEGORIES } from '@/lib/maker-catalog'

export async function saveSelectProject(formData: FormData) {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) return
  const value = (name: string) => String(formData.get(name) ?? '').trim()
  const slug = value('slug'); const title = value('title')
  if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(slug) || !title || title.length > 80) throw new Error('slugまたはタイトルが不正です')
  const minChoices = Number(value('minChoices')); const maxChoices = Number(value('maxChoices'))
  const config = parseSelectMakerConfig({
    description: value('description'), minChoices, maxChoices, exactChoices: formData.get('exactChoices') === 'on',
    reorderable: formData.get('reorderable') === 'on', duplicateRule: value('duplicateRule'), cardPool: value('cardPool'),
    resultTitle: value('resultTitle'), showTitle: formData.get('showTitle') === 'on', showComment: formData.get('showComment') === 'on',
    defaultTitle: value('defaultTitle'), defaultComment: value('defaultComment'), showSubmissions: formData.get('showSubmissions') === 'on',
    showAggregates: formData.get('showAggregates') === 'on', showZeroVotes: formData.get('showZeroVotes') === 'on',
    autoRegisterOnImageSave: formData.get('autoRegisterOnImageSave') === 'on', defaultListPublic: formData.get('defaultListPublic') === 'on',
    shareText: value('shareText'), hashtag: value('hashtag'),
  })
  const published = formData.get('published') === 'on'
  const admin = createAdminClient()
  const { error } = await admin.from('maker_projects').upsert({ slug, title, type: 'select', status: published ? 'published' : 'draft', is_public: published, config: { ...config, allowAnonymousSubmission: true }, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/makers/select'); revalidatePath('/makers'); revalidatePath(`/makers/${slug}`)
}

export async function saveMakerCatalogSettings(formData: FormData) {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) return
  const slug = String(formData.get('slug') ?? '')
  const admin = createAdminClient()
  const { data: project, error: lookupError } = await admin.from('maker_projects').select('config').eq('slug', slug).single()
  if (lookupError || !project) throw new Error('企画が見つかりません')
  const value = (name: string) => String(formData.get(name) ?? '').trim()
  const category = value('category')
  if (!MAKER_CATEGORIES.includes(category as typeof MAKER_CATEGORIES[number])) throw new Error('カテゴリが不正です')
  const config = project.config && typeof project.config === 'object' && !Array.isArray(project.config) ? project.config as Record<string, unknown> : {}
  const catalog = {
    showInCatalog: formData.get('showInCatalog') === 'on', featured: formData.get('featured') === 'on', category,
    sortOrder: Number(value('sortOrder')) || 100, isNew: formData.get('isNew') === 'on', isLimited: formData.get('isLimited') === 'on',
    showInArchive: formData.get('showInArchive') === 'on', adminOnly: formData.get('adminOnly') === 'on',
    startsAt: value('startsAt'), endsAt: value('endsAt'), shortDescription: value('shortDescription'), thumbnailUrl: value('thumbnailUrl'),
  }
  const { error } = await admin.from('maker_projects').update({ config: { ...config, catalog }, updated_at: new Date().toISOString() }).eq('slug', slug)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/makers/select'); revalidatePath('/makers')
}
