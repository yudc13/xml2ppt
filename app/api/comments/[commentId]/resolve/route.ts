import { z } from 'zod'

import { apiError, apiOk } from '@/lib/api/response'
import { getAuthenticatedUser } from '@/lib/auth/user'
import { updateComment, verifyCommentPermission } from '@/lib/db/repository'

const paramsSchema = z.object({
	commentId: z.uuid(),
})

const payloadSchema = z.object({
	resolved: z.boolean(),
})

type RouteContext = {
	params: Promise<{ commentId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
	const user = await getAuthenticatedUser()
	if (!user) {
		return apiError('Unauthorized', 'UNAUTHORIZED', 401)
	}

	const params = await context.params
	const parsedParams = paramsSchema.safeParse(params)
	if (!parsedParams.success) {
		return apiError('Invalid comment id', 'INVALID_COMMENT_ID', 400)
	}

	let payload: unknown
	try {
		payload = await request.json()
	} catch {
		return apiError('Invalid JSON payload', 'INVALID_PAYLOAD', 400)
	}

	const parsedPayload = payloadSchema.safeParse(payload)
	if (!parsedPayload.success) {
		return apiError('Expected payload: { resolved: boolean }', 'INVALID_PAYLOAD', 400)
	}

	const allowed = await verifyCommentPermission(parsedParams.data.commentId, user.id, 'resolve')
	if (!allowed) {
		return apiError('Forbidden', 'FORBIDDEN', 403)
	}

	try {
		const comment = await updateComment(parsedParams.data.commentId, {
			status: parsedPayload.data.resolved ? 'resolved' : 'open',
		})
		if (!comment) {
			return apiError('Comment not found', 'COMMENT_NOT_FOUND', 404)
		}

		return apiOk({ comment })
	} catch {
		return apiError('Failed to resolve comment', 'RESOLVE_COMMENT_FAILED', 500)
	}
}
