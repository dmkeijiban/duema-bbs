// デュエマ履歴書メーカーのPNG出力（A4縦・高解像度）。既存の maker-select-export.ts と同じく
// Canvasで1箇所描画し、DOMプレビューとは独立して壊れないことを優先する。

import {
  RESUME_ACHIEVEMENT_PRESETS,
  RESUME_SOCIAL_TAG_PRESETS,
  type ResumeData,
} from '@/lib/maker-resume'

export type ResumeExportPhoto = { kind: 'avatar' | 'card'; url: string | null; caption: string | null }

const CANVAS_WIDTH = 1240
const CANVAS_HEIGHT = 1754
const MARGIN = 64
const INK = '#1f2933'
const SUB_INK = '#52606d'
const LINE = '#334155'
const PAPER = '#fdfdfb'

function loadImage(url: string, crossOrigin: 'anonymous' | null): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image()
    if (crossOrigin) image.crossOrigin = crossOrigin
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const lines: string[] = []
  let current = ''
  for (const char of text.replace(/\r/g, '')) {
    if (char === '\n') {
      lines.push(current)
      current = ''
      if (lines.length >= maxLines) return lines
      continue
    }
    const next = current + char
    if (context.measureText(next).width > maxWidth && current) {
      lines.push(current)
      current = char
      if (lines.length >= maxLines) return lines
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, maxLines)
}

function sectionTitle(context: CanvasRenderingContext2D, text: string, x: number, y: number) {
  context.fillStyle = INK
  context.font = 'bold 30px "Hiragino Mincho ProN", "Yu Mincho", serif'
  context.textAlign = 'left'
  context.textBaseline = 'top'
  context.fillText(text, x, y)
  context.strokeStyle = LINE
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(x, y + 40)
  context.lineTo(x + 6, y + 40)
  context.stroke()
}

function drawTable(context: CanvasRenderingContext2D, x: number, y: number, width: number, colAWidth: number, rows: { a: string; b: string }[], rowHeight: number) {
  context.strokeStyle = '#cbd5e1'
  context.fillStyle = INK
  rows.forEach((row, index) => {
    const rowY = y + index * rowHeight
    context.strokeRect(x, rowY, width, rowHeight)
    context.beginPath()
    context.moveTo(x + colAWidth, rowY)
    context.lineTo(x + colAWidth, rowY + rowHeight)
    context.stroke()
    context.font = '20px sans-serif'
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    context.fillStyle = SUB_INK
    context.fillText(row.a, x + 16, rowY + rowHeight / 2, colAWidth - 24)
    context.fillStyle = INK
    context.font = '22px sans-serif'
    const lines = wrapText(context, row.b, width - colAWidth - 32, 2)
    if (lines.length <= 1) {
      context.fillText(row.b, x + colAWidth + 16, rowY + rowHeight / 2, width - colAWidth - 32)
    } else {
      const lineHeight = 26
      const startY = rowY + rowHeight / 2 - ((lines.length - 1) * lineHeight) / 2
      lines.forEach((line, lineIndex) => context.fillText(line, x + colAWidth + 16, startY + lineIndex * lineHeight, width - colAWidth - 32))
    }
  })
}

function drawChips(context: CanvasRenderingContext2D, labels: string[], x: number, y: number, maxWidth: number): number {
  context.font = 'bold 18px sans-serif'
  let cursorX = x
  let cursorY = y
  const chipHeight = 36
  const gap = 10
  for (const label of labels) {
    const textWidth = context.measureText(label).width
    const chipWidth = textWidth + 28
    if (cursorX + chipWidth > x + maxWidth) {
      cursorX = x
      cursorY += chipHeight + gap
    }
    context.fillStyle = '#eef2f6'
    context.strokeStyle = '#94a3b8'
    context.lineWidth = 1
    context.beginPath()
    context.roundRect(cursorX, cursorY, chipWidth, chipHeight, 18)
    context.fill()
    context.stroke()
    context.fillStyle = INK
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    context.fillText(label, cursorX + 14, cursorY + chipHeight / 2 + 1)
    cursorX += chipWidth + gap
  }
  return cursorY + chipHeight
}

