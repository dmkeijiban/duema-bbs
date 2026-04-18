import { optimizeThumbnail, optimizePostImage, optimizeBannerImage } from './image-optimize'
import type { SupabaseClient } from '@supabase/supabase-js'

export type UploadPreset = 'thumbnail' | 'post' | 'banner'

export interface UploadResult {
  url: string
  width: number
  height: number
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024

export function validateImageFile(file: File): string | null {
  if (!file || file.size === 0) return '画像が選択されていません'
  if (file.size > MAX_BYTES) return '画像は10MB以下にしてください'
  if (!ALLOWED_TYPES.includes(file.type)) return 'JPEG・PNG・GIF・WebP形式のみ対応しています'
  return null
}

export async function uploadImage(
  file: File,
  supabase: SupabaseClient,
  storagePath: string,
  preset: UploadPreset
): Promise<{ data?: UploadResult; error?: string }> {
  const validationError = validateImageFile(file)
  if (validationError) return { error: validationError }

  const optimizeFn =
    preset === 'thumbnail' ? optimizeThumbnail
    : preset === 'post' ? optimizePostImage
    : optimizeBannerImage

  const optimized = await optimizeFn(file)
  const fileName = `${storagePath}.${optimized.ext}`

  const { data, error } = await supabase.storage
    .from('bbs-images')
    .upload(fileName, optimized.buffer, { contentType: optimized.contentType })

  if (error) return { error: '画像のアップロードに失敗しました' }

  const { data: urlData } = supabase.storage.from('bbs-images').getPublicUrl(data.path)
  return { data: { url: urlData.publicUrl, width: optimized.width, height: optimized.height } }
}
