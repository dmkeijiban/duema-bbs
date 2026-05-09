'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { verifyAdminCookie } from '@/lib/admin-auth'

const ADMIN_COOKIE = 'admin_auth'

async function requireAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    redirect('/admin')
  }
}

export async function archiveThread(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const id = parseInt(formData.get('id') as string)
  await supabase.from('threads').update({ is_archived: true }).eq('id', id)
  revalidatePath('/')
  revalidateTag('threads', { expire: 0 })
  redirect('/admin/cleanup')
}

export async function deleteThread(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const id = parseInt(formData.get('id') as string)
  // レスも連鎖削除（外部キー制約がない場合は手動削除）
  await supabase.from('posts').delete().eq('thread_id', id)
  await supabase.from('threads').delete().eq('id', id)
  revalidatePath('/')
  revalidateTag('threads', { expire: 0 })
  redirect('/admin/cleanup')
}

export async function batchArchiveStale(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const ids = (formData.get('ids') as string).split(',').map(Number).filter(Boolean)
  if (ids.length === 0) redirect('/admin/cleanup')
  await supabase.from('threads').update({ is_archived: true }).in('id', ids)
  revalidatePath('/')
  revalidateTag('threads', { expire: 0 })
  redirect('/admin/cleanup')
}
