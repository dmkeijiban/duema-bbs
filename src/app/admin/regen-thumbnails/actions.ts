'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { verifyAdminCookie } from '@/lib/admin-auth'

const ADMIN_COOKIE = 'admin_auth'

async function requireAdmin() {
  const cookieStore = await cookies()
  if (!verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)) {
    throw new Error('Unauthorized')
  }
}

// スレッド画像を高解像度版にアップグレード
// - image_urlがposts/またはthreads/パスなら既に高解像度→スキップ
// - それ以外（旧thumbnail）は、そのスレッドの返信画像(1200px)に差し替える
// - 返信画像がなければスキップ（元画像なしのため改善不可）
export async function upgradeThreadImages(): Promise<{ upgraded: number; skipped: number; noPostImage: number }> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: threads } = await supabase
    .from('threads')
    .select('id, image_url')

  if (!threads || threads.length === 0) return { upgraded: 0, skipped: 0, noPostImage: 0 }

  let upgraded = 0
  let skipped = 0
  let noPostImage = 0

  for (const thread of threads) {
    const url = thread.image_url ?? ''

    // 既に高解像度パス（posts/ または threads/）なら不要
    if (url.includes('/posts/') || url.includes('/threads/')) {
      skipped++
      continue
    }

    // 旧サムネ または 画像なし → スレッドの返信から高解像度画像を探す
    const { data: postWithImage } = await supabase
      .from('posts')
      .select('image_url')
      .eq('thread_id', thread.id)
      .not('image_url', 'is', null)
      .order('post_number', { ascending: true })
      .limit(1)
      .single()

    if (!postWithImage?.image_url) {
      noPostImage++
      continue
    }

    // スレッドのimage_urlを返信の高解像度画像に差し替え
    await supabase
      .from('threads')
      .update({ image_url: postWithImage.image_url })
      .eq('id', thread.id)

    upgraded++
  }

  return { upgraded, skipped, noPostImage }
}
