import { toBlob } from 'html-to-image'
import { RESUME_LAYOUT as L } from '@/lib/maker-resume-layout'

/**
 * 画面表示と同じ ResumePreview のDOMを、そのままPNGへ変換する。
 * 履歴書のレイアウトをここで再実装しないこと。
 */
export async function renderResumeExportImage(previewElement: HTMLElement | null): Promise<Blob> {
  if (!previewElement) throw new Error('履歴書のプレビューを取得できません')

  await document.fonts.ready
  const blob = await toBlob(previewElement, {
    width: L.width,
    height: L.height,
    canvasWidth: L.width,
    canvasHeight: L.height,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: L.colors.paper,
  })
  if (!blob) throw new Error('PNGの生成に失敗しました')
  return blob
}

export function resumePngFileName(handleName: string) {
  const safe = (handleName || 'デュエマ履歴書').replace(/[\\/:*?"<>| -]/g, '_').trim().slice(0, 40)
  return `${safe || 'デュエマ履歴書'}.png`
}
