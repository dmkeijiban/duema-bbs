export const COMMENT_IMPORT_LIMIT = 30

export function extractAnimanchBoardId(input: string): number | null {
  const value = input.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    if (!url.hostname.includes('animanch.com')) return null
    const match = url.pathname.match(/\/board\/(\d+)/)
    return match ? parseInt(match[1], 10) : null
  } catch {
    const match = value.match(/\/board\/(\d+)/)
    return match ? parseInt(match[1], 10) : null
  }
}

export function extractYouTubeVideoId(input: string): string | null {
  const value = input.trim()
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.hostname.includes('youtu.be')) {
      return url.pathname.split('/').filter(Boolean)[0] ?? null
    }
    if (url.pathname.startsWith('/shorts/')) {
      return url.pathname.split('/').filter(Boolean)[1] ?? null
    }
    if (url.pathname.startsWith('/embed/')) {
      return url.pathname.split('/').filter(Boolean)[1] ?? null
    }
    return url.searchParams.get('v')
  } catch {
    const directId = value.match(/^[a-zA-Z0-9_-]{11}$/)?.[0]
    return directId ?? null
  }
}

export function parsePastedComments(input: string, limit = COMMENT_IMPORT_LIMIT): string[] {
  const normalized = input.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return []

  const blankSeparated = normalized
    .split(/\n{2,}/)
    .map(comment => comment.trim())
    .filter(Boolean)

  const lineSeparated = normalized
    .split('\n')
    .map(comment => comment.trim())
    .filter(Boolean)

  const comments = blankSeparated.length > 1 ? blankSeparated : lineSeparated
  return comments
    .map(comment => comment.slice(0, 3000))
    .filter(Boolean)
    .slice(0, limit)
}
