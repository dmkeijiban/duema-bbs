// X投稿用 シルエットクイズ画像生成 API
// GET /api/x-image/silhouette?no=1&hint=ヒント
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

function buildSvg(quizNo: string, hint: string): string {
  const W = 1200
  const H = 630

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d1b2a;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#1b263b;stop-opacity:1"/>
    </linearGradient>
    <radialGradient id="spotlight" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#415a77;stop-opacity:0.3"/>
      <stop offset="100%" style="stop-color:#0d1b2a;stop-opacity:0"/>
    </radialGradient>
  </defs>

  <!-- 背景 -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#spotlight)"/>

  <!-- タイトル -->
  <text x="600" y="80" font-family="sans-serif" font-size="28" fill="#778da9" text-anchor="middle" dominant-baseline="middle">第${escapeXml(quizNo)}回</text>
  <text x="600" y="130" font-family="sans-serif" font-size="40" font-weight="bold" fill="#e0e1dd" text-anchor="middle" dominant-baseline="middle">シルエットクイズ</text>

  <!-- クエスチョンマーク（シルエット代替） -->
  <rect x="400" y="180" width="400" height="300" rx="12" fill="#1b263b" stroke="#415a77" stroke-width="2"/>
  <text x="600" y="340" font-family="sans-serif" font-size="160" fill="#415a77" text-anchor="middle" dominant-baseline="middle">?</text>

  <!-- ヒント -->
  ${
    hint
      ? `<text x="600" y="530" font-family="sans-serif" font-size="24" fill="#778da9" text-anchor="middle" dominant-baseline="middle">💡 ヒント：${escapeXml(hint)}</text>`
      : `<text x="600" y="530" font-family="sans-serif" font-size="24" fill="#415a77" text-anchor="middle" dominant-baseline="middle">このデッキは何でしょう？</text>`
  }

  <!-- フッター -->
  <text x="600" y="${H - 24}" font-family="sans-serif" font-size="18" fill="#415a77" text-anchor="middle" dominant-baseline="middle">デュエマ掲示板 #デュエマクイズ</text>
</svg>`
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const quizNo = sp.get('no') ?? '1'
  const hint = sp.get('hint') ?? ''

  const svg = buildSvg(quizNo, hint)

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