export async function renderResumeExportImage(data: ResumeData, photo: ResumeExportPhoto | null): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('画像生成を利用できません')

  context.fillStyle = PAPER
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = LINE
  context.lineWidth = 3
  context.strokeRect(MARGIN / 2, MARGIN / 2, canvas.width - MARGIN, canvas.height - MARGIN)

  const contentX = MARGIN
  const contentWidth = canvas.width - MARGIN * 2

  context.fillStyle = INK
  context.font = 'bold 56px "Hiragino Mincho ProN", "Yu Mincho", serif'
  context.textAlign = 'left'
  context.textBaseline = 'top'
  context.fillText('デュエマ履歴書', contentX, MARGIN)

  const createdAtLabel = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' }).format(new Date())
  context.font = '20px sans-serif'
  context.fillStyle = SUB_INK
  context.textAlign = 'right'
  context.fillText(`作成日 ${createdAtLabel}`, contentX + contentWidth, MARGIN + 70)

  context.strokeStyle = LINE
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(contentX, MARGIN + 92)
  context.lineTo(contentX + contentWidth, MARGIN + 92)
  context.stroke()

  const infoRows = [
    { a: '名前', b: data.handleName || '未入力' },
    { a: 'デュエマ開始時期', b: data.startedAt || '-' },
    { a: '性別', b: data.gender },
    { a: '年齢', b: data.ageGroup },
    { a: '活動地域', b: data.region || '-' },
    { a: '好きな文明', b: data.favoriteCivilization || '-' },
    { a: 'プレイスタイル', b: data.playStyle || '-' },
    { a: 'デュエプレ', b: data.playsDuelMastersPlay },
  ]
  const infoRowHeight = 52
  const infoTableHeight = infoRows.length * infoRowHeight

  const photoSize = 230
  const photoHeight = infoTableHeight
  const photoX = contentX + contentWidth - photoSize
  const photoY = MARGIN + 120
  context.strokeStyle = LINE
  context.lineWidth = 2
  context.strokeRect(photoX, photoY, photoSize, photoHeight)
  if (photo?.url) {
    const image = await loadImage(photo.url, photo.kind === 'avatar' ? 'anonymous' : null)
    if (image) {
      const scale = Math.min(photoSize / image.width, photoHeight / image.height)
      const w = image.width * scale
      const h = image.height * scale
      try {
        context.drawImage(image, photoX + (photoSize - w) / 2, photoY + (photoHeight - h) / 2, w, h)
      } catch { /* CORSでの描画失敗時は枠のみ残す */ }
    }
  }
  if (photo?.caption) {
    context.font = 'bold 18px sans-serif'
    context.fillStyle = INK
    context.textAlign = 'center'
    context.textBaseline = 'top'
    context.fillText(photo.caption, photoX + photoSize / 2, photoY + photoHeight + 10, photoSize)
  }

  const infoWidth = contentWidth - photoSize - 40
  drawTable(context, contentX, MARGIN + 120, infoWidth, 170, infoRows, infoRowHeight)

  let cursorY = MARGIN + 120 + infoTableHeight + 50

  const usageRows = [
    { a: '使用デッキ', b: data.currentDecksText || '-' },
    { a: '好きなYouTuber', b: data.favoriteYouTuber || '-' },
    { a: 'デュエマ以外で好きな事', b: data.otherInterests || '-' },
  ]
  drawTable(context, contentX, cursorY, contentWidth, 220, usageRows, 56)
  cursorY += usageRows.length * 56 + 40

  sectionTitle(context, '大会・デュエマ実績', contentX, cursorY)
  cursorY += 56
  const achievementLabels = data.achievements.map(key => RESUME_ACHIEVEMENT_PRESETS.find(preset => preset.key === key)?.label).filter((v): v is Exclude<typeof v, undefined> => v !== undefined)
  cursorY = achievementLabels.length ? drawChips(context, achievementLabels, contentX, cursorY, contentWidth) : cursorY + 8
  if (data.achievementNote) {
    context.font = '20px sans-serif'
    context.fillStyle = INK
    context.textAlign = 'left'
    context.textBaseline = 'top'
    context.fillText(data.achievementNote, contentX, cursorY + 10, contentWidth)
    cursorY += 40
  }
  cursorY += 30

  sectionTitle(context, 'フリースペース', contentX, cursorY)
  cursorY += 56
  const freeSpaceBoxHeight = 180
  context.strokeStyle = '#cbd5e1'
  context.strokeRect(contentX, cursorY, contentWidth, freeSpaceBoxHeight)
  context.font = '22px sans-serif'
  context.fillStyle = INK
  context.textAlign = 'left'
  context.textBaseline = 'top'
  const freeSpaceLines = wrapText(context, data.freeSpace || '（未入力）', contentWidth - 32, 6)
  freeSpaceLines.forEach((line, index) => context.fillText(line, contentX + 16, cursorY + 16 + index * 28, contentWidth - 32))
  cursorY += freeSpaceBoxHeight + 40

  sectionTitle(context, '対戦・交流について', contentX, cursorY)
  cursorY += 56
  const socialLabels = data.socialTags.map(key => RESUME_SOCIAL_TAG_PRESETS.find(preset => preset.key === key)?.label).filter((v): v is Exclude<typeof v, undefined> => v !== undefined)
  cursorY = socialLabels.length ? drawChips(context, socialLabels, contentX, cursorY, contentWidth) : cursorY + 8
  if (data.socialNote) {
    context.font = '20px sans-serif'
    context.fillStyle = INK
    context.fillText(data.socialNote, contentX, cursorY + 10, contentWidth)
  }

  context.font = '16px sans-serif'
  context.fillStyle = '#94a3b8'
  context.textAlign = 'center'
  context.textBaseline = 'bottom'
  context.fillText('デュエマ掲示板　https://www.duema-bbs.com　#デュエマ履歴書', canvas.width / 2, canvas.height - MARGIN / 2 - 12)

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PNGの生成に失敗しました')
  return blob
}

export function resumePngFileName(handleName: string) {
  const safe = (handleName || 'デュエマ履歴書').replace(/[\\/:*?"<>| -]/g, '_').trim().slice(0, 40)
  return `${safe || 'デュエマ履歴書'}.png`
}
