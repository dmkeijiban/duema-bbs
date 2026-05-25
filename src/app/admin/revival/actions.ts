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

/**
 * スレッドを保護フラグで守る（is_protected=true）
 * → リバイバル候補・自動アーカイブ候補から永続的に除外される
 *
 * ⚠️ 物理削除禁止ルール:
 *   この actions.ts に .from('posts').delete() / .from('threads').delete() は書かない。
 *   削除 = is_deleted=true、非表示 = is_archived=true。
 */
export async function protectThread(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const id = parseInt(formData.get('id') as string)

  await supabase
    .from('threads')
    .update({ is_protected: true })
    .eq('id', id)

  revalidatePath('/admin/revival')
  redirect('/admin/revival')
}

/**
 * 保護を解除する（is_protected=false に戻す）
 */
export async function unprotectThread(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const id = parseInt(formData.get('id') as string)

  await supabase
    .from('threads')
    .update({ is_protected: false })
    .eq('id', id)

  revalidatePath('/admin/revival')
  redirect('/admin/revival')
}

/**
 * スレをアーカイブ（非表示）にする
 * リバイバルせずに静かに退場させる場合に使用
 * ソフトアーカイブのみ。物理削除禁止。
 */
export async function archiveWithoutRevival(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const id = parseInt(formData.get('id') as string)

  await supabase
    .from('threads')
    .update({ is_archived: true })
    .eq('id', id)

  revalidatePath('/')
  revalidateTag('threads', { expire: 0 })
  redirect('/admin/revival')
}
