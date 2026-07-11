export const BULK_THREAD_COMMENT_LIMIT = 50
export const BULK_THREAD_TITLE_MAX = 100
export const BULK_THREAD_BODY_MAX = 5000
export const BULK_THREAD_COMMENT_MAX = 5000

export type ParsedBulkThread = { title: string; body: string; comments: string[] }

const heading = (value: string, name: string) =>
  new RegExp(`^\\s*${name}(?:\\s*[：:]\\s*)?$`).test(value)

const numberLine = /^(?:\d{1,2}\s*[.：:]?|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*$/
const rawPostHeader = /^\s*(\d{1,3})\S.*?\d{2}\/\d{2}\/\d{2}\([^\n)]*\)\s+\d{1,2}:\d{2}:\d{2}.*報告\s*$/
const backlinkOnly = /^\s*(?:>>\d+\s*)+$/

function parseRawBoardLog(raw: string): ParsedBulkThread | null {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  const headers = lines
    .map((line, index) => ({ index, match: line.match(rawPostHeader) }))
    .filter((entry): entry is { index: number; match: RegExpMatchArray } => !!entry.match)
  if (!headers.length || headers[0].match[1] !== '1') return null

  const title = lines.slice(0, headers[0].index).join('\n').trim()
  if (!title) return null
  const posts = headers.map((header, index) => {
    const end = headers[index + 1]?.index ?? lines.length
    const bodyLines = lines.slice(header.index + 1, end)
    while (bodyLines.length && !bodyLines[bodyLines.length - 1].trim()) bodyLines.pop()
    while (bodyLines.length && backlinkOnly.test(bodyLines[bodyLines.length - 1])) bodyLines.pop()
    return bodyLines.join('\n').trim()
  })
  if (!posts[0]) return null
  return { title, body: posts[0], comments: posts.slice(1).filter(Boolean).slice(0, BULK_THREAD_COMMENT_LIMIT) }
}

export function parseBulkThreadDraft(raw: string): ParsedBulkThread | null {
  const rawLog = parseRawBoardLog(raw)
  if (rawLog) return rawLog

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
