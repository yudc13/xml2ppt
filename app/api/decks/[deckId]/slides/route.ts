import { z } from 'zod'

import { apiError, apiOk } from '@/lib/api/response'
import { resolveDeckAccess } from '@/lib/auth/deck-access'
import { createSlide, getSlidesByDeckId } from '@/lib/db/repository'
import { getAuthenticatedUser } from '@/lib/auth/user'

const paramsSchema = z.object({
	deckId: z.uuid(),
})

const createSlideSchema = z.object({
	xmlContent: z.string().min(1).optional(),
	position: z.number().int().min(1).optional(),
})

type RouteContext = {
	params: Promise<{ deckId: string }>
}

export async function GET(_: Request, context: RouteContext) {
	const user = await getAuthenticatedUser()
	if (!user) {
		return apiError('Unauthorized', 'UNAUTHORIZED', 401)
	}

	const params = await context.params
	const parsedParams = paramsSchema.safeParse(params)
	if (!parsedParams.success) {
		return apiError('Invalid deck id', 'INVALID_DECK_ID', 400)
	}

	try {
		const access = await resolveDeckAccess(parsedParams.data.deckId, user.id)
		if (!access.canView) {
			return apiError('Deck not found', 'DECK_NOT_FOUND', 404)
		}

		const slides = await getSlidesByDeckId(parsedParams.data.deckId)
		return apiOk({ slides })
	} catch {
		return apiError('Failed to load slides', 'LOAD_SLIDES_FAILED', 500)
	}
}

export async function POST(request: Request, context: RouteContext) {
	const user = await getAuthenticatedUser()
	if (!user) {
		return apiError('Unauthorized', 'UNAUTHORIZED', 401)
	}

	const params = await context.params
	const parsedParams = paramsSchema.safeParse(params)
	if (!parsedParams.success) {
		return apiError('Invalid deck id', 'INVALID_DECK_ID', 400)
	}

	let payload: unknown
	try {
		payload = await request.json()
	} catch {
		payload = {}
	}

	const parsedPayload = createSlideSchema.safeParse(payload)
	if (!parsedPayload.success) {
		return apiError('Invalid payload', 'INVALID_PAYLOAD', 400)
	}

	try {
		const access = await resolveDeckAccess(parsedParams.data.deckId, user.id)
		if (!access.canEdit) {
			return apiError('Forbidden', 'FORBIDDEN', 403)
		}

		const slide = await createSlide(
			parsedParams.data.deckId,
			parsedPayload.data.xmlContent,
			user.id,
			parsedPayload.data.position
		)
		if (!slide) {
			return apiError('Deck not found', 'DECK_NOT_FOUND', 404)
		}

		return apiOk({ slide }, 201)
	} catch {
		return apiError('Failed to create slide', 'CREATE_SLIDE_FAILED', 500)
	}
}
