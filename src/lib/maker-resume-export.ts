// デュエマ履歴書メーカーのPNG出力（A4縦・高解像度）。既存の maker-select-export.ts と同じく
// Canvasで1箇所描画し、DOMプレビューとは独立して壊れないことを優先する。

import type { ResumeData } from '@/lib/maker-resume'
import { formatResumeDate, RESUME_DEFAULT_AVATAR_PATH, RESUME_LAYOUT as L, RESUME_SECTION_ORDER } from '@/lib/maker-resume-layout'
import { getResumeSectionContent } from '@/lib/maker-resume-render'

export type ResumeExportPhoto = { url: string | null }

const CANVAS_WIDTH = L.width
const CANVAS_HEIGHT = L.height
const MARGIN = L.margin
const INK = L.colors.ink
const SUB_INK = L.colors.subInk
const LINE = L.colors.line
const PAPER = L.colors.paper

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
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
  context.font = `bold ${L.font.section}px "Hiragino Mincho ProN", "Yu Mincho", serif`
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

/** 1行に複数セル（ラベル+値）を等幅で並べる罫線付きグリッド行を描画する。 */
function drawFieldGridRow(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, cells: { label: string; value: string }[], labelWidth: number) {
  const cellWidth = width / cells.length
  context.strokeStyle = LINE
  context.lineWidth = 1.5
  context.strokeRect(x, y, width, height)
  cells.forEach((cell, index) => {
    const cellX = x + index * cellWidth
    if (index > 0) {
      context.beginPath()
      context.moveTo(cellX, y)
      context.lineTo(cellX, y + height)
      context.stroke()
    }
    context.strokeStyle = '#94a3b8'
    context.beginPath()
    context.moveTo(cellX + labelWidth, y)
    context.lineTo(cellX + labelWidth, y + height)
    context.stroke()
    context.strokeStyle = LINE

    context.fillStyle = L.colors.label
    context.fillRect(cellX, y, labelWidth, height)
    context.fillStyle = SUB_INK
    context.font = `bold ${L.font.label}px sans-serif`
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    context.fillText(cell.label, cellX + 12, y + height / 2, labelWidth - 16)

    context.fillStyle = INK
    context.font = `${L.font.value}px sans-serif`
    const valueMaxWidth = cellWidth - labelWidth - 24
    const lines = wrapText(context, cell.value, valueMaxWidth, 1)
    context.fillText(lines[0] ?? '', cellX + labelWidth + 12, y + height / 2, valueMaxWidth)
  })
}

function drawChips(context: CanvasRenderingContext2D, labels: string[], x: number, y: number, maxWidth: number): number {
  context.font = `bold ${L.font.chip}px sans-serif`
  let cursorX = x
  let cursorY = y
  const chipHeight = L.chipHeight
  const gap = L.chipGap
  for (const label of labels) {
    const textWidth = context.measureText(label).width
    const chipWidth = textWidth + L.chipPaddingX * 2
    if (cursorX + chipWidth > x + maxWidth) {
      cursorX = x
      cursorY += chipHeight + gap
    }
    context.fillStyle = L.colors.chip
    context.strokeStyle = L.colors.lightLine
    context.lineWidth = 1
    context.beginPath()
    context.roundRect(cursorX, cursorY, chipWidth, chipHeight, 18)
    context.fill()
    context.stroke()
    context.fillStyle = INK
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    context.fillText(label, cursorX + L.chipPaddingX, cursorY + chipHeight / 2 + 1)
    cursorX += chipWidth + gap
  }
  return cursorY + chipHeight
}

/** アイコン未設定時の簡易な人型プレースホルダーを描画する。 */
function drawDefaultAvatarGlyph(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.fillStyle = L.colors.label
  context.fillRect(x, y, size, size)
  context.fillStyle = L.colors.lightLine
  const glyphSize = size / 2
  context.save()
  context.translate(x + (size - glyphSize) / 2, y + (size - glyphSize) / 2)
  context.scale(glyphSize / 24, glyphSize / 24)
  context.fill(new Path2D(RESUME_DEFAULT_AVATAR_PATH))
  context.restore()
}

