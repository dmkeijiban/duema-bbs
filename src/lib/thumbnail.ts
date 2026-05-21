import { SupabaseClient } from '@supabase/supabase-js'

export const DEFAULT_THREAD_THUMBNAIL = '/default-thread-thumbnail.svg'

/**
 * スレに thumbnail preset 画像（image_url）がある場合のみそれを使う。
 * ない場合はデフォルトサムネ（SVG）にフォールバックする。
 *
 * ⚠️ 以前はレス（post）の画像をフォールバックに使っていたが、
 * post は最大 1600×2000px の大サイズ WebP で保存されており、
 * 52px/80px サムネとして使うと Supabase Storage の Cached Egress を
 * 大量消費する原因になるため廃止した。
 * （post 画像は thread ページ内 ImageViewer で直接表示する用途のみ）
 */
export async function withFallbackThumbnails<T extends { id: number; image_url: string | null }>(
  _supabase: SupabaseClient,
  threads: T[]
): Promise<T[]> {
  // image_url がないスレは null のまま返す。
  // ThreadCard / RecommendSection 側で DEFAULT_THREAD_THUMBNAIL にフォールバックする。
  return threads
}
