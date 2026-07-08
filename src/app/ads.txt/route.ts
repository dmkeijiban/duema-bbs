import { readFile } from 'fs/promises'
import path from 'path'

// public/ads.txt の静的配信で改行が失われる事象が報告されたため、
// route handlerで明示的にプレーンテキストとして返す。
// データ本体は public/ に置くと "conflicting public file and page file" で
// このrouteと衝突するため src/data/ads.txt に置いている。
export const dynamic = 'force-dynamic'

// レコードの先頭になりうるトークン（#コメント、または "ドメイン," 形式）の直前で
// 必ず改行する。配信経路のどこかで改行がスペースに潰されて連結されても、
// ads.txtとして1レコード1行になるようにするための保険。
const RECORD_START = /(?<=\S)[ \t]+(?=#|[A-Za-z0-9][A-Za-z0-9.-]*[ \t]*,[ \t]*[^,\n]+[ \t]*,[ \t]*(?:DIRECT|RESELLER)\b)/g

function normalizeAdsTxt(raw: string): string {
  const unifiedNewlines = raw.replace(/\r\n?/g, '\n')
  const withForcedBreaks = unifiedNewlines
    .split('\n')
    .map(line => line.replace(RECORD_START, '\n'))
    .join('\n')
  return withForcedBreaks
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n'
}

export async function GET() {
  const filePath = path.join(process.cwd(), 'src', 'data', 'ads.txt')
  const raw = await readFile(filePath, 'utf-8')
  const text = normalizeAdsTxt(raw)
  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
