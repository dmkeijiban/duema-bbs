const URL_KEYS = new Set([
  'url', 'src', 'href', 'media_url', 'mediaUrl', 'image_url', 'imageUrl',
  'temporary_url', 'temporaryUrl', 'download_url', 'downloadUrl', 'original',
  'large', 'medium', 'small',
])
const MEDIA_CONTAINER_KEYS = new Set([
  'media_ids', 'mediaIds', 'media', 'attachments', 'images', 'image_urls',
  'imageUrls', 'media_urls', 'mediaUrls',
])
const ID_KEYS = new Set(['id', 'media_id', 'mediaId'])

export interface TypefullyMediaExtraction {
  imageUrls: string[]
  mediaIds: string[]
  expectsMedia: boolean
  mediaPaths: string[]
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

export function extractTypefullyMedia(...roots: unknown[]): TypefullyMediaExtraction {
  const imageUrls = new Set<string>()
  const mediaIds = new Set<string>()
  const mediaPaths = new Set<string>()
  const seen = new WeakSet<object>()

  function visit(value: unknown, path: string, inMedia: boolean): void {
    if (value == null) return
    if (isHttpUrl(value)) {
      if (inMedia) imageUrls.add(value.trim())
      return
    }
    if (typeof value === 'string' || typeof value === 'number') {
      if (inMedia && /(?:media_ids?|mediaIds?)(?:\[\d+\])?$/.test(path)) {
        const id = String(value).trim()
        if (id) mediaIds.add(id)
      }
      return
    }
    if (typeof value !== 'object') return
    if (seen.has(value)) return
    seen.add(value)

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, inMedia))
      return
    }

    const entries = Object.entries(value as Record<string, unknown>)
    const objectIsMedia = inMedia || entries.some(([key]) => MEDIA_CONTAINER_KEYS.has(key))
    for (const [key, child] of entries) {
      const childPath = path ? `${path}.${key}` : key
      const childInMedia = objectIsMedia || MEDIA_CONTAINER_KEYS.has(key)
      if (MEDIA_CONTAINER_KEYS.has(key) && child != null) mediaPaths.add(childPath)
      if (childInMedia && URL_KEYS.has(key) && isHttpUrl(child)) imageUrls.add(child.trim())
      if (childInMedia && ID_KEYS.has(key) && (typeof child === 'string' || typeof child === 'number')) {
        const id = String(child).trim()
        if (id) mediaIds.add(id)
      }
      visit(child, childPath, childInMedia)
    }
  }

  roots.forEach((root, index) => visit(root, `root[${index}]`, false))
  return {
    imageUrls: [...imageUrls],
    mediaIds: [...mediaIds],
    expectsMedia: mediaPaths.size > 0 || imageUrls.size > 0 || mediaIds.size > 0,
    mediaPaths: [...mediaPaths],
  }
}

export function extensionForImageContentType(contentType: string): 'jpg' | 'png' | 'gif' | 'webp' | null {
  const normalized = contentType.split(';', 1)[0].trim().toLowerCase()
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg'
  if (normalized === 'image/png') return 'png'
  if (normalized === 'image/gif') return 'gif'
  if (normalized === 'image/webp') return 'webp'
  return null
}

export function shouldBlockThreadForMissingMedia(expectsMedia: boolean, imageUrl: string | null): boolean {
  return expectsMedia && !imageUrl
}

export function shouldBackfillThreadImage(threadImageUrl: string | null, sourceImageUrl: string | null): boolean {
  return !threadImageUrl && Boolean(sourceImageUrl)
}
