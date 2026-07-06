'use client'

import { useMemo, useState, useTransition } from 'react'
import ZukanPseudoCard from '@/components/ZukanPseudoCard'
import type {
  ZukanImportEnvStatus,
  ZukanImportRegisterResult,
  ZukanImportValidationResponse,
} from '@/lib/zukan-pack-import'
import type { ZukanPackFileOption } from '@/lib/zukan-pack-files'

type Props = {
  initialEnv: ZukanImportEnvStatus
  fileOptions: ZukanPackFileOption[]
}

function getErrorMessage(data: unknown) {
  if (!data || typeof data !== 'object') return 'リクエストに失敗しました'
  const error = 'error' in data && typeof data.error === 'string' ? data.error : null
  const message = 'message' in data && typeof data.message === 'string' ? data.message : null
  return error || message || 'リクエストに失敗しました'
}

const EMPTY_RESULT: ZukanImportValidationResponse = {
  ok: false,
  validation: { errors: [], warnings: [] },
  duplicateCheck: { checked: false, existingPackSlugs: [], existingCardSlugs: [], errors: [], warnings: [] },
  preview: null,
  env: { canRegister: false, canCheckDuplicates: false, message: null },
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => null) as T | null
  if (!response.ok) {
    throw new Error(getErrorMessage(data))
  }
  return data as T
}

