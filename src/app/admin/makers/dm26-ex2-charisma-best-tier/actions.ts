'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { parseMakerProjectConfig } from '@/lib/maker'
import { TIER_GROUPS } from '@/lib/maker'
import { normalizeCardName } from '@/lib/card-import'
import { assertPreviewDatabaseTarget } from '@/lib/preview-safety'
import officialCardsJson from '../../../../../scripts/fixtures/dm26-ex2-standard-89.import-candidates.json'

const PROJECT_SLUG = 'dm26-ex2-charisma-best-tier'
const PROJECT_CONFIG = { groups: TIER_GROUPS, unrated: true, allowDuplicates: false, ordered: true, overwrite: true, maxChoices: null }
type OfficialCard = { card_number: string; card_name: string; image_url: string | null; civilization: string[] | null; cost: number | null; card_type: string | null }

function revalidateTierPages() {
  revalidatePath('/admin/makers/dm26-ex2-charisma-best-tier')
  revalidatePath('/admin/tier-maker')
  revalidatePath('/makers/dm26-ex2-charisma-best-tier')
}

export async function initializeTierProjectAndPublish() {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) return { ok: false, message: '管理者認証が必要です' }

  try {
    const officialCards = officialCardsJson as OfficialCard[]
    const candidates = officialCards.map((card, index) => ({
      sortOrder: index + 1,
      name: card.card_name,
      normalizedName: normalizeCardName(card.card_name),
      imageUrl: card.image_url,
      civilization: card.civilization ?? [],
      cost: card.cost,
      cardType: card.card_type,
    }))
    const normalizedNames = candidates.map(card => card.normalizedName)
    if (candidates.length !== 89 || new Set(normalizedNames).size !== 89 || normalizedNames.some(name => !name)) {
      return { ok: false, message: '公式89枚データの件数または重複チェックに失敗しました' }
    }

    const admin = createAdminClient()
    const { data: existingCards, error: existingCardsError } = await admin.from('cards').select('id,normalized_name,is_active').in('normalized_name', normalizedNames)
    if (existingCardsError) return { ok: false, message: `カード確認に失敗しました: ${existingCardsError.message}` }
    if ((existingCards ?? []).some(card => card.is_active !== true)) return { ok: false, message: '対象カードに無効化済みデータがあるため公開を中止しました' }
    const existingNames = new Set((existingCards ?? []).map(card => card.normalized_name as string))
    const missingCards = candidates.filter(card => !existingNames.has(card.normalizedName))

    const { data: existingProject, error: projectLookupError } = await admin.from('maker_projects').select('id').eq('slug', PROJECT_SLUG).maybeSingle()
    if (projectLookupError) return { ok: false, message: `企画確認に失敗しました: ${projectLookupError.message}` }
    console.info('DM26-EX2 Tier project bootstrap plan', { slug: PROJECT_SLUG, officialCardCount: 89, existingCardCount: existingNames.size, cardsToInsert: missingCards.length, projectToInsert: existingProject ? 0 : 1 })

    if (missingCards.length > 0) {
      const { error } = await admin.from('cards').insert(missingCards.map(card => ({
        name: card.name,
        normalized_name: card.normalizedName,
        image_url: card.imageUrl,
        civilization: card.civilization,
        cost: card.cost,
        card_type: card.cardType,
        regulation: 'none',
        is_active: true,
      })))
      if (error) return { ok: false, message: `不足カードの登録に失敗しました: ${error.message}` }
    }

    let projectId = existingProject?.id as string | undefined
    if (!projectId) {
      const { data: createdProject, error } = await admin.from('maker_projects').insert({
        slug: PROJECT_SLUG,
        title: 'DM26-EX2 悪感謝祭 カリスマBEST Tier表',
        type: 'tier',
        status: 'draft',
        is_public: false,
        config: PROJECT_CONFIG,
      }).select('id').single()
      if (error || !createdProject) return { ok: false, message: `企画の作成に失敗しました: ${error?.message ?? 'unknown error'}` }
      projectId = createdProject.id as string
    }

    const { data: allCards, error: allCardsError } = await admin.from('cards').select('id,normalized_name').in('normalized_name', normalizedNames)
    if (allCardsError || allCards?.length !== 89) return { ok: false, message: '公式89枚のカードIDを確定できませんでした' }
    const cardIdByName = new Map(allCards.map(card => [card.normalized_name as string, card.id as string]))
    const { data: existingLinks, error: linksError } = await admin.from('maker_project_cards').select('card_id').eq('project_id', projectId)
    if (linksError) return { ok: false, message: `企画カード確認に失敗しました: ${linksError.message}` }
    const existingLinkIds = new Set((existingLinks ?? []).map(link => link.card_id as string))
    const missingLinks = candidates.flatMap(card => {
      const cardId = cardIdByName.get(card.normalizedName)
      return cardId && !existingLinkIds.has(cardId) ? [{ project_id: projectId, card_id: cardId, sort_order: card.sortOrder }] : []
    })
    console.info('DM26-EX2 Tier project link plan', { slug: PROJECT_SLUG, existingLinkCount: existingLinkIds.size, linksToInsert: missingLinks.length })
    if (missingLinks.length > 0) {
      const { error } = await admin.from('maker_project_cards').insert(missingLinks)
      if (error) return { ok: false, message: `カード紐付けに失敗しました: ${error.message}` }
    }

    const { data: verifiedLinks, error: verifyError } = await admin.from('maker_project_cards').select('card_id').eq('project_id', projectId)
    const expectedIds = new Set(cardIdByName.values())
    if (verifyError || verifiedLinks?.length !== 89 || verifiedLinks.some(link => !expectedIds.has(link.card_id as string))) {
      return { ok: false, message: '企画カードが公式89枚と一致しないため公開を中止しました' }
    }

    const { error: publishError } = await admin.from('maker_projects').update({ status: 'published', is_public: true, updated_at: new Date().toISOString() }).eq('id', projectId).eq('slug', PROJECT_SLUG)
    if (publishError) return { ok: false, message: `公開状態の更新に失敗しました: ${publishError.message}` }
    revalidateTierPages()
    return { ok: true, message: 'Tier表メーカーを公開しました' }
  } catch (error) {
    const message = error instanceof Error ? error.message : '企画データを準備できませんでした'
    console.error('initializeTierProjectAndPublish failed', { slug: PROJECT_SLUG, message })
    return { ok: false, message }
  }
}

