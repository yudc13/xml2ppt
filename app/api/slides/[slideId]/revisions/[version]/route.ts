import { z } from 'zod'

import { apiError, apiOk } from '@/lib/api/response'
import { getSlideRevision, verifySlideOwnership } from '@/lib/db/repository'
import { getAuthenticatedUser } from '@/lib/auth/user'

const paramsSchema = z.object({
	slideId: z.uuid(),
	version: z.coerce.number().int().min(1),
})

type RouteContext = {
	params: Promise<{ slideId: string; version: string }>
}

export async function GET(_: Request, context: RouteContext) {
	const user = await getAuthenticatedUser()
	if (!user) {
		return apiError('Unauthorized', 'UNAUTHORIZED', 401)
	}

	const params = await context.params
	const parsedParams = paramsSchema.safeParse(params)
	if (!parsedParams.success) {
		return apiError('Invalid params', 'INVALID_PARAMS', 400)
	}

	const isOwner = await verifySlideOwnership(parsedParams.data.slideId, user.id)
	if (!isOwner) {
		return apiError('Slide not found or unauthorized', 'SLIDE_NOT_FOUND', 404)
	}

	try {
		const revision = await getSlideRevision(parsedParams.data.slideId, parsedParams.data.version)
		if (!revision) {
			return apiError('Revision not found', 'REVISION_NOT_FOUND', 404)
		}

		return apiOk({ revision })
	} catch {
		return apiError('Failed to load revision', 'LOAD_REVISION_FAILED', 500)
	}
}
