'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase-server'

const ADMIN_COOKIE = 'admin_auth'

async function checkAdmin() {
  const cookieStore = await cookies()
  const val = cookieStore.get(ADMIN_COOKIE)?.value
  if (val !== process.env.ADMIN_PASSWORD) {
    throw new Error('Unauthorized')
  }
}

export async function adminLogin(formData: FormData) {
  const pw = formData.get('password') as string
  if (pw && pw === process.env.ADMIN_PASSWORD) {
    const cookieStore = await cookies()
    cookieStore.set(ADMIN_COOKIE, pw, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7日間
    })
    redirect('/admin')
  }
  redirect('/admin?error=パスワードが違います')
}

export async function adminDeleteThread(formData: FormData) {
  await checkAdmin()
  const threadId = parseInt(formData.get('threadId') as string)
  const supabase = await createClient()

  // 関連する posts を先に削除（外部キー制約）
  await supabase.from('posts').delete().eq('thread_id', threadId)
  await supabase.from('favorites').delete().eq('thread_id', threadId)
  await supabase.from('threads').delete().eq('id', threadId)

  revalidatePath('/')
  revalidatePath('/admin')
  redirect('/admin')
}

export async function adminDeletePost(formData: FormData) {
  await checkAdmin()
  const postId = parseInt(formData.get('postId') as string)
  const threadId = parseInt(formData.get('threadId') as string)
  const supabase = await createClient()

  await supabase.from('posts').delete().eq('id', postId)
  // コメント数を再計算
  await supabase.rpc('recalculate_post_count', { p_thread_id: threadId })

  revalidatePath(`/thread/${threadId}`)
  revalidatePath('/admin')
  redirect(`/admin?thread=${threadId}`)
}
