'use client'

import { useMemo, useState } from 'react'
import type { ZukanArticleStatus, ZukanArticleTargetType } from '@/lib/zukan-articles'
import { saveZukanArticle } from './actions'

type ArticleFormValue = {
  id: string
  slug: string
  article_type: ZukanArticleTargetType
  target_id: string
  title: string
  description: string
  status: ZukanArticleStatus
  blocks: unknown
}

type PackOption = {
  slug: string
  code: string
  name: string
}

type CardOption = {
  slug: string
  name: string
}

function blocksToArticleText(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value
    .map(block => {
      if (!block || typeof block !== 'object') return null
      const record = block as Record<string, unknown>
      const text = String(record.text ?? '').trim()
      if (!text) return null
      if (record.type === 'heading') return `## ${text}`
      if (record.type === 'paragraph') return text
      return null
    })
    .filter((text): text is string => !!text)
    .join('\n\n')
}

function hasBlockCards(value: unknown): boolean {
  return Array.isArray(value) && value.some(block => {
    if (!block || typeof block !== 'object') return false
    const type = (block as Record<string, unknown>).type
    return type === 'card' || type === 'cardGrid'
  })
}

function articleTypeLabel(value: ZukanArticleTargetType) {
  if (value === 'pack_article') return 'パック紹介記事'
  if (value === 'card_article') return 'カード紹介記事'
  return '殿堂図鑑記事'
}

function statusLabel(value: ZukanArticleStatus) {
  if (value === 'published') return '公開中'
  if (value === 'archived') return '非公開 / 保管'
  return '下書き'
}

function articleLengthLabel(value: string) {
  if (value === 'short') return '短め（800〜1,200字）'
  if (value === 'long') return 'しっかり（2,500〜3,500字）'
  return '標準（1,500〜2,200字）'
}

function formatPackOption(option: PackOption) {
  return `${option.code} ${option.name}（${option.slug}）`
}

function formatCardOption(option: CardOption) {
  return `${option.name}（${option.slug}）`
}

