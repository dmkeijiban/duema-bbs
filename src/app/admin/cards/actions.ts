'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

async function authorize() { if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) throw new Error('Unauthorized') }
export async function updateCard(formData: FormData) {
  await authorize()
  const id = String(formData.get('id') ?? ''), name = String(formData.get('name') ?? '').trim()
  if (!id || !name) throw new Error('id/name is required')
  const costRaw = String(formData.get('cost') ?? '').trim()
  const payload = { name, image_url: String(formData.get('image_url') ?? '').trim() || null, civilization: String(formData.get('civilization') ?? '').split(/[\/,]/).map(v => v.trim()).filter(Boolean), cost: costRaw ? Number(costRaw) : null, card_type: String(formData.get('card_type') ?? '').trim() || null, regulation: String(formData.get('regulation') ?? 'none').trim() || 'none', updated_at: new Date().toISOString() }
  const { error } = await createAdminClient().from('cards').update(payload).eq('id', id)
  if (error) throw error
  revalidatePath('/admin/cards'); revalidatePath('/admin/hall-of-fame-predictions')
}
export async function toggleCard(formData: FormData) {
  await authorize()
  const { error } = await createAdminClient().from('cards').update({ is_active: formData.get('active') !== 'true', updated_at: new Date().toISOString() }).eq('id', String(formData.get('id') ?? ''))
  if (error) throw error
  revalidatePath('/admin/cards'); revalidatePath('/admin/hall-of-fame-predictions')
}
