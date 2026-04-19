'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { optimizeThumbnail } from '@/lib/image-optimize'

const ADMIN_COOKIE = 'admin_auth'

async function requireAdmin() {
  const cookieStore = await cookies()
  if (cookieStore.get(ADMIN_COOKIE)?.value !== process.env.ADMIN_PASSWORD) {
    throw new Error('Unauthorized')
  }
}

export async function regenThumbnails(): Promise<{ updated: number; skipped: number; errors: number }> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: threads } = await supabase
    .from('threads')
    .select('id, image_url')
    .not('image_url', 'is', null)

  if (!threads || threads.length === 0) return { updated: 0, skipped: 0, errors: 0 }

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const thread of threads) {
    if (!thread.image_url) { skipped++; continue }

    // ポスト画像（posts/パス）はサイズ十分なのでスキップ
    if (thread.image_url.includes('/posts/')) { skipped++; continue }

    try {
      const res = await fetch(thread.image_url)
      if (!res.ok) { errors++; continue }

      const blob = await res.blob()
      const file = new File([blob], 'image.webp', { type: blob.type || 'image/webp' })
      const optimized = await optimizeThumbnail(file)

      // 400px未満はスキップ（既に十分なサイズ or 元画像が小さすぎ）
      if (optimized.width < 300 && optimized.height < 300) { skipped++; continue }

      // パスを元URLから抽出
      const urlObj = new URL(thread.image_url)
      const pathParts = urlObj.pathname.split('/object/public/bbs-images/')
      if (pathParts.length < 2) { skipped++; continue }
      const storagePath = pathParts[1]

      const { error: upErr } = await supabase.storage
        .from('bbs-images')
        .update(storagePath, optimized.buffer, { contentType: optimized.contentType, upsert: true })

      if (upErr) { errors++; continue }
      updated++
    } catch {
      errors++
    }
  }

  return { updated, skipped, errors }
}
