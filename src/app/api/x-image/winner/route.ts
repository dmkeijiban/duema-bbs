// X投稿用 優勝カード画像生成 API
// GET /api/x-image/winner?winner=名前&deck=デッキ名&tournament=大会名&date=2024-01-01
import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export const runtime = 'nodejs'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 長いテキストを折り返す（簡易） */
function wrapText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const lines: string[] = []
  let cur = ''
  for (const ch of text) {
    cur += ch
    if (cur.length >= maxLen) {
      lines.push(cur)
      cur = ''
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function buildSvg(
  winner: string,
  deck: string,
  tournament: string,
  date: string,
): string {
  const W = 1200
  const H = 630

  const deckLines = wrapText(deck, 18)
  const deckSvgLines = deckLines
    .map(
      (line, i) =>
        `<text x="600" y="${390 + i * 56}" font-family="sans-serif" font-size="48" font-weight="bold" fill="#f0c040" text-anchor="middle" dominant-baseline="middle">${escapeXml(line)}</text>`,
    )
    .join('\n')

  const tournamentLines = wrapText(tournament, 30)
  const tournamentSvgLines = tournamentLines
    .map(
      (line, i) =>
        `<text x="600" y="${160 + i * 32}" font-family="sans-serif" font-size="26" fill="#cccccc" text-anchor="middle" dominant-baseline="middle">${escapeXml(line)}</text>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#16213e;stop-opacity:1"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#f0c040;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#e07b00;stop-opacity:1"/>
    </linearGradient>
  </defs>

  <!-- 背景 -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- アクセントライン -->
  <rect x="0" y="0" width="${W}" height="8" fill="url(#accent)"/>
  <rect x="0" y="${H - 8}" width="${W}" height="8" fill="url(#accent)"/>

  <!-- トロフィーアイコン（テキスト代替） -->
  <text x="600" y="260" font-family="sans-serif" font-size="80" text-anchor="middle" dominant-baseline="middle">🏆</text>

  <!-- 優勝者名 -->
  <text x="600" y="320" font-family="sans-serif" font-size="32" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${escapeXml(winner)} 選手</text>

  <!-- デッキ名 -->
  ${deckSvgLines}

  <!-- 区切り線 -->
  <line x1="200" y1="${390 + deckLines.length * 56 + 20}" x2="1000" y2="${390 + deckLines.length * 56 + 20}" stroke="#f0c040" stroke-width="1" stroke-opacity="0.4"/>

  <!-- 大会名 -->
  ${tournamentSvgLines}

  <!-- 日付 -->
  <text x="600" y="${200 + tournamentLines.length * 32}" font-family="sans-serif" font-size="22" fill="#999999" text-anchor="middle" dominant-baseline="middle">${escapeXml(date)}</text>

  <!-- フッター -->
  <text x="600" y="${H - 30}" font-family="sans-serif" font-size="18" fill="#666666" text-anchor="middle" dominant-baseline="middle">デュエマ掲示板</text>
</svg>`
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const winner = sp.get('winner') ?? '優勝者'
  const deck = sp.get('deck') ?? 'デッキ名'
  const tournament = sp.get('tournament') ?? '大会名'
  const date = sp.get('date') ?? new Date().toLocaleDateString('ja-JP')

  const svg = buildSvg(winner, deck, tournament, date)

  try {
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
