import { SupabaseClient } from '@supabase/supabase-js'

export const DEFAULT_THREAD_THUMBNAIL = '/default-thumbnail.jpg'

/**
 * スレに画像がない場合は、最初の画像付きレスを一覧用fallback画像にする。
 * posts.thumbnail_url がある場合はそれを一覧用サムネとして使い、詳細用の
 * image_url は従来通り元画像URLのまま保持する。
 */
export async function withFallbackThumbnails<T extends { id: number; image_url: string | null; thumbnail_url?: string | null }>(
  supabase: SupabaseClient,
  threads: T[]
): Promise<T[]> {
  const noImageIds = threads.filter(t => !t.image_url).map(t => t.id)
  if (noImageIds.length === 0) return threads

  const { data: postImages } = await supabase
    .from('posts')
    .select('thread_id, image_url, thumbnail_url')
    .in('thread_id', noImageIds)
    .not('image_url', 'is', null)
    .order('post_number', { ascending: true })

  if (!postImages || postImages.length === 0) return threads

  const imageMap = new Map<number, { imageUrl: string; thumbnailUrl: string | null }>()
  for (const p of postImages) {
    if (!imageMap.has(p.thread_id) && p.image_url) {
      imageMap.set(p.thread_id, {
        imageUrl: p.image_url,
        thumbnailUrl: p.thumbnail_url ?? null,
      })
    }
  }

  return threads.map(t => {
    if (t.image_url || !imageMap.has(t.id)) return t
    const fallback = imageMap.get(t.id)!
    return {
      ...t,
      image_url: fallback.imageUrl,
      thumbnail_url: fallback.thumbnailUrl,
    }
  })
}
