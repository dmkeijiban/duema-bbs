import { createAdminClient } from '@/lib/supabase-admin'

export type CardInput = { name: string; image_url: string | null; civilization: string[]; cost: number | null; card_type: string | null; regulation: string }
export type CardImportRow = CardInput & { row: number; normalized_name: string; status: 'new' | 'update' | 'skip' | 'duplicate'; errors: string[] }
export type CardImportResult = { ok: boolean; rows: CardImportRow[]; errors: string[]; summary: Record<CardImportRow['status'], number>; databaseChecked: boolean }

const EMPTY_SUMMARY = { new: 0, update: 0, skip: 0, duplicate: 0 }

export function normalizeCardName(value: string) {
  return value.normalize('NFKC').trim().replace(/[\s\u3000]+/g, '').replace(/[／∕]/g, '/').replace(/[・·]/g, '・')
}

function nullableString(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : null }

export async function validateCardImport(json: string): Promise<CardImportResult> {
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch (error) {
    return { ok: false, rows: [], errors: [error instanceof Error ? `JSON parse error: ${error.message}` : 'JSON parse error'], summary: { ...EMPTY_SUMMARY }, databaseChecked: false }
  }
  if (!Array.isArray(parsed)) return { ok: false, rows: [], errors: ['JSONのルートは配列にしてください'], summary: { ...EMPTY_SUMMARY }, databaseChecked: false }

  const seen = new Map<string, number>()
  const rows: CardImportRow[] = parsed.map((raw, index) => {
    const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const normalized_name = normalizeCardName(name)
    const errors: string[] = []
    if (!name) errors.push('nameは必須です')
    if (!normalized_name) errors.push('正規化後のカード名が空です')
    if (item.image_url != null && typeof item.image_url !== 'string') errors.push('image_urlは文字列にしてください')
    const civilization = Array.isArray(item.civilization) && item.civilization.every(v => typeof v === 'string') ? item.civilization.map(v => v.trim()).filter(Boolean) : []
    if (!Array.isArray(item.civilization)) errors.push('civilizationは文字列配列にしてください')
    const cost = item.cost == null ? null : typeof item.cost === 'number' && Number.isInteger(item.cost) && item.cost >= 0 ? item.cost : null
    if (item.cost != null && cost === null) errors.push('costは0以上の整数にしてください')
    const duplicateOf = seen.get(normalized_name)
    if (normalized_name && duplicateOf) errors.push(`JSON内で${duplicateOf}行目と重複しています`)
    if (normalized_name && !duplicateOf) seen.set(normalized_name, index + 1)
    return { row: index + 1, name, normalized_name, image_url: nullableString(item.image_url), civilization, cost, card_type: nullableString(item.card_type), regulation: nullableString(item.regulation) ?? 'none', status: duplicateOf ? 'duplicate' : 'new', errors }
  })

  let databaseChecked = false
  try {
    const names = rows.filter(row => row.normalized_name).map(row => row.normalized_name)
    const { data, error } = names.length ? await createAdminClient().from('cards').select('normalized_name,name,image_url,civilization,cost,card_type,regulation').in('normalized_name', names) : { data: [], error: null }
    if (error) throw error
    databaseChecked = true
    const existing = new Map((data ?? []).map(row => [row.normalized_name as string, row]))
    for (const row of rows) {
      if (row.status === 'duplicate' || row.errors.length) continue
      const old = existing.get(row.normalized_name)
      if (!old) continue
      const same = old.name === row.name && old.image_url === row.image_url && JSON.stringify(old.civilization) === JSON.stringify(row.civilization) && old.cost === row.cost && old.card_type === row.card_type && old.regulation === row.regulation
      row.status = same ? 'skip' : 'update'
    }
  } catch { /* migration未適用のPreviewでも入力検証は利用可能 */ }
  const summary = { ...EMPTY_SUMMARY }
  rows.forEach(row => { summary[row.status] += 1 })
  const errors = rows.flatMap(row => row.errors.map(error => `${row.row}行目: ${error}`))
  return { ok: errors.length === 0, rows, errors, summary, databaseChecked }
}

export async function registerCardImport(json: string, confirmed: boolean) {
  if (process.env.VERCEL_ENV !== 'preview') return { ok: false, message: '書き込みはVercel Previewでのみ有効です' }
  if (!confirmed) return { ok: false, message: '登録確認が必要です' }
  const result = await validateCardImport(json)
  if (!result.ok || !result.databaseChecked) return { ok: false, message: result.errors[0] ?? 'cardsテーブルとの重複確認を完了できません' }
  const targets = result.rows.filter(row => row.status === 'new' || row.status === 'update').map(row => ({
    name: row.name, normalized_name: row.normalized_name, image_url: row.image_url,
    civilization: row.civilization, cost: row.cost, card_type: row.card_type,
    regulation: row.regulation, is_active: true, updated_at: new Date().toISOString(),
  }))
  if (!targets.length) return { ok: true, message: '変更はありません', count: 0 }
  const { error } = await createAdminClient().from('cards').upsert(targets, { onConflict: 'normalized_name' })
  return error ? { ok: false, message: error.message } : { ok: true, message: `${targets.length}件を登録・更新しました`, count: targets.length }
}
