// X投稿用 仲間はずれクイズ画像生成 API
// GET /api/x-image/odd?no=1&a=カード名A&b=カード名B&c=カード名C&d=カード名D
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

function buildSvg(quizNo: string, choices: string[]): string {
  const W = 1200
  const H = 630
  const LABELS = ['A', 'B', 'C', 'D']

  // 最大4枚のカードを2×2グリッドに配置
  const cols = choices.length <= 2 ? choices.length : 2
  const rows = Math.ceil(choices.length / cols)

  const cardW = cols === 1 ? 500 : cols === 2 ? 480 : 340
  const cardH = rows === 1 ? 280 : 200
  const gapX = 40
  const gapY = 30

  const totalW = cols * cardW + (cols - 1) * gapX
  const startX = (W - totalW) / 2
  const startY = 180

  const cardsSvg = choices
    .slice(0, 4)
    .map((choice, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = startX + col * (cardW + gapX)
      const y = startY + row * (cardH + gapY)
      const cx = x + cardW / 2
      const cy = y + cardH / 2
      const label = LABELS[i] ?? String(i + 1)

      const textLines = wrapText(choice, 12)
      const textSvg = textLines
        .map(
          (line, li) =>
            `<text x="${cx}" y="${cy - ((textLines.length - 1) * 18) / 2 + li * 22 + 20}" font-family="sans-serif" font-size="20" fill="#e0e1dd" text-anchor="middle" dominant-baseline="middle">${escapeXml(line)}</text>`,
        )
        .join('\n')

      return `
        <rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="8" fill="#1b263b" stroke="#415a77" stroke-width="1.5"/>
        <text x="${x + 20}" y="${y + 20}" font-family="sans-serif" font-size="22" font-weight="bold" fill="#778da9" dominant-baseline="middle">${label}</text>
        ${textSvg}
      `
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d1b2a;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#1b263b;stop-opacity:1"/>
    </linearGradient>
  </defs>

  <!-- 背景 -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- タイトル -->
  <text x="600" y="60" font-family="sans-serif" font-size="28" fill="#778da9" text-anchor="middle" dominant-baseline="middle">第${escapeXml(quizNo)}回</text>
  <text x="600" y="110" font-family="sans-serif" font-size="40" font-weight="bold" fill="#e0e1dd" text-anchor="middle" dominant-baseline="middle">仲間はずれクイズ</text>
  <text x="600" y="152" font-family="sans-serif" font-size="20" fill="#778da9" text-anchor="middle" dominant-baseline="middle">1枚だけ仲間はずれがいます。どれ？🤔</text>

  <!-- カード -->
  ${cardsSvg}

  <!-- フッター -->
  <text x="600" y="${H - 24}" font-family="sans-serif" font-size="18" fill="#415a77" text-anchor="middle" dominant-baseline="middle">デュエマ掲示板 #デュエマクイズ</text>
</svg>`
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const quizNo = sp.get('no') ?? '1'
  const choices = ['a', 'b', 'c', 'd']
    .map((k) => sp.get(k))
    .filter((v): v is string => v !== null && v !== '')

  if (choices.length < 2) {
    return NextResponse.json(
      { error: 'a, b パラメータ（最低2つ）が必要です' },
      { status: 400 },
    )
  }

  const svg = buildSvg(quizNo, choices)

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
