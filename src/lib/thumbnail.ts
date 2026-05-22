import { SupabaseClient } from '@supabase/supabase-js'

export const DEFAULT_THREAD_THUMBNAIL = '/default-thread-thumbnail.svg'

/**
 * Supabase Storage の object URL を Image Transformation（render）URL に変換する。
 * width=128&height=128 にリサイズして配信することで Cached Egress を大幅削減。
 *
 * Pro プランでのみ有効。Free プランでは render エンドポイントがエラーを返すが、
 * SafeThumbnail コンポーネントの onError でSVGに自動フォールバックするため問題なし。
 */
function toRenderUrl(storageUrl: string): string {
  return (
    storageUrl.replace(
      '/storage/v1/object/public/',
      '/storage/v1/render/image/public/'
    ) + '?width=128&height=128&resize=cover&quality=75'
  )
}

/**
 * スレに thumbnail preset 画像（image_url）がある場合はそれを使い、
 * ない場合はレス（post）の最初の画像を Image Transformation で縮小して使う。
 *
 * post 画像は 1600×2000px WebP だが、render URL 経由で 128×128px に
 * リサイズ配信することで Egress を約 1/300 に削減できる。
 * （SafeThumbnail が onError 時に SVG へフォールバックするため、
 *   Free プランへのダウングレード後も自動で安全に動作する）
 */
export async function withFallbackThumbnails<T extends { id: number; image_url: string | null }>(
  supabase: SupabaseClient,
  threads: T[]
): Promise<T[]> {
  const noImageIds = threads.filter(t => !t.image_url).map(t => t.id)
  if (noImageIds.length === 0) return threads

  const { data: postImages } = await supabase
    .from('posts')
    .select('thread_id, image_url')
    .in('thread_id', noImageIds)
    .not('image_url', 'is', null)
    .order('post_number', { ascending: true })

  if (!postImages || postImages.length === 0) return threads

  // thread_id → 最初の post 画像 URL（render URL 変換済み）
  const imageMap = new Map<number, string>()
  for (const p of postImages) {
    if (!imageMap.has(p.thread_id) && p.image_url) {
      imageMap.set(p.thread_id, toRenderUrl(p.image_url))
    }
  }

  return threads.map(t =>
    t.image_url || !imageMap.has(t.id)
      ? t
      : { ...t, image_url: imageMap.get(t.id)! }
  )
}