export async function renderResumeExportImage(data: ResumeData, photo: ResumeExportPhoto | null, resumeDate?: string | null): Promise<Blob> {
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
  context.font = `bold ${L.font.title}px "Hiragino Mincho ProN", "Yu Mincho", serif`
  context.textAlign = 'left'
  context.textBaseline = 'top'
  context.fillText('デュエマ履歴書', contentX, MARGIN)

  const createdAtLabel = formatResumeDate(resumeDate)
  context.font = `${L.font.date}px sans-serif`
  context.fillStyle = SUB_INK
  context.textAlign = 'right'
  context.fillText(`作成日 ${createdAtLabel}`, contentX + contentWidth, MARGIN + 70)

  context.strokeStyle = LINE
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(contentX, MARGIN + 92)
  context.lineTo(contentX + contentWidth, MARGIN + 92)
  context.stroke()

  // 正方形プロフィールアイコン（右上）
  const photoSize = L.photoSize
  const photoX = contentX + contentWidth - photoSize
  const photoY = L.infoTop
  if (photo?.url) {
    const image = await loadImage(photo.url)
    if (image) {
      context.save()
      context.beginPath()
      context.rect(photoX, photoY, photoSize, photoSize)
      context.clip()
      const scale = Math.max(photoSize / image.width, photoSize / image.height)
      const w = image.width * scale
      const h = image.height * scale
      context.drawImage(image, photoX + (photoSize - w) / 2, photoY + (photoSize - h) / 2, w, h)
      context.restore()
    } else {
      drawDefaultAvatarGlyph(context, photoX, photoY, photoSize)
    }
  } else {
    drawDefaultAvatarGlyph(context, photoX, photoY, photoSize)
  }
  context.strokeStyle = LINE
  context.lineWidth = 2
  context.strokeRect(photoX, photoY, photoSize, photoSize)

  // 基本情報：複数列フィールドグリッド
  const infoWidth = contentWidth - photoSize - L.photoGap
  const rowHeight = L.rowHeight
  let cursorY: number = L.infoTop
  drawFieldGridRow(context, contentX, cursorY, infoWidth, rowHeight, [{ label: '名前', value: data.handleName || '未入力' }], L.defaultLabelWidth)
  cursorY += rowHeight
  drawFieldGridRow(context, contentX, cursorY, infoWidth, rowHeight, [
    { label: '開始時期', value: data.startedAt || '-' },
    { label: '活動地域', value: data.region || '-' },
  ], L.defaultLabelWidth)
  cursorY += rowHeight
  drawFieldGridRow(context, contentX, cursorY, infoWidth, rowHeight, [
    { label: '性別', value: data.gender },
    { label: '年齢', value: data.ageGroup },
    { label: 'デュエプレ', value: data.playsDuelMastersPlay },
  ], L.compactLabelWidth)
  cursorY += rowHeight
  drawFieldGridRow(context, contentX, cursorY, infoWidth, rowHeight, [
    { label: '好きな文明', value: data.favoriteCivilization || '-' },
    { label: 'プレイスタイル', value: data.playStyle || '-' },
  ], L.profileChoiceLabelWidth)
  cursorY += rowHeight

  cursorY = Math.max(cursorY, photoY + photoSize) + L.sectionGap

  drawFieldGridRow(context, contentX, cursorY, contentWidth, rowHeight, [{ label: '使用デッキ', value: data.currentDecksText || '-' }], L.fullLabelWidth)
  cursorY += rowHeight
  drawFieldGridRow(context, contentX, cursorY, contentWidth, rowHeight, [
    { label: '好きなYouTuber', value: data.favoriteYouTuber || '-' },
    { label: '好きな事', value: data.otherInterests || '-' },
  ], L.fullLabelWidth)
  cursorY += rowHeight + L.sectionGap

  const sectionContent = getResumeSectionContent(data)
  for (const section of RESUME_SECTION_ORDER) {
    if (section === 'interaction') {
      sectionTitle(context, '対戦・交流について', contentX, cursorY)
      cursorY += 56
      if (sectionContent.interaction.tags.length) cursorY = drawChips(context, sectionContent.interaction.tags, contentX, cursorY, contentWidth)
      if (sectionContent.interaction.note) {
        context.font = '20px sans-serif'
        context.fillStyle = INK
        context.fillText(sectionContent.interaction.note, contentX, cursorY + 10, contentWidth)
        cursorY += 40
      }
      cursorY += 40
    } else if (section === 'achievements') {
      sectionTitle(context, '大会・デュエマ実績', contentX, cursorY)
      cursorY += 56
      if (sectionContent.achievements.tags.length) cursorY = drawChips(context, sectionContent.achievements.tags, contentX, cursorY, contentWidth)
      if (sectionContent.achievements.note) {
        context.font = '20px sans-serif'
        context.fillStyle = INK
        context.textAlign = 'left'
        context.textBaseline = 'top'
        context.fillText(sectionContent.achievements.note, contentX, cursorY + 10, contentWidth)
        cursorY += 40
      }
      cursorY += 30
    } else {
      sectionTitle(context, 'フリースペース', contentX, cursorY)
      cursorY += 56
      const freeSpaceBoxHeight = L.freeSpaceHeight
      context.strokeStyle = '#cbd5e1'
      context.strokeRect(contentX, cursorY, contentWidth, freeSpaceBoxHeight)
      context.font = `${L.font.freeSpace}px sans-serif`
      context.fillStyle = INK
      context.textAlign = 'left'
      context.textBaseline = 'top'
      const freeSpaceLines = wrapText(context, sectionContent.freeSpace.text, contentWidth - 32, 6)
      freeSpaceLines.forEach((line, index) => context.fillText(line, contentX + 16, cursorY + 16 + index * 28, contentWidth - 32))
      cursorY += freeSpaceBoxHeight
    }
  }

  context.font = `${L.font.footer}px sans-serif`
  context.fillStyle = L.colors.muted
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