function ResultList({ title, items, tone }: { title: string; items: string[]; tone: 'error' | 'warning' }) {
  if (items.length === 0) return null
  const className = tone === 'error'
    ? 'border-red-200 bg-red-50 text-red-800'
    : 'border-yellow-200 bg-yellow-50 text-yellow-800'

  return (
    <section className={`rounded border px-3 py-2 text-xs ${className}`}>
      <h3 className="font-bold">{title}</h3>
      <ul className="mt-1 max-h-56 list-disc space-y-1 overflow-y-auto pl-5">
        {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    </section>
  )
}

export default function ZukanImportClient({ initialEnv, fileOptions }: Props) {
  const [json, setJson] = useState('')
  const [selectedFileSlug, setSelectedFileSlug] = useState(fileOptions.find(option => option.isValid && !option.isRegistered)?.slug ?? fileOptions[0]?.slug ?? '')
  const [confirmed, setConfirmed] = useState(false)
  const [result, setResult] = useState<ZukanImportValidationResponse>({ ...EMPTY_RESULT, env: initialEnv })
  const [registerResult, setRegisterResult] = useState<ZukanImportRegisterResult | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isFilePending, startFileTransition] = useTransition()
  const [isRegisterPending, startRegisterTransition] = useTransition()

  const canRegister = useMemo(() => {
    return Boolean(
      result.ok &&
      result.preview &&
      result.env.canRegister &&
      confirmed &&
      !isPending &&
      !isRegisterPending &&
      !isFilePending,
    )
  }, [confirmed, isFilePending, isPending, isRegisterPending, result])

  function applyValidation(response: ZukanImportValidationResponse) {
    setResult(response)
    setConfirmed(false)
  }

  function runValidate() {
    setClientError(null)
    setRegisterResult(null)
    setConfirmed(false)
    startTransition(async () => {
      try {
        const response = await postJson<ZukanImportValidationResponse>('/api/admin/zukan/import/validate', { json })
        applyValidation(response)
      } catch (error) {
        setResult({ ...EMPTY_RESULT, env: initialEnv })
        setClientError(error instanceof Error ? error.message : '検証に失敗しました')
      }
    })
  }

  function loadSelectedFile() {
    if (!selectedFileSlug) return
    setClientError(null)
    setRegisterResult(null)
    startFileTransition(async () => {
      try {
        const file = await postJson<{ slug: string; json: string }>('/api/admin/zukan/import/file', { slug: selectedFileSlug })
        setJson(file.json)
        const response = await postJson<ZukanImportValidationResponse>('/api/admin/zukan/import/validate', { json: file.json })
        applyValidation(response)
      } catch (error) {
        setResult({ ...EMPTY_RESULT, env: initialEnv })
        setClientError(error instanceof Error ? error.message : 'JSONファイルを読み込めませんでした')
      }
    })
  }

  function runRegister() {
    setClientError(null)
    setRegisterResult(null)
    startRegisterTransition(async () => {
      try {
        const response = await postJson<ZukanImportRegisterResult>('/api/admin/zukan/import/register', { json, confirmed })
        setRegisterResult(response)
      } catch (error) {
        setRegisterResult({
          ok: false,
          message: error instanceof Error ? error.message : '登録に失敗しました',
        })
      }
    })
  }

  const preview = result.preview
  const errors = result.validation.errors
  const warnings = result.validation.warnings

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <section className="rounded border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">1. パックJSON</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">`data/zukan-packs/*.json` から選ぶか、同じ形式のJSONを貼り付けます。</p>
        </div>
        <div className="space-y-3 p-3">
          {fileOptions.length > 0 && (
            <div className="rounded border border-blue-100 bg-blue-50 px-3 py-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-blue-900">既存JSONファイルから選ぶ</h3>
                  <p className="mt-0.5 text-[11px] text-blue-700">
                    未登録候補: {fileOptions.filter(option => option.isValid && !option.isRegistered).length}件 / 全{fileOptions.length}件
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadSelectedFile}
                  disabled={!selectedFileSlug || isFilePending}
                  className="rounded border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isFilePending ? '読み込み中...' : '読み込んで検証'}
                </button>
              </div>
              <select
                value={selectedFileSlug}
                onChange={event => setSelectedFileSlug(event.target.value)}
                className="w-full rounded border border-blue-200 bg-white px-2 py-2 text-xs text-gray-800 focus:border-blue-400 focus:outline-none"
              >
                {fileOptions.map(option => {
                  const status = option.isRegistered
                    ? '登録済み'
                    : option.isValid
                      ? '未登録候補'
                      : 'JSON要修正'
                  const count = option.cardCount !== null && option.cardsLength !== null
                    ? ` ${option.cardCount}/${option.cardsLength}件`
                    : ''
                  return (
                    <option key={option.slug} value={option.slug}>
                      {status} - {option.fileName} - {option.code ?? '-'} {option.name ?? ''}{count}
                    </option>
                  )
                })}
              </select>
              {selectedFileSlug && (
                <div className="mt-2 text-[11px] text-blue-800">
                  {(() => {
                    const selected = fileOptions.find(option => option.slug === selectedFileSlug)
                    if (!selected) return null
                    if (!selected.isDuplicateCheckDone) return 'DB接続情報がないため、未登録かどうかは登録前validateで再確認します。'
                    if (selected.isRegistered) return '既存slugがあるため、このファイルは登録できません。'
                    if (!selected.isValid) return 'JSONにvalidateエラーがあります。内容を修正してください。'
                    return '未登録候補です。読み込むと自動でvalidateします。'
                  })()}
                </div>
              )}
            </div>
          )}

          <textarea
            value={json}
            onChange={event => setJson(event.target.value)}
            spellCheck={false}
            placeholder='{"pack":{"slug":"dmr-01",...},"cards":[...]}'
            className="h-[520px] w-full resize-y rounded border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs leading-5 text-gray-800 focus:border-blue-400 focus:bg-white focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runValidate}
              disabled={!json.trim() || isPending}
              className="rounded border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? '検証中...' : 'validate / preview'}
            </button>
            <span className="text-xs text-gray-500">登録前に必ず重複チェックまで通します。</span>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <section className="rounded border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-3 py-2">
            <h2 className="text-sm font-bold text-gray-800">2. 検証結果</h2>
          </div>
          <div className="space-y-2 p-3">
            {clientError && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{clientError}</div>
            )}
            <div className={`rounded border px-3 py-2 text-xs font-bold ${result.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
              {result.ok ? '登録前チェックOK' : 'JSONを貼って validate を実行してください'}
            </div>
            <ResultList title="エラー" items={errors} tone="error" />
            <ResultList title="警告" items={warnings} tone="warning" />
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <div>既存slugチェック: {result.duplicateCheck.checked ? '実行済み' : '未実行'}</div>
              <div>pack重複: {result.duplicateCheck.existingPackSlugs.length}件</div>
              <div>card重複: {result.duplicateCheck.existingCardSlugs.length}件</div>
            </div>
          </div>
        </section>

        {preview && (
          <section className="rounded border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-3 py-2">
              <h2 className="text-sm font-bold text-gray-800">3. プレビュー</h2>
            </div>
            <div className="space-y-3 p-3">
              <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="font-bold text-gray-500">slug</dt>
                <dd className="font-mono text-blue-700">{preview.pack.slug}</dd>
                <dt className="font-bold text-gray-500">商品</dt>
                <dd>{preview.pack.code} {preview.pack.name}</dd>
                <dt className="font-bold text-gray-500">発売</dt>
                <dd>{preview.pack.released_year ?? '-'}</dd>
                <dt className="font-bold text-gray-500">件数</dt>
                <dd className={preview.pack.card_count === preview.cardsLength ? 'text-green-700' : 'text-red-700'}>
                  card_count {preview.pack.card_count} / cards.length {preview.cardsLength}
                </dd>
                <dt className="font-bold text-gray-500">公開</dt>
                <dd>{preview.pack.is_published ? 'true' : 'false'}（登録時は true）</dd>
              </dl>

              <div>
                <h3 className="mb-2 text-xs font-bold text-gray-700">代表カードプレビュー</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {preview.representativeCards.map(card => (
                    <div key={card.slug} className="min-w-0 border border-gray-200 bg-white">
                      <ZukanPseudoCard
                        name={card.name}
                        civilization={card.civilization}
                        cost={card.cost}
                        cardType={card.card_type}
                        power={card.power}
                        rarity={card.rarity}
                        size="sm"
                        className="rounded-none shadow-none"
                      />
                      <div className="px-1.5 py-1">
                        <div className="truncate text-[10px] font-bold text-blue-700">{card.name}</div>
                        <div className="truncate font-mono text-[9px] text-gray-400">{card.slug}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="rounded border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-3 py-2">
            <h2 className="text-sm font-bold text-gray-800">4. 登録</h2>
          </div>
          <div className="space-y-3 p-3">
            {!result.env.canRegister && (
              <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                管理用環境変数が未設定です。`DATABASE_URL` または `SUPABASE_DB_URL` をサーバー環境に設定すると登録できます。
              </div>
            )}
            <label className="flex gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={event => setConfirmed(event.target.checked)}
                className="mt-0.5"
              />
              <span>このパックを新規登録する。既存データは更新・削除しない。</span>
            </label>
            <button
              type="button"
              disabled={!canRegister}
              onClick={runRegister}
              className="w-full rounded border border-green-300 bg-green-50 px-4 py-2 text-sm font-bold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRegisterPending ? '登録中...' : '登録'}
            </button>
            {registerResult && (
              <div className={`rounded border px-3 py-2 text-xs ${registerResult.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                <div className="font-bold">{registerResult.message}</div>
                {registerResult.packSlug && <div className="mt-1">pack: {registerResult.packSlug}</div>}
                {typeof registerResult.expectedCardCount === 'number' && (
                  <div>expected: {registerResult.expectedCardCount} / actual: {registerResult.actualCardCount ?? '-'}</div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
