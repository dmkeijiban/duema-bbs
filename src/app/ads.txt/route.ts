import { readFile } from 'fs/promises'
import path from 'path'

// public/ads.txt の静的配信で改行が失われる事象が報告されたため、
// route handlerで明示的にプレーンテキストとして返す。
// データ本体は public/ に置くと "conflicting public file and page file" で
// このrouteと衝突するため src/data/ads.txt に置いている。
export const dynamic = 'force-static'
export const revalidate = false

export async function GET() {
  const filePath = path.join(process.cwd(), 'src', 'data', 'ads.txt')
  const text = await readFile(filePath, 'utf-8')
  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
