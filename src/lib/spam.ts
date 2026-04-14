// 日本語文字が含まれているか確認（ひらがな・カタカナ・漢字）
export function hasJapanese(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/.test(text)
}
