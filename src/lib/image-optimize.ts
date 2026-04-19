import sharp from 'sharp'

export interface OptimizedImage {
  buffer: Buffer
  contentType: 'image/webp' | 'image/gif'
  ext: 'webp' | 'gif'
  width: number
  height: number
  byteSize: number
}

// GIFはアニメーション保持のためそのまま返す
export async function optimizeImage(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<OptimizedImage> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 82 } = options
  const inputBuffer = Buffer.from(await file.arrayBuffer())

  if (file.type === 'image/gif') {
    return {
      buffer: inputBuffer,
      contentType: 'image/gif',
      ext: 'gif',
      width: 0,
      height: 0,
      byteSize: inputBuffer.length,
    }
  }

  const { data, info } = await sharp(inputBuffer)
    .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true })

  return {
    buffer: data,
    contentType: 'image/webp',
    ext: 'webp',
    width: info.width,
    height: info.height,
    byteSize: info.size,
  }
}

// サムネイル用（スレッド一覧カード: 80x80px表示）
// fit:inside でアスペクト比を保持。スレッド詳細でも同じ URL を使うため比率を維持する。
// withoutEnlargement:false により小さい画像も最大400pxまで引き上げ、Retina(3x=240px)に対応。
export async function optimizeThumbnail(file: File): Promise<OptimizedImage> {
  const inputBuffer = Buffer.from(await file.arrayBuffer())

  if (file.type === 'image/gif') {
    return { buffer: inputBuffer, contentType: 'image/gif', ext: 'gif', width: 0, height: 0, byteSize: inputBuffer.length }
  }

  const { data, info } = await sharp(inputBuffer)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: false })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true })

  return { buffer: data, contentType: 'image/webp', ext: 'webp', width: info.width, height: info.height, byteSize: info.size }
}

// レス画像用（インライン表示: 最大横幅いっぱい）
export async function optimizePostImage(file: File): Promise<OptimizedImage> {
  return optimizeImage(file, { maxWidth: 1200, maxHeight: 1600, quality: 83 })
}

// バナー用（NoticeBlock: 横長）
export async function optimizeBannerImage(file: File): Promise<OptimizedImage> {
  return optimizeImage(file, { maxWidth: 1200, maxHeight: 400, quality: 85 })
}
