import { createAdminClient } from '@/lib/supabase-admin'
import { getOwnedPublicSubmissions, getPublicMakerProject, type PublicSubmission } from '@/lib/maker-submissions'
import { getRepresentativeId } from '@/lib/user-content-representatives'
import type { PublicDeckCardData } from '@/components/deck/PublicDeckCard'

export async function getMyCreatedContent(userId: string): Promise<{
  nine: { representative: PublicSubmission | null; count: number }
  deck: { representative: PublicDeckCardData | null; count: number }
}> {
  const project = await getPublicMakerProject('my-duema-9')
  const admin = createAdminClient()
  const [nineRows, deckResult, nineRepresentativeId, deckRepresentativeId] = await Promise.all([
    project ? getOwnedPublicSubmissions(project.id, userId) : Promise.resolve([]),
    admin.from('deck_submissions').select('id,user_id,title,format,deck_data,created_at').eq('user_id', userId).eq('format', 'original').order('created_at', { ascending: false }),
    getRepresentativeId(userId, 'my_duema_9'),
    getRepresentativeId(userId, 'deck'),
  ])
  const ownedNineRows = nineRows.filter(item => item.user_id === userId)
  const decks = (deckResult.data ?? []) as PublicDeckCardData[]
  return {
    nine: {
      representative: ownedNineRows.find(item => item.id === nineRepresentativeId) ?? ownedNineRows[0] ?? null,
      count: ownedNineRows.length,
    },
    deck: {
      representative: decks.find(item => item.id === deckRepresentativeId) ?? decks[0] ?? null,
      count: decks.length,
    },
  }
}
