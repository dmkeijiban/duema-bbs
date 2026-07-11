export const BULK_THREAD_COMMENT_LIMIT = 50
export const BULK_THREAD_TITLE_MAX = 100
export const BULK_THREAD_BODY_MAX = 5000
export const BULK_THREAD_COMMENT_MAX = 5000

export type ParsedBulkThread = { title: string; body: string; comments: string[] }

const heading = (value: string, name: string) =>
  new RegExp(`^\\s*${name}(?:\\s*[：:]\\s*)?$`).test(value)

const numberLine = /^(?:\d{1,2}\s*[.：:]?|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*$/

export function parseBulkThreadDraft(raw: string): ParsedBulkThread | null {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  const titleIndex = lines.findIndex(line => heading(line, 'タイトル'))
  const bodyIndex = lines.findIndex((line, index) => index > titleIndex && heading(line, '本文'))
  const commentsIndex = lines.findIndex((line, index) => index > bodyIndex && heading(line, 'コメント'))
  if (titleIndex < 0 || bodyIndex < 0 || commentsIndex < 0) return null

  const clean = (part: string[]) => part.join('\n').trim()
  const title = clean(lines.slice(titleIndex + 1, bodyIndex))
  const body = clean(lines.slice(bodyIndex + 1, commentsIndex))
  const comments: string[] = []
  let current: string[] = []
  for (const line of lines.slice(commentsIndex + 1)) {
    if (numberLine.test(line)) {
      const value = clean(current)
      if (value) comments.push(value)
      current = []
    } else current.push(line)
  }
  const value = clean(current)
  if (value) comments.push(value)
  return { title, body, comments: comments.slice(0, BULK_THREAD_COMMENT_LIMIT) }
}
