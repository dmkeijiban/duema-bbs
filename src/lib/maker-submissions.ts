import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase-admin'
import { makerCommunityLabel, parseMakerProjectConfig, parseSelectMakerConfig } from '@/lib/maker'
import { getMakerAnonymousEditHash } from '@/lib/maker-anonymous-owner'
import { resolveSelectPrintingImages, selectPrintingRefKey } from '@/lib/maker-select-printing'

export type PublicMakerProject = { id: string; slug: string; title: string; type: string; config: unknown }
export type PublicSubmission = {
  id: string; title: string; comment: string | null; thumbnail_url: string | null; created_at: string
  user_id: string | null; authorName: string; items: { card_id: string; group_key: string; position: number; card: { name: string; image_url: string | null; regulation: string | null } }[]
}

export const getPublicMakerProject = cache(async (slug: string) => {
  const admin = createAdminClient()
  const { data } = await admin.from('maker_projects').select('id,slug,title,type,config').eq('slug', slug).eq('is_public', true).eq('status', 'published').maybeSingle()
  return data as PublicMakerProject | null
})

function visibleProfile(profile: Record<string, unknown> | null) {
  return profile && profile.account_suspended !== true && profile.profile_hidden !== true && !profile.withdrawn_at
}

async function hydrate(projectId: string, submissionRows: Record<string, unknown>[]): Promise<PublicSubmission[]> {
  if (!submissionRows.length) return []
  const admin = createAdminClient()
  const ids = submissionRows.map(row => String(row.id))
  const userIds = [...new Set(submissionRows.map(row => row.user_id).filter((id): id is string => typeof id === 'string'))]
  const [{ data: items }, { data: profiles }] = await Promise.all([
    admin.from('maker_submission_items').select('submission_id,card_id,group_key,position,source_key,face_side_index,cards(name,image_url,regulation)').in('submission_id', ids).order('position'),
    userIds.length ? admin.from('profiles').select('id,display_name,profile_hidden,account_suspended,withdrawn_at').in('id', userIds) : Promise.resolve({ data: [] }),
  ])
  const profilesById = new Map((profiles ?? []).map(profile => [profile.id, profile as Record<string, unknown>]))
  const typedItems = (items ?? []) as unknown as { submission_id: string; card_id: string; group_key: string; position: number; source_key: string | null; face_side_index: number | null; cards: { name: string; image_url: string | null; regulation: string | null } | { name: string; image_url: string | null; regulation: string | null }[] | null }[]
  const resolvedPrintings = await resolveSelectPrintingImages(typedItems.map(item => ({ cardId: item.card_id, sourceKey: item.source_key, faceSideIndex: item.face_side_index })))
  const itemsBySubmission = new Map<string, PublicSubmission['items']>()
  for (const item of typedItems) {
    const cardValue = item.cards
    const card = (Array.isArray(cardValue) ? cardValue[0] : cardValue)
    if (!card) continue
    const printing = resolvedPrintings.get(selectPrintingRefKey({ cardId: item.card_id, sourceKey: item.source_key, faceSideIndex: item.face_side_index }))
    const resolvedCard = printing ? { ...card, image_url: printing.imageUrl ?? card.image_url } : card
    const list = itemsBySubmission.get(item.submission_id) ?? []
    list.push({ card_id: item.card_id, group_key: item.group_key, position: item.position, card: resolvedCard })
    itemsBySubmission.set(item.submission_id, list)
  }
  return submissionRows.flatMap(row => {
    const userId = typeof row.user_id === 'string' ? row.user_id : null
    const profile = userId ? profilesById.get(userId) ?? null : null
    if (userId && !visibleProfile(profile)) return []
    return [{ ...row, user_id: userId, authorName: userId ? String(profile?.display_name || 'デュエマプレイヤー') : '名無しのデュエリスト', items: itemsBySubmission.get(String(row.id)) ?? [] } as PublicSubmission]
  })
}

export async function getPublicSubmissions(projectId: string, page = 1, pageSize = 30) {
  const admin = createAdminClient()
  const safePage = Math.max(1, page)
  const from = (safePage - 1) * pageSize
  const to = from + pageSize

  // 非公開・停止・退会済みプロフィールの投稿をページ取得後に除外すると、
  // 12件枠なのに11件しか表示されない空白が生まれる。
  // 先に公開対象だけへ絞り、その結果をページングして常に表示枠を埋める。
  const { data: candidates } = await admin
    .from('maker_submissions')
    .select('id,user_id,title,comment,thumbnail_url,created_at')
    .eq('project_id', projectId)
    .eq('is_valid', true)
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  const rows = (candidates ?? []) as Record<string, unknown>[]
  if (!rows.length) return { submissions: [] as PublicSubmission[], total: 0 }

  const userIds = [...new Set(rows.map(row => row.user_id).filter((id): id is string => typeof id === 'string'))]
  const { data: profiles } = userIds.length
    ? await admin.from('profiles').select('id,profile_hidden,account_suspended,withdrawn_at').in('id', userIds)
    : { data: [] }
  const profilesById = new Map((profiles ?? []).map(profile => [profile.id, profile as Record<string, unknown>]))
  const visibleRows = rows.filter(row => {
    const userId = typeof row.user_id === 'string' ? row.user_id : null
    return !userId || visibleProfile(profilesById.get(userId) ?? null)
  })

  return {
    submissions: await hydrate(projectId, visibleRows.slice(from, to)),
    total: visibleRows.length,
  }
}

