'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import type { ZukanArticleStatus, ZukanArticleTargetType } from '@/lib/zukan-articles'
import { zukanArticleBlocksToBodyText } from '@/lib/zukan-article-markdown'
import { buildDefaultArticleSlug } from '@/lib/zukan-article-slug'
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

function errorMessage(error: string) {
  if (error === 'invalid_type') return '記事の種類が正しくありません。'
  if (error === 'missing_target') return '対象パック / 対象カードを選択してください。'
  if (error === 'missing_blocks') return '記事本文を入力してください。'
  if (error === 'missing_title') return 'タイトルを入力してください。'
  if (error === 'existing_target') {
    return 'この対象の記事はすでに存在します。右の記事一覧から既存記事を編集してください。'
  }
  if (error === 'existing_slug' || error === 'duplicate_slug') {
    return '同じ記事URL slugの記事がすでに存在します。既存記事を編集するか、上級者向け欄で別のslugを指定してください。'
  }
  if (error === 'missing_slug') return '記事URL slugを自動生成できませんでした。タイトルを入力して保存してください。'
  return error
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
  const [actionState, formAction, isPending] = useActionState(saveZukanArticle, {})
  const [articleType, setArticleType] = useState<ZukanArticleTargetType>(selected?.article_type ?? 'pack_article')
  const [targetId, setTargetId] = useState(selected?.target_id ?? packOptions[0]?.slug ?? 'dm-01')
  const [slug, setSlug] = useState(selected?.slug ?? buildDefaultArticleSlug({
    articleType: selected?.article_type ?? 'pack_article',
    targetId: selected?.target_id ?? packOptions[0]?.slug ?? 'dm-01',
    title: selected?.title,
  }))
  const [slugTouched, setSlugTouched] = useState(!!selected)
  const [articleText, setArticleText] = useState(() => zukanArticleBlocksToBodyText(selected?.blocks, selected?.target_id))
  const [title, setTitle] = useState(selected?.title ?? '')
  const [description, setDescription] = useState(selected?.description ?? '')
  const [status, setStatus] = useState<ZukanArticleStatus>(selected?.status ?? 'draft')
  const [advancedJson, setAdvancedJson] = useState(() => (
    selected ? JSON.stringify(selected.blocks, null, 2) : '[]'
  ))

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
    if (!selected && !slugTouched) {
      setSlug(buildDefaultArticleSlug({ articleType: next, targetId: nextTarget, title }))
    }
  }

  function updateTarget(next: string) {
    setTargetId(next)
    if (!selected && !slugTouched) {
      setSlug(buildDefaultArticleSlug({ articleType, targetId: next, title }))
    }
  }

  function updateTitle(next: string) {
    setTitle(next)
    if (!selected && !slugTouched && articleType !== 'pack_article' && articleType !== 'card_article') {
      setSlug(buildDefaultArticleSlug({ articleType, targetId, title: next }))
    }
  }

  return (
    <form action={formAction} className="space-y-4 px-3 py-3">
      <input type="hidden" name="id" value={selected?.id ?? ''} />

      {actionState.error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
          <span className="font-bold">保存できませんでした: </span>
          <span>{errorMessage(actionState.error)}</span>
          {actionState.existingId && (
            <Link href={`/admin/zukan/articles?edit=${encodeURIComponent(actionState.existingId)}&preview=1`} className="ml-2 font-bold text-blue-700 hover:underline">
              既存記事を編集する →
            </Link>
          )}
        </div>
      )}

      <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900">
        ここでは、思い出図鑑のパックページやカードページに表示する読み物記事を作成できます。
        ChatGPTで作ったタイトル・説明文・本文を貼り付け、保存すると本文が自動で内部ブロックに変換されます。
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
        タイトル
        <input name="title" value={title} onChange={event => updateTitle(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
      </label>

      <label className="block text-xs font-bold text-gray-700">
        説明文
        <textarea name="description" value={description} onChange={event => setDescription(event.target.value)} rows={2} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
      </label>

      <label className="block text-xs font-bold text-gray-700">
        公開状態
        <select name="status" value={status} onChange={event => setStatus(event.target.value as ZukanArticleStatus)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-xs">
          <option value="draft">{statusLabel('draft')}</option>
          <option value="published">{statusLabel('published')}</option>
          <option value="archived">{statusLabel('archived')}</option>
        </select>
        <span className="mt-1 block text-[11px] font-normal leading-relaxed text-gray-500">
          選んだ状態で保存されます。公開中だけ記事ページに表示され、下書き・非公開 / 保管は管理画面だけに残ります。
        </span>
      </label>

      <section className="space-y-2">
        <div>
          <h3 className="text-xs font-bold text-gray-700">記事本文</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
            Markdown風の本文を貼り付けます。# 見出し、{'{{PACK:dm-01}}'}、{'{{CARD:bolshack-dragon}}'}、{'{{CARDGRID: ... }}'} が使えます。
          </p>
        </div>
        <textarea
          name="body_text"
          value={articleText}
          onChange={event => setArticleText(event.target.value)}
          rows={18}
          placeholder={`# デュエマのすべてはここから始まった

DM-01は...

{{PACK:dm-01}}

ボルシャック・ドラゴンは...

{{CARD:bolshack-dragon}}

代表カードはこちら。

{{CARDGRID:
demon-hand
holy-spark
natural-trap
}}`}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm leading-7"
        />
      </section>

      <details className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-bold text-gray-700">上級者向け：URL slug / 本文ブロックJSON</summary>
        <label className="mt-3 block text-xs font-bold text-gray-700">
          記事URL slug
          <input
            name="slug"
            value={slug}
            onChange={event => {
              setSlugTouched(true)
              setSlug(event.target.value)
            }}
            placeholder="自動設定されます"
            className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
          />
          <span className="mt-1 block text-[11px] font-normal leading-relaxed text-gray-500">
            新規作成では対象パック / 対象カードから自動設定されます。必要な場合のみ変更してください。
          </span>
        </label>
        <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
          記事本文をブロック形式で保存するための内部データです。通常は直接編集しなくてOKです。
        </p>
        <textarea
          name="blocks_json"
          value={advancedJson}
          onChange={event => setAdvancedJson(event.target.value)}
          rows={14}
          spellCheck={false}
          className="mt-2 w-full rounded border border-gray-300 px-2 py-2 font-mono text-[11px] leading-5"
        />
      </details>

      <div className="flex flex-wrap gap-2">
        <button name="intent" value="save" disabled={isPending} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          {isPending ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  )
}
