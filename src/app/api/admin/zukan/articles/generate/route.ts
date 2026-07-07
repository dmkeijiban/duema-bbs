import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  normalizeZukanArticleTargetType,
  parseZukanArticleBlocks,
  type ZukanArticleBlock,
  type ZukanArticleTargetType,
} from '@/lib/zukan-articles'

export const runtime = 'nodejs'
export const maxDuration = 120

type ArticleLength = 'short' | 'standard' | 'long'

type GenerateRequest = {
  target_type?: unknown
  target_id?: unknown
  title?: unknown
  description?: unknown
  instruction?: unknown
  article_length?: unknown
}

type CardContext = {
  slug: string
  name: string
}

const LENGTH_RULES: Record<ArticleLength, string> = {
  short: '短め。本文全体は800〜1,200字を目安にする。',
  standard: '標準。本文全体は1,500〜2,200字を目安にする。',
  long: 'しっかり。本文全体は2,500〜3,500字を目安にする。',
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeArticleLength(value: unknown): ArticleLength {
  return value === 'short' || value === 'long' ? value : 'standard'
}

async function isAdmin() {
  const cookieStore = await cookies()
  return verifyAdminCookie(cookieStore.get('admin_auth')?.value)
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function pickJsonObject(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1))
    }
    throw new Error('AI生成結果をJSONとして読み取れませんでした')
  }
}

function bodyBlocksFromResponse(value: unknown): ZukanArticleBlock[] | null {
  const parsed = pickJsonObject(value)
  if (!parsed || typeof parsed !== 'object') return null
  const record = parsed as Record<string, unknown>
  const blocks = parseZukanArticleBlocks(record.body_blocks ?? record.blocks)
  if (!blocks) return null
  if (!blocks.every(block => block.type === 'heading' || block.type === 'paragraph' || block.type === 'card')) {
    return null
  }
  return blocks
}

async function loadCardContext(targetType: ZukanArticleTargetType, targetId: string) {
  const supabase = createAdminClient()

  if (targetType === 'pack_article') {
    const { data: pack, error: packError } = await supabase
      .from('zukan_packs')
      .select('id, slug, code, name')
      .eq('slug', targetId)
      .maybeSingle()
    if (packError) throw new Error(`対象パックの取得に失敗しました: ${packError.message}`)
    if (!pack) throw new Error('対象パックが見つかりません')

    const { data: cards, error: cardsError } = await supabase
      .from('zukan_cards')
      .select('slug, name')
      .eq('pack_id', pack.id)
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .limit(200)
    if (cardsError) throw new Error(`対象パックのカード取得に失敗しました: ${cardsError.message}`)

    return {
      targetLabel: `${pack.code} ${pack.name}`,
      cards: (cards ?? []) as CardContext[],
    }
  }

  if (targetType === 'card_article') {
    const { data: card, error: cardError } = await supabase
      .from('zukan_cards')
      .select('slug, name, pack_id')
      .eq('slug', targetId)
      .eq('is_published', true)
      .maybeSingle()
    if (cardError) throw new Error(`対象カードの取得に失敗しました: ${cardError.message}`)
    if (!card) throw new Error('対象カードが見つかりません')

    const { data: relatedCards } = await supabase
      .from('zukan_cards')
      .select('slug, name')
      .eq('pack_id', card.pack_id)
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .limit(80)

    return {
      targetLabel: `${card.name}（${card.slug}）`,
      cards: (relatedCards?.length ? relatedCards : [card]) as CardContext[],
    }
  }

  return {
    targetLabel: targetId,
    cards: [] as CardContext[],
  }
}

function validateCardBlocks(blocks: ZukanArticleBlock[], allowedSlugs: Set<string>) {
  for (const block of blocks) {
    if (block.type !== 'card') continue
    const slug = block.slug ?? block.id ?? ''
    if (!slug || !allowedSlugs.has(slug)) {
      throw new Error(`存在しないカードslugが含まれています: ${slug || '(空)'}`)
    }
  }
}

function buildPrompt({
  targetType,
  targetId,
  targetLabel,
  title,
  description,
  instruction,
  articleLength,
  cards,
}: {
  targetType: ZukanArticleTargetType
  targetId: string
  targetLabel: string
  title: string
  description: string
  instruction: string
  articleLength: ArticleLength
  cards: CardContext[]
}) {
  return JSON.stringify({
    output_schema: {
      body_blocks: [
        { type: 'heading', level: 2, text: '見出し' },
        { type: 'paragraph', text: '本文' },
        { type: 'card', slug: 'allowed-card-slug-only', caption: '短い紹介文' },
      ],
    },
    target: {
      target_type: targetType,
      target_id: targetId,
      target_label: targetLabel,
      title,
      description,
      article_length: LENGTH_RULES[articleLength],
      instruction,
    },
    allowed_cards: cards.map(card => ({ slug: card.slug, name: card.name })),
    rules: [
      'JSON以外の説明文を混ぜない。',
      'トップレベルは {"body_blocks": [...]} のJSONオブジェクトにする。',
      'body_blocksには heading / paragraph / card のみを使う。',
      'headingは level: 2 のみを使う。',
      'cardブロックのslugはallowed_cardsに存在するslugだけを使う。',
      '存在しないslug、推測slug、画像ブロック、cardGrid、note、relatedLinks、packHeroは使わない。',
      '管理者がそのまま下書きとして使える自然な日本語にする。',
      'パックやカードの史実を断定しすぎず、分からないことは一般的な思い出・遊び心地の表現に留める。',
    ],
  })
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return jsonError('Unauthorized', 401)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return jsonError('AI生成にはAPIキー設定が必要です', 400)
  }

  const body = await request.json().catch(() => null) as GenerateRequest | null
  const targetType = normalizeZukanArticleTargetType(body?.target_type)
  const targetId = asText(body?.target_id).toLowerCase()
  const title = asText(body?.title)
  const description = asText(body?.description)
  const instruction = asText(body?.instruction)
  const articleLength = normalizeArticleLength(body?.article_length)

  if (!targetType) return jsonError('記事の種類を選択してください')
  if (!targetId) return jsonError('対象パック / 対象カードを選択してください')
  if (!title) return jsonError('タイトルを入力してください')

  try {
    const context = await loadCardContext(targetType, targetId)
    const prompt = buildPrompt({
      targetType,
      targetId,
      targetLabel: context.targetLabel,
      title,
      description,
      instruction,
      articleLength,
      cards: context.cards,
    })

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'あなたはデュエル・マスターズ専門掲示板の思い出図鑑記事を作る編集者です。返答は必ずJSONのみです。',
          },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!response.ok) {
      return jsonError(`AI生成に失敗しました: ${(await response.text()).slice(0, 300)}`, 502)
    }

    const result = await response.json()
    const content = result?.choices?.[0]?.message?.content
    const bodyBlocks = bodyBlocksFromResponse(content)
    if (!bodyBlocks) return jsonError('AI生成結果を本文ブロックとして読み取れませんでした', 502)

    validateCardBlocks(bodyBlocks, new Set(context.cards.map(card => card.slug)))

    return NextResponse.json({ body_blocks: bodyBlocks })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'AI生成に失敗しました', 500)
  }
}
