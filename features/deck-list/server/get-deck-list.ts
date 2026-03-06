import { listDecks } from '@/lib/db/repository'
import { getAuthenticatedUser } from '@/lib/auth/user'

import type { DeckItem } from '@/features/deck-list/types'

export async function getDeckList(): Promise<DeckItem[]> {
	const user = await getAuthenticatedUser()
	if (!user) return []

	const decks = await listDecks(user.id)

	return decks.map((deck) => ({
		id: deck.id,
		title: deck.title,
		createdAt: deck.createdAt.toISOString(),
		updatedAt: deck.updatedAt.toISOString(),
	}))
}
