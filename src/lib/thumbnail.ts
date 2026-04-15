import { SupabaseClient } from '@supabase/supabase-js'

/**
 * スレに画像がない場合、最初に画像付きのレスの画像をサムネとして使う
 */
export async function withFallbackThumbnails<T extends { id: number; image_url: string | null }>(
  supabase: SupabaseClient,
  threads: T[]
): Promise<T[]> {
  const noImageIds = threads.filter(t => !t.image_url).map(t => t.id)
  if (noImageIds.length === 0) return threads

  const { data: postImages } = await supabase
    .from('posts')
    .select('thread_id, image_url, post_number')
    .in('thread_id', noImageIds)
    .not('image_url', 'is', null)
    .order('post_number', { ascending: true })

  const firstPostImage: Record<number, string> = {}
  if (postImages) {
    for (const p of postImages) {
      if (!firstPostImage[p.thread_id] && p.image_url) {
        firstPostImage[p.thread_id] = p.image_url
      }
    }
  }

  return threads.map(t => ({
    ...t,
    image_url: t.image_url ?? firstPostImage[t.id] ?? null,
  }))
}
