import sharp from 'sharp'

export interface OptimizedImage {
  buffer: Buffer
  contentType: 'image/webp' | 'image/gif'
  ext: 'webp' | 'gif'
  width: number
  height: number
  byteSize: number
}

export async function optimizeImage(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<OptimizedImage> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 82 } = options
  const inputBuffer = Buffer.from(await file.arrayBuffer())

  // Keep GIFs as-is so animated images do not lose animation.
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
    .rotate()
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

export async function optimizeThumbnail(file: File): Promise<OptimizedImage> {
  const inputBuffer = Buffer.from(await file.arrayBuffer())

  if (file.type === 'image/gif') {
    return { buffer: inputBuffer, contentType: 'image/gif', ext: 'gif', width: 0, height: 0, byteSize: inputBuffer.length }
  }

  const { data, info } = await sharp(inputBuffer)
    .rotate()
    .resize(640, 640, { fit: 'inside', withoutEnlargement: false })
    .webp({ quality: 88 })
    .toBuffer({ resolveWithObject: true })

  return { buffer: data, contentType: 'image/webp', ext: 'webp', width: info.width, height: info.height, byteSize: info.size }
}

export async function optimizePostImage(file: File): Promise<OptimizedImage> {
  return optimizeImage(file, { maxWidth: 1600, maxHeight: 2000, quality: 84 })
}

export async function optimizeBannerImage(file: File): Promise<OptimizedImage> {
  return optimizeImage(file, { maxWidth: 1600, maxHeight: 600, quality: 86 })
}