export async function setTierProjectVisibility(isPublic: boolean) {
  if (typeof isPublic !== 'boolean') return { ok: false, message: '公開状態が不正です' }
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return { ok: false, message: '管理者認証が必要です' }
  }

  try {
    const admin = createAdminClient()
    if (isPublic) {
      const { data: project, error: projectError } = await admin.from('maker_projects').select('id').eq('slug', PROJECT_SLUG).single()
      if (projectError || !project) return { ok: false, message: '企画データが未登録です' }
      const { data: links, error: linksError } = await admin.from('maker_project_cards').select('card_id,cards!inner(is_active)').eq('project_id', project.id)
      const ready = !linksError && links?.length === 89 && links.every(link => (link.cards as unknown as { is_active: boolean }).is_active === true)
      if (!ready) return { ok: false, message: '公式89枚の企画カードが揃っていないため公開できません' }
    }
    const { data, error } = await admin
      .from('maker_projects')
      .update({
        is_public: isPublic,
        status: isPublic ? 'published' : 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('slug', PROJECT_SLUG)
      .select('id')
      .single()

    if (error || !data) return { ok: false, message: '公開状態を更新できませんでした' }
    revalidateTierPages()
    return { ok: true, message: isPublic ? 'Tier表メーカーを公開しました' : 'Tier表メーカーを非公開にしました' }
  } catch (error) {
    const message = error instanceof Error ? error.message : '公開状態を更新できませんでした'
    console.error('setTierProjectVisibility failed', { message })
    return { ok: false, message }
  }
}

export async function saveTierSubmission(payload: Record<string, string[]>) {
  try {
    assertPreviewDatabaseTarget()

    if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) {
      return { ok: false, message: '管理者認証が必要です' }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, message: 'ログインが必要です' }

    const admin = createAdminClient()
    const { data: project, error: projectError } = await admin
      .from('maker_projects')
      .select('id,config')
      .eq('slug', PROJECT_SLUG)
      .single()

    if (projectError || !project) return { ok: false, message: '企画が未準備です' }

    const config = parseMakerProjectConfig(project.config)
    const allowed = new Set(config.groups.map(group => group.key))
    const unknownGroups = Object.keys(payload).filter(group => !allowed.has(group))
    if (unknownGroups.length > 0) {
      return { ok: false, message: `不正なTierが含まれています: ${unknownGroups.join(', ')}` }
    }

    const items = Object.entries(payload).flatMap(([groupKey, ids]) =>
      ids.map((cardId, position) => ({ card_id: cardId, group_key: groupKey, position })),
    )

    const seen = new Set<string>()
    if (!config.allowDuplicates && items.some(item => seen.has(item.card_id) || !seen.add(item.card_id))) {
      return { ok: false, message: '同じカードは複数配置できません' }
    }
    if (config.maxChoices !== null && items.length > config.maxChoices) {
      return { ok: false, message: `選択できるカードは最大${config.maxChoices}枚です` }
    }

    const { error } = await admin.rpc('save_maker_submission', {
      p_project_id: project.id,
      p_user_id: user.id,
      p_items: items,
    })
    if (error) return { ok: false, message: `保存に失敗しました: ${error.message}` }

    return { ok: true, message: 'Tier表を上書き保存しました' }
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存に失敗しました'
    console.error('saveTierSubmission failed', { message })
    return { ok: false, message }
  }
}
