// あそびばの「カード〇選」系（3×3などのカード選択企画）が保存画像・X共有画像として出力する
// PNGを1箇所で描画する。企画タイトルは呼び出し側から渡し、投稿タイトルが入力されている場合は
// そのタイトルを優先する。コメントやサイト名などのフッターは描画しない。

export type SelectExportOptions<TCard> = {
  title: string
  cards: TCard[]
  hasImage: (card: TCard) => boolean
  loadImage: (card: TCard) => Promise<HTMLImageElement | null>
}

const CANVAS_WIDTH = 1200
const MARGIN_X = 70
const GRID_GAP = 18
const TOP_MARGIN = 40
const TITLE_HEIGHT = 62
const TITLE_GRID_GAP = 36
const CARD_ASPECT_HEIGHT_PER_WIDTH = 88 / 63

function computeColumns(count: number) {
  if (count <= 3) return Math.max(1, count)
  if (count <= 9) return 3
  return 4
}

function resolveExportTitle(fallbackTitle: string) {
  const input = document.querySelector<HTMLInputElement>('[data-select-maker-title]')
  return input?.value.trim() || fallbackTitle
}

export async function renderSelectExportImage<TCard>({ title, cards, hasImage, loadImage }: SelectExportOptions<TCard>): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  const context = canvas.getContext('2d')
  if (!context) throw new Error('画像生成を利用できません')

  const columns = computeColumns(cards.length)
  const rows = Math.max(1, Math.ceil(cards.length / columns))
  const areaWidth = canvas.width - MARGIN_X * 2
  const cellWidth = (areaWidth - GRID_GAP * (columns - 1)) / columns
  const cellHeight = cellWidth * CARD_ASPECT_HEIGHT_PER_WIDTH

  const gridTop = TOP_MARGIN + TITLE_HEIGHT + TITLE_GRID_GAP
  const gridHeight = rows * cellHeight + Math.max(0, rows - 1) * GRID_GAP
  const bottomMargin = TOP_MARGIN
  canvas.height = gridTop + gridHeight + bottomMargin

  const images = await Promise.all(cards.map(async card => {
    if (!hasImage(card)) return null
    try {
      return await loadImage(card)
    } catch {
      return null
    }
  }))

  context.fillStyle = '#f8fafc'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#0f172a'
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.font = 'bold 52px sans-serif'
  context.fillText(resolveExportTitle(title).slice(0, 28), canvas.width / 2, TOP_MARGIN)

  images.forEach((image, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = MARGIN_X + column * (cellWidth + GRID_GAP)
    const y = gridTop + row * (cellHeight + GRID_GAP)
    context.fillStyle = '#e2e8f0'
    context.fillRect(x, y, cellWidth, cellHeight)
    if (image) {
      const scale = Math.min(cellWidth / image.width, cellHeight / image.height)
      const w = image.width * scale
      const h = image.height * scale
      context.drawImage(image, x + (cellWidth - w) / 2, y + (cellHeight - h) / 2, w, h)
    } else {
      context.fillStyle = '#64748b'
      context.font = '24px sans-serif'
      context.textBaseline = 'middle'
      context.fillText('画像なし', x + cellWidth / 2, y + cellHeight / 2)
      context.font = 'bold 52px sans-serif'
      context.textBaseline = 'top'
    }
  })

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PNGの生成に失敗しました')
  return blob
}