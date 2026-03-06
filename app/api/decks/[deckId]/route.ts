import { z } from 'zod'

import { apiError, apiOk } from '@/lib/api/response'
import { getDeckById, updateDeckTitle } from '@/lib/db/repository'
import { getAuthenticatedUser } from '@/lib/auth/user'

const paramsSchema = z.object({
	deckId: z.uuid(),
})

const updateDeckSchema = z.object({
	title: z.string().trim().min(1).max(120),
})

type RouteContext = {
	params: Promise<{ deckId: string }>
}

export async function GET(_: Request, context: RouteContext) {
	const params = await context.params
	const parsedParams = paramsSchema.safeParse(params)
	if (!parsedParams.success) {
		return apiError('Invalid deck id', 'INVALID_DECK_ID', 400)
	}

	const user = await getAuthenticatedUser()
	if (!user) {
		return apiError('Unauthorized', 'UNAUTHORIZED', 401)
	}

	try {
		const deck = await getDeckById(parsedParams.data.deckId, user.id)
		if (!deck) {
			return apiError('Deck not found', 'DECK_NOT_FOUND', 404)
		}

		return apiOk({ deck })
	} catch {
		return apiError('Failed to load deck', 'LOAD_DECK_FAILED', 500)
	}
}

export async function PATCH(request: Request, context: RouteContext) {
	const params = await context.params
	const parsedParams = paramsSchema.safeParse(params)
	if (!parsedParams.success) {
		return apiError('Invalid deck id', 'INVALID_DECK_ID', 400)
	}

	let payload: unknown
	try {
		payload = await request.json()
	} catch {
		return apiError('Invalid JSON payload', 'INVALID_PAYLOAD', 400)
	}

	const parsedPayload = updateDeckSchema.safeParse(payload)
	if (!parsedPayload.success) {
		return apiError('Expected payload: { title: string }', 'INVALID_PAYLOAD', 400)
	}

	const user = await getAuthenticatedUser()
	if (!user) {
		return apiError('Unauthorized', 'UNAUTHORIZED', 401)
	}

	try {
		const deck = await updateDeckTitle(parsedParams.data.deckId, parsedPayload.data.title, user.id)
		if (!deck) {
			return apiError('Deck not found', 'DECK_NOT_FOUND', 404)
		}

		return apiOk({ deck })
	} catch {
		return apiError('Failed to update deck', 'UPDATE_DECK_FAILED', 500)
	}
}
