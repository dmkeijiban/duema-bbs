'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { parseSelectMakerConfig } from '@/lib/maker'

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
  revalidatePath('/admin/makers/select'); revalidatePath(`/makers/${slug}`)
}
