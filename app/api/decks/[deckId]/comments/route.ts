import { z } from 'zod'

import { apiError, apiOk } from '@/lib/api/response'
import { resolveDeckAccess } from '@/lib/auth/deck-access'
import { getAuthenticatedUser } from '@/lib/auth/user'
import { createComment, listCommentCountsBySlide, listCommentsBySlide } from '@/lib/db/repository'

const paramsSchema = z.object({
	deckId: z.uuid(),
})

const querySchema = z.object({
	slideId: z.uuid().optional(),
	summary: z.enum(['1', 'true']).optional(),
})

const createSchema = z.object({
	slideId: z.uuid(),
	shapeId: z.string().min(1).max(120).optional(),
	parentId: z.uuid().optional(),
	content: z.string().trim().min(1).max(2000),
})

type RouteContext = {
	params: Promise<{ deckId: string }>
}

export async function GET(request: Request, context: RouteContext) {
	const user = await getAuthenticatedUser()
	if (!user) {
		return apiError('Unauthorized', 'UNAUTHORIZED', 401)
	}

	const params = await context.params
	const parsedParams = paramsSchema.safeParse(params)
	if (!parsedParams.success) {
		return apiError('Invalid deck id', 'INVALID_DECK_ID', 400)
	}

	const access = await resolveDeckAccess(parsedParams.data.deckId, user.id)
	if (!access.canView) {
		return apiError('Forbidden', 'FORBIDDEN', 403)
	}

	const url = new URL(request.url)
	const parsedQuery = querySchema.safeParse({
		slideId: url.searchParams.get('slideId') ?? undefined,
		summary: url.searchParams.get('summary') ?? undefined,
	})
	if (!parsedQuery.success) {
		return apiError('Invalid query', 'INVALID_QUERY', 400)
	}

	try {
		if (parsedQuery.data.summary) {
			const summary = await listCommentCountsBySlide(parsedParams.data.deckId)
			return apiOk({ summary })
		}

		if (!parsedQuery.data.slideId) {
			return apiError('Invalid query', 'INVALID_QUERY', 400)
		}

		const items = await listCommentsBySlide(parsedParams.data.deckId, parsedQuery.data.slideId)
		return apiOk({ comments: items })
	} catch {
		return apiError('Failed to load comments', 'LOAD_COMMENTS_FAILED', 500)
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

	const access = await resolveDeckAccess(parsedParams.data.deckId, user.id)
	if (!access.canComment) {
		return apiError('Forbidden', 'FORBIDDEN', 403)
	}

	let payload: unknown
	try {
		payload = await request.json()
	} catch {
		return apiError('Invalid JSON payload', 'INVALID_PAYLOAD', 400)
	}

	const parsedPayload = createSchema.safeParse(payload)
	if (!parsedPayload.success) {
		return apiError('Invalid payload', 'INVALID_PAYLOAD', 400)
	}

	try {
		const comment = await createComment(parsedParams.data.deckId, user.id, parsedPayload.data)
		if (!comment) {
			return apiError('Slide or parent comment not found', 'COMMENT_TARGET_NOT_FOUND', 404)
		}
		return apiOk({ comment }, 201)
	} catch {
		return apiError('Failed to create comment', 'CREATE_COMMENT_FAILED', 500)
	}
}
