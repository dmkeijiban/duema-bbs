import { optimizeThumbnail, optimizePostImage, optimizeBannerImage, optimizeListThumbnail } from './image-optimize'
import type { SupabaseClient } from '@supabase/supabase-js'

export type UploadPreset = 'thumbnail' | 'post' | 'banner'

export interface UploadResult {
  url: string
  thumbnailUrl: string | null
  width: number
  height: number
}

interface UploadOptions {
  createListThumbnail?: boolean
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024
const STORAGE_CACHE_SECONDS = '31536000'

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
  preset: UploadPreset,
  options: UploadOptions = {}
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
    .upload(fileName, optimized.buffer, {
      contentType: optimized.contentType,
      cacheControl: STORAGE_CACHE_SECONDS,
    })

  if (error) return { error: '画像のアップロードに失敗しました' }

  const { data: urlData } = supabase.storage.from('bbs-images').getPublicUrl(data.path)
  let thumbnailUrl: string | null = null

  if (options.createListThumbnail) {
    try {
      const thumbnail = await optimizeListThumbnail(file)
      const thumbnailFileName = `thumbnails/${storagePath}.${thumbnail.ext}`
      const { data: thumbnailData, error: thumbnailError } = await supabase.storage
        .from('bbs-images')
        .upload(thumbnailFileName, thumbnail.buffer, {
          contentType: thumbnail.contentType,
          cacheControl: STORAGE_CACHE_SECONDS,
        })

      if (!thumbnailError) {
        const { data: thumbnailUrlData } = supabase.storage.from('bbs-images').getPublicUrl(thumbnailData.path)
        thumbnailUrl = thumbnailUrlData.publicUrl
      }
    } catch (error) {
      console.warn('list thumbnail generation failed:', error)
    }
  }

  return { data: { url: urlData.publicUrl, thumbnailUrl, width: optimized.width, height: optimized.height } }
}
