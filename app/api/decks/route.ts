import { z } from 'zod'

import { apiError, apiOk } from '@/lib/api/response'
import { createDeck, listDecks } from '@/lib/db/repository'
import { getAuthenticatedUser } from '@/lib/auth/user'

const createDeckSchema = z.object({
	title: z.string().trim().min(1).max(120).optional(),
})

export async function GET() {
	const user = await getAuthenticatedUser()
	if (!user) {
		return apiError('Unauthorized', 'UNAUTHORIZED', 401)
	}

	try {
		const decks = await listDecks(user.id)
		return apiOk({ decks })
	} catch {
		return apiError('Failed to load decks', 'LOAD_DECKS_FAILED', 500)
	}
}

export async function POST(request: Request) {
	let payload: unknown

	try {
		payload = await request.json()
	} catch {
		payload = {}
	}

	const parsed = createDeckSchema.safeParse(payload)
	if (!parsed.success) {
		return apiError('Invalid payload', 'INVALID_PAYLOAD', 400)
	}

	const title = parsed.data.title ?? '未命名演示文稿'

	const user = await getAuthenticatedUser()
	if (!user) {
		return apiError('Unauthorized', 'UNAUTHORIZED', 401)
	}

	try {
		const deck = await createDeck(title, user.id)
		return apiOk({ deck }, 201)
	} catch {
		return apiError('Failed to create deck', 'CREATE_DECK_FAILED', 500)
	}
}
