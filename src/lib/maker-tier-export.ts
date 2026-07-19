import { HALL_RELEASE_DESIGN, HALL_RELEASE_LABEL_LINES } from '@/lib/hall-release-design'

// あそびばのTier表/殿堂解除予想系企画（作成画面・編集画面・登録済み作品の一覧/詳細画面）が
// 保存画像・X共有画像として出力するPNGを1箇所で描画する。企画名やタイトルは呼び出し側から渡し、
// ここには特定企画の文言を書かない。

export type TierExportPalette = { background: string; border: string; label: string; labelBackground: string }

export const TIER_EXPORT_PALETTE: Record<string, TierExportPalette> = {
  s: { background: '#fff1f2', border: '#fca5a5', label: '#be123c', labelBackground: '#fca5a5' },
  a: { background: '#fff7ed', border: '#fdba74', label: '#c2410c', labelBackground: '#fdba74' },
  b: { background: '#fffbeb', border: '#fcd34d', label: '#a16207', labelBackground: '#fcd34d' },
  c: { background: '#ecfdf5', border: '#6ee7b7', label: '#047857', labelBackground: '#6ee7b7' },
  d: { background: '#eff6ff', border: '#93c5fd', label: '#1d4ed8', labelBackground: '#93c5fd' },
  release: HALL_RELEASE_DESIGN.canvas,
}

const DEFAULT_PALETTE: TierExportPalette = { background: '#f8fafc', border: '#cbd5e1', label: '#111827', labelBackground: '#cbd5e1' }

export const TIER_EXPORT_BADGE_COLORS: Record<string, { background: string; color: string }> = {
  premium: { background: '#991b1b', color: '#ffffff' },
  hall: { background: '#facc15', color: '#422006' },
}
const DEFAULT_BADGE_COLORS = { background: '#334155', color: '#ffffff' }

export type TierExportBadge = { label: string; value: string }
export type TierExportCard = { imageUrl: string | null; badge?: TierExportBadge | null }
export type TierExportRow = { key: string; labelLines: string[]; cards: TierExportCard[] }
export type TierExportHeader = { title: string; subtitle?: string; subtitleAlign?: 'left' | 'right' }

export type TierExportOptions = {
  header: TierExportHeader
  // 'release' は殿堂解除予想レイアウト（見出しの余白・ラベル書式を専用デザインへ切り替える）
  layout?: 'standard' | 'release'
  rows: TierExportRow[]
  loadImage: (url: string) => Promise<HTMLImageElement>
}

const CANVAS_WIDTH = 1080
const LEFT = 30
const LABEL_WIDTH = HALL_RELEASE_DESIGN.labelWidth.canvas
const HORIZONTAL_PADDING = 12
const GAP = 10
const ROW_GAP = 10
const CARDS_PER_LINE = 6
const CARD_WIDTH = 138
const CARD_HEIGHT = Math.round(CARD_WIDTH * 88 / 63)
const BOTTOM_PADDING = 28
const EMPTY_ROW_HEIGHT = 76

