import { z } from 'zod'

import { apiError, apiOk } from '@/lib/api/response'
import { getAuthenticatedUser } from '@/lib/auth/user'
import { getSlideAccessRole, getSlideRevision } from '@/lib/db/repository'
import { buildSlideDiff } from '@/lib/slide-xml/diff'

const paramsSchema = z.object({
	slideId: z.uuid(),
})

const querySchema = z
	.object({
		from: z.coerce.number().int().min(1),
		to: z.coerce.number().int().min(1),
	})
	.refine((value) => value.from !== value.to, {
		message: 'from and to must be different',
		path: ['to'],
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

	const access = await getSlideAccessRole(parsedParams.data.slideId, user.id)
	if (!access) {
		return apiError('Slide not found or unauthorized', 'SLIDE_NOT_FOUND', 404)
	}

	const url = new URL(request.url)
	const parsedQuery = querySchema.safeParse({
		from: url.searchParams.get('from') ?? undefined,
		to: url.searchParams.get('to') ?? undefined,
	})
	if (!parsedQuery.success) {
		return apiError('Invalid query', 'INVALID_QUERY', 400)
	}

	try {
		const fromRevision = await getSlideRevision(parsedParams.data.slideId, parsedQuery.data.from)
		if (!fromRevision) {
			return apiError('From revision not found', 'FROM_REVISION_NOT_FOUND', 404)
		}

		const toRevision = await getSlideRevision(parsedParams.data.slideId, parsedQuery.data.to)
		if (!toRevision) {
			return apiError('To revision not found', 'TO_REVISION_NOT_FOUND', 404)
		}

		const diff = buildSlideDiff({
			fromXml: fromRevision.xmlContent,
			toXml: toRevision.xmlContent,
			fromVersion: parsedQuery.data.from,
			toVersion: parsedQuery.data.to,
		})

		return apiOk({ diff })
	} catch {
		return apiError('Failed to build slide diff', 'BUILD_SLIDE_DIFF_FAILED', 500)
	}
}