// 現在の利用者（ログインユーザー or 匿名Cookie所有者）が登録した公開投稿を新着順で返す
export async function getOwnedPublicSubmissions(projectId: string, userId: string | null) {
  const editHash = await getMakerAnonymousEditHash()
  if (!userId && !editHash) return []
  const ownerConditions: string[] = []
  if (userId) ownerConditions.push(`user_id.eq.${userId}`)
  if (editHash) ownerConditions.push(`and(user_id.is.null,anonymous_edit_token_hash.eq.${editHash})`)
  const admin = createAdminClient()
  const { data } = await admin
    .from('maker_submissions')
    .select('id,user_id,title,comment,thumbnail_url,created_at')
    .eq('project_id', projectId)
    .eq('is_valid', true)
    .eq('is_public', true)
    .or(ownerConditions.join(','))
    .order('created_at', { ascending: false })
  return hydrate(projectId, (data ?? []) as Record<string, unknown>[])
}

export type SelectMakerAggregateEntry = {
  cardId: string
  name: string
  imageUrl: string | null
  selectionCount: number
  rank: number
}

// SELECT型の集計。maker_select_aggregatesビュー（card_id単位・1投稿1票でDB側集計）を利用する
export async function getSelectMakerAggregates(projectId: string): Promise<{ total: number; entries: SelectMakerAggregateEntry[] }> {
  const admin = createAdminClient()
  const [{ data: rows }, { count }] = await Promise.all([
    admin.from('maker_select_aggregates').select('card_id,name,selection_count').eq('project_id', projectId)
      .order('selection_count', { ascending: false }).order('name').order('card_id'),
    admin.from('maker_submissions').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('is_valid', true).eq('is_public', true),
  ])
  const typedRows = (rows ?? []) as { card_id: string; name: string; selection_count: number }[]
  const cardIds = typedRows.map(row => row.card_id)
  // カードIDが多いプロジェクト（全カードプール等）では.in()を分割しないとクエリが失敗しうるため、
  // campaign-ranking.tsと同様に500件ずつチャンクして取得する
  const cards: { id: string; image_url: string | null }[] = []
  const printings: { card_id: string; image_url: string | null }[] = []
  for (let i = 0; i < cardIds.length; i += 500) {
    const chunk = cardIds.slice(i, i + 500)
    const [{ data: cardRows, error: cardsError }, { data: printingRows, error: printingsError }] = await Promise.all([
      admin.from('cards').select('id,image_url').in('id', chunk),
      admin.from('card_printings').select('card_id,image_url').in('card_id', chunk).not('image_url', 'is', null).order('created_at', { ascending: false }),
    ])
    if (cardsError) console.error('getSelectMakerAggregates: cards fetch failed', cardsError)
    if (printingsError) console.error('getSelectMakerAggregates: card_printings fetch failed', printingsError)
    cards.push(...(cardRows ?? []))
    printings.push(...(printingRows ?? []))
  }
  const printingImageByCardId = new Map<string, string>()
  for (const printing of printings) {
    if (printing.image_url && !printingImageByCardId.has(printing.card_id)) printingImageByCardId.set(printing.card_id, printing.image_url)
  }
  const imageByCardId = new Map(cards.map(card => [card.id, card.image_url ?? printingImageByCardId.get(card.id) ?? null]))
  let rank = 0
  let previousCount = Number.NEGATIVE_INFINITY
  const entries = typedRows.map((row, index) => {
    if (row.selection_count !== previousCount) {
      rank = index + 1
      previousCount = row.selection_count
    }
    return { cardId: row.card_id, name: row.name, imageUrl: imageByCardId.get(row.card_id) ?? null, selectionCount: row.selection_count, rank }
  })
  return { total: count ?? 0, entries }
}

export async function getPublicSubmission(projectId: string, id: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('maker_submissions').select('id,user_id,title,comment,thumbnail_url,created_at').eq('id', id).eq('project_id', projectId).eq('is_valid', true).eq('is_public', true).maybeSingle()
  if (!data) return null
  return (await hydrate(projectId, [data as Record<string, unknown>]))[0] ?? null
}

export function makerSubmissionView(project: PublicMakerProject) {
  if (project.type === 'select') {
    const selectConfig = parseSelectMakerConfig(project.config)
    const resultTitle = project.slug === 'my-duema-9'
      ? '私を象徴するデュエマカード9選'
      : selectConfig.resultTitle
    return {
      config: {
        groups: [{ key: 'selected', label: '選択カード', color: 'border-slate-300 bg-white text-slate-900' }],
        unrated: false,
        allowDuplicates: false,
        ordered: true,
        overwrite: false,
        maxChoices: null,
        defaultTitle: selectConfig.defaultTitle,
      },
      communityLabel: makerCommunityLabel(project.type),
      resultTitle,
    }
  }
  return { config: parseMakerProjectConfig(project.config), communityLabel: makerCommunityLabel(project.type), resultTitle: project.title }
}
