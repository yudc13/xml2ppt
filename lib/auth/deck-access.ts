import { getDeckAccessRole, type DeckAccessRole } from '@/lib/db/repository'

export type DeckAccess = {
	canView: boolean
	canComment: boolean
	canEdit: boolean
	role: DeckAccessRole | null
	source: 'owner' | 'member' | 'none'
}

export async function resolveDeckAccess(deckId: string, userId: string): Promise<DeckAccess> {
	const role = await getDeckAccessRole(deckId, userId)

	if (!role) {
		return {
			canView: false,
			canComment: false,
			canEdit: false,
			role: null,
			source: 'none',
		}
	}

	return {
		canView: true,
		canComment: role === 'owner' || role === 'editor' || role === 'commenter',
		canEdit: role === 'owner' || role === 'editor',
		role,
		source: role === 'owner' ? 'owner' : 'member',
	}
}
