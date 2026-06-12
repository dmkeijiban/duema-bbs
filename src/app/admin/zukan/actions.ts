'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

type ZukanAdminType = 'pack_review' | 'card_review' | 'rating'

const TABLE_BY_TYPE: Record<ZukanAdminType, string> = {
  pack_review: 'zukan_pack_reviews',
  card_review: 'zukan_card_reviews',
  rating: 'zukan_card_ratings',
}

async function requireAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_auth')?.value
  if (!verifyAdminCookie(token)) {
    throw new Error('Unauthorized')
  }
}

export async function toggleZukanHidden(formData: FormData) {
  await requireAdmin()

  const type = String(formData.get('type') || '') as ZukanAdminType
  const id = String(formData.get('id') || '')
  const hidden = String(formData.get('hidden') || '') === 'true'
  const table = TABLE_BY_TYPE[type]

  if (!table || !id) {
    throw new Error('Invalid zukan admin action')
  }

  const supabase = createAdminClient()
  await supabase
    .from(table)
    .update({ is_hidden: hidden })
    .eq('id', id)

  revalidatePath('/admin/zukan')
  revalidatePath('/zukan/dm-01')
}