function computeRowHeight(cardCount: number) {
  if (cardCount === 0) return EMPTY_ROW_HEIGHT
  const lineCount = Math.ceil(cardCount / CARDS_PER_LINE)
  return lineCount * CARD_HEIGHT + Math.max(0, lineCount - 1) * ROW_GAP + 20
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(',')
  const mime = header?.match(/data:([^;]+)/)?.[1] ?? 'image/png'
  const binary = atob(body ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  try {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (blob) return blob
  } catch {
    // toBlob 自体が例外を投げる環境があるため toDataURL にフォールバック
  }
  return dataUrlToBlob(canvas.toDataURL('image/png'))
}

export async function renderTierExportImage({ header, layout = 'standard', rows, loadImage }: TierExportOptions): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  const context = canvas.getContext('2d')
  if (!context) throw new Error('画像生成を利用できません')

  const isRelease = layout === 'release'
  const totalWidth = canvas.width - LEFT * 2
  const headerHeight = header.subtitle || isRelease ? 120 : 90
  const rowLayouts = rows.map(row => ({ row, height: computeRowHeight(row.cards.length) }))
  canvas.height = headerHeight + rowLayouts.reduce((sum, layoutRow) => sum + layoutRow.height + 5, 0) + BOTTOM_PADDING

  const imageUrls = [...new Set(rows.flatMap(row => row.cards.map(card => card.imageUrl).filter((url): url is string => Boolean(url))))]
  const loadedImages = new Map<string, HTMLImageElement>()
  await Promise.all(imageUrls.map(async url => {
    try {
      loadedImages.set(url, await loadImage(url))
    } catch {
      // 読み込めなかったカードだけプレースホルダーで出力する
    }
  }))

  context.fillStyle = '#f8fafc'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#0f172a'
  context.font = 'bold 38px sans-serif'
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  context.fillText(header.title, 40, 58)
  if (header.subtitle) {
    context.font = 'bold 22px sans-serif'
    context.fillStyle = '#475569'
    if (header.subtitleAlign === 'right') {
      context.textAlign = 'right'
      context.fillText(header.subtitle, canvas.width - 40, 88)
      context.textAlign = 'left'
    } else {
      context.fillText(header.subtitle, 40, 91)
    }
  }

  let y = headerHeight
  for (const { row, height } of rowLayouts) {
    const colors = TIER_EXPORT_PALETTE[row.key.toLowerCase()] ?? DEFAULT_PALETTE
    context.fillStyle = colors.background
    context.fillRect(LEFT, y, totalWidth, height)
    context.fillStyle = colors.labelBackground
    context.fillRect(LEFT, y, LABEL_WIDTH, height)
    context.strokeStyle = colors.border
    context.lineWidth = 1.5
    context.strokeRect(LEFT, y, totalWidth, height)

    const useReleaseLabel = isRelease && row.key === 'release'
    const labelLines = useReleaseLabel ? [...HALL_RELEASE_LABEL_LINES] : row.labelLines
    const labelFontSize = useReleaseLabel ? HALL_RELEASE_DESIGN.canvas.labelFontSize : labelLines.length > 1 ? 22 : 42
    const labelLineHeight = labelFontSize * (useReleaseLabel ? HALL_RELEASE_DESIGN.canvas.labelLineHeight : 1.2)
    const labelCenterY = y + height / 2
    const labelStartY = labelCenterY - ((labelLines.length - 1) * labelLineHeight) / 2
    context.fillStyle = colors.label
    context.font = `bold ${labelFontSize}px sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    for (const [lineIndex, line] of labelLines.entries()) {
      context.fillText(line, LEFT + LABEL_WIDTH / 2, labelStartY + lineIndex * labelLineHeight)
    }
    context.textAlign = 'left'
    context.textBaseline = 'alphabetic'

    for (const [index, card] of row.cards.entries()) {
      const column = index % CARDS_PER_LINE
      const line = Math.floor(index / CARDS_PER_LINE)
      const x = LEFT + LABEL_WIDTH + HORIZONTAL_PADDING + column * (CARD_WIDTH + GAP)
      const cardY = y + 10 + line * (CARD_HEIGHT + ROW_GAP)
      const image = card.imageUrl ? loadedImages.get(card.imageUrl) : null
      if (image) {
        context.drawImage(image, x, cardY, CARD_WIDTH, CARD_HEIGHT)
      } else {
        context.fillStyle = '#e2e8f0'
        context.fillRect(x, cardY, CARD_WIDTH, CARD_HEIGHT)
      }
      if (card.badge) {
        const badgeColors = TIER_EXPORT_BADGE_COLORS[card.badge.value] ?? DEFAULT_BADGE_COLORS
        context.font = 'bold 15px sans-serif'
        const badgeWidth = context.measureText(card.badge.label).width + 14
        context.fillStyle = badgeColors.background
        context.fillRect(x + CARD_WIDTH - badgeWidth - 4, cardY + CARD_HEIGHT - 25, badgeWidth, 21)
        context.fillStyle = badgeColors.color
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(card.badge.label, x + CARD_WIDTH - badgeWidth / 2 - 4, cardY + CARD_HEIGHT - 14.5)
        context.textAlign = 'left'
        context.textBaseline = 'alphabetic'
      }
    }

    y += height + 5
  }

  return canvasToPngBlob(canvas)
}
