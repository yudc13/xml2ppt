import { z } from 'zod'

import { apiError, apiOk } from '@/lib/api/response'
import { listSlideRevisions, verifySlideOwnership } from '@/lib/db/repository'
import { getAuthenticatedUser } from '@/lib/auth/user'

const paramsSchema = z.object({
	slideId: z.uuid(),
})

const querySchema = z.object({
	limit: z.coerce.number().int().min(1).max(200).optional(),
})

type RouteContext = {
	params: Promise<{ slideId: string }>
}

export async function GET(request: Request, context: RouteContext) {
	const user = await getAuthenticatedUser()
	if (!user) {
		return apiError('Unauthorized', 'UNAUTHORIZED', 401)
	}

	const params = await context.params
	const parsedParams = paramsSchema.safeParse(params)
	if (!parsedParams.success) {
		return apiError('Invalid slide id', 'INVALID_SLIDE_ID', 400)
	}

	const isOwner = await verifySlideOwnership(parsedParams.data.slideId, user.id)
	if (!isOwner) {
		return apiError('Slide not found or unauthorized', 'SLIDE_NOT_FOUND', 404)
	}

	const url = new URL(request.url)
	const parsedQuery = querySchema.safeParse({
		limit: url.searchParams.get('limit') ?? undefined,
	})
	if (!parsedQuery.success) {
		return apiError('Invalid query', 'INVALID_QUERY', 400)
	}

	try {
		const revisions = await listSlideRevisions(
			parsedParams.data.slideId,
			parsedQuery.data.limit ?? 50
		)
		return apiOk({ revisions })
	} catch {
		return apiError('Failed to load revisions', 'LOAD_REVISIONS_FAILED', 500)
	}
}