export function ZukanArticleEditorForm({
  selected,
  packOptions,
  cardOptions,
}: {
  selected: ArticleFormValue | null
  packOptions: PackOption[]
  cardOptions: CardOption[]
}) {
  const [articleType, setArticleType] = useState<ZukanArticleTargetType>(selected?.article_type ?? 'pack_article')
  const [targetId, setTargetId] = useState(selected?.target_id ?? packOptions[0]?.slug ?? 'dm-01')
  const [slug, setSlug] = useState(selected?.slug ?? targetId)
  const [articleText, setArticleText] = useState(() => blocksToArticleText(selected?.blocks))
  const [title, setTitle] = useState(selected?.title ?? '')
  const [description, setDescription] = useState(selected?.description ?? '')
  const [instruction, setInstruction] = useState('')
  const [articleLength, setArticleLength] = useState('standard')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateMessage, setGenerateMessage] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [advancedJson, setAdvancedJson] = useState(() => (
    selected ? JSON.stringify(selected.blocks, null, 2) : '[]'
  ))
  const hasAdvancedCards = useMemo(() => hasBlockCards(selected?.blocks), [selected?.blocks])

  const targetOptions = articleType === 'card_article'
    ? cardOptions.map(option => ({ value: option.slug, label: formatCardOption(option) }))
    : packOptions.map(option => ({ value: option.slug, label: formatPackOption(option) }))
  const hasCurrentTarget = targetOptions.some(option => option.value === targetId)

  function updateArticleType(next: ZukanArticleTargetType) {
    const nextTarget = next === 'card_article'
      ? cardOptions[0]?.slug ?? ''
      : packOptions[0]?.slug ?? 'dm-01'
    setArticleType(next)
    setTargetId(nextTarget)
    setSlug(current => current && current !== targetId ? current : nextTarget)
  }

  function updateTarget(next: string) {
    setTargetId(next)
    setSlug(current => current && current !== targetId ? current : next)
  }

  async function generateArticleBody() {
    setIsGenerating(true)
    setGenerateMessage(null)
    setGenerateError(null)

    try {
      const response = await fetch('/api/admin/zukan/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: articleType,
          target_id: targetId,
          title,
          description,
          instruction,
          article_length: articleLength,
        }),
      })
      const data = await response.json().catch(() => null) as { body_blocks?: unknown; error?: string } | null
      if (!response.ok || !data) {
        throw new Error(data?.error ?? 'AI記事本文の作成に失敗しました')
      }
      if (!Array.isArray(data.body_blocks)) {
        throw new Error('AI生成結果を本文ブロックとして読み取れませんでした')
      }
      setArticleText(blocksToArticleText(data.body_blocks))
      setAdvancedJson(JSON.stringify(data.body_blocks, null, 2))
      setGenerateMessage('AI生成結果を記事本文に反映しました。まだ保存はしていません。内容を確認してから保存してください。')
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : 'AI記事本文の作成に失敗しました')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <form action={saveZukanArticle} className="space-y-4 px-3 py-3">
      <input type="hidden" name="id" value={selected?.id ?? ''} />
      <input type="hidden" name="blocks_json" value={advancedJson} />

      <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900">
        ここでは、思い出図鑑のパックページやカードページに表示する読み物記事を作成できます。
        まず記事の種類を選び、対象パックまたは対象カードを選択し、タイトル・説明文・本文を入力して公開します。
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold text-gray-700">
          記事の種類
          <select
            name="article_type"
            value={articleType}
            onChange={event => updateArticleType(event.target.value as ZukanArticleTargetType)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
          >
            <option value="pack_article">{articleTypeLabel('pack_article')}</option>
            <option value="card_article">{articleTypeLabel('card_article')}</option>
            {articleType === 'hall_of_fame_article' && (
              <option value="hall_of_fame_article">{articleTypeLabel('hall_of_fame_article')}</option>
            )}
          </select>
          <span className="mt-1 block text-[11px] font-normal leading-relaxed text-gray-500">
            この記事を、パックページ用に作るか、カードページ用に作るかを選びます。
          </span>
        </label>

        <label className="block text-xs font-bold text-gray-700">
          対象パック / 対象カード
          {articleType === 'hall_of_fame_article' ? (
            <input name="target_id" value={targetId} onChange={event => updateTarget(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
          ) : (
            <select
              name="target_id"
              value={targetId}
              onChange={event => updateTarget(event.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
            >
              {!hasCurrentTarget && targetId && <option value={targetId}>現在の値（{targetId}）</option>}
              {targetOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}
        </label>
      </div>

      <label className="block text-xs font-bold text-gray-700">
        記事URL slug
        <input name="slug" value={slug} onChange={event => setSlug(event.target.value)} placeholder="dm-01" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
      </label>

      <label className="block text-xs font-bold text-gray-700">
        タイトル
        <input name="title" value={title} onChange={event => setTitle(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
      </label>

      <label className="block text-xs font-bold text-gray-700">
        説明文
        <textarea name="description" value={description} onChange={event => setDescription(event.target.value)} rows={2} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
      </label>

      <label className="block text-xs font-bold text-gray-700">
        公開状態
        <select name="status" defaultValue={selected?.status ?? 'draft'} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs">
          <option value="draft">{statusLabel('draft')}</option>
          <option value="published">{statusLabel('published')}</option>
          <option value="archived">{statusLabel('archived')}</option>
        </select>
        <span className="mt-1 block text-[11px] font-normal leading-relaxed text-gray-500">
          選んだ状態で保存されます。公開中だけ記事ページに表示され、下書き・非公開 / 保管は管理画面だけに残ります。
        </span>
      </label>

      <section className="rounded border border-gray-200 bg-gray-50 px-3 py-3">
        <div>
          <h3 className="text-xs font-bold text-gray-700">AI記事作成補助</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
            指示をもとに記事本文ブロックを作成します。生成してもすぐには保存されません。
          </p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="block text-xs font-bold text-gray-700">
            AI記事作成指示
            <textarea
              value={instruction}
              onChange={event => setInstruction(event.target.value)}
              rows={4}
              placeholder="例：DM-01を当時遊んでいた人向けに、代表カードの思い出と今見た時の面白さを中心に書く"
              className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs leading-5"
            />
          </label>
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">
              記事の長さ
              <select value={articleLength} onChange={event => setArticleLength(event.target.value)} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs">
                <option value="short">{articleLengthLabel('short')}</option>
                <option value="standard">{articleLengthLabel('standard')}</option>
                <option value="long">{articleLengthLabel('long')}</option>
              </select>
            </label>
            <button
              type="button"
              onClick={generateArticleBody}
              disabled={isGenerating || !targetId || !title.trim()}
              className="w-full rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? '作成中...' : 'AIで記事本文を作成'}
            </button>
          </div>
        </div>
        {generateMessage && <p className="mt-2 text-[11px] font-bold leading-relaxed text-green-700">{generateMessage}</p>}
        {generateError && <p className="mt-2 text-[11px] font-bold leading-relaxed text-red-700">{generateError}</p>}
      </section>

      <section className="space-y-2">
        <div>
          <h3 className="text-xs font-bold text-gray-700">記事本文</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
            記事本文をそのまま入力します。段落は改行で区切れます。
          </p>
        </div>
        {hasAdvancedCards && (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
            この記事にはカード表示ブロックがあります。通常の本文欄には出していませんが、保存時に上級者向けJSON側から引き継がれます。
          </p>
        )}
        <textarea
          name="body_text"
          value={articleText}
          onChange={event => setArticleText(event.target.value)}
          rows={18}
          placeholder="記事本文を入力"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm leading-7"
        />
      </section>

      <details className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-bold text-gray-700">上級者向け：本文ブロックJSON</summary>
        <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
          記事本文をブロック形式で保存するための内部データです。通常は直接編集しなくてOKです。
        </p>
        <textarea
          value={advancedJson}
          onChange={event => setAdvancedJson(event.target.value)}
          rows={14}
          spellCheck={false}
          className="mt-2 w-full rounded border border-gray-300 px-2 py-2 font-mono text-[11px] leading-5"
        />
      </details>

      <div className="flex flex-wrap gap-2">
        <button name="intent" value="save" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50">
          保存
        </button>
      </div>
    </form>
  )
}
