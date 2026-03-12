import { z } from 'zod'

import { apiError, apiOk } from '@/lib/api/response'
import { getAuthenticatedUser } from '@/lib/auth/user'
import { softDeleteComment, updateComment, verifyCommentPermission } from '@/lib/db/repository'

const paramsSchema = z.object({
	commentId: z.uuid(),
})

const patchSchema = z.object({
	content: z.string().trim().min(1).max(2000).optional(),
	status: z.enum(['open', 'resolved']).optional(),
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

	const parsedPayload = patchSchema.safeParse(payload)
	if (!parsedPayload.success || !parsedPayload.data.content) {
		return apiError('Expected payload: { content: string }', 'INVALID_PAYLOAD', 400)
	}

	const allowed = await verifyCommentPermission(parsedParams.data.commentId, user.id, 'edit')
	if (!allowed) {
		return apiError('Forbidden', 'FORBIDDEN', 403)
	}

	try {
		const comment = await updateComment(parsedParams.data.commentId, {
			content: parsedPayload.data.content,
		})
		if (!comment) {
			return apiError('Comment not found', 'COMMENT_NOT_FOUND', 404)
		}

		return apiOk({ comment })
	} catch {
		return apiError('Failed to update comment', 'UPDATE_COMMENT_FAILED', 500)
	}
}

export async function DELETE(_: Request, context: RouteContext) {
	const user = await getAuthenticatedUser()
	if (!user) {
		return apiError('Unauthorized', 'UNAUTHORIZED', 401)
	}

	const params = await context.params
	const parsedParams = paramsSchema.safeParse(params)
	if (!parsedParams.success) {
		return apiError('Invalid comment id', 'INVALID_COMMENT_ID', 400)
	}

	const allowed = await verifyCommentPermission(parsedParams.data.commentId, user.id, 'delete')
	if (!allowed) {
		return apiError('Forbidden', 'FORBIDDEN', 403)
	}

	try {
		const deleted = await softDeleteComment(parsedParams.data.commentId)
		if (!deleted) {
			return apiError('Comment not found', 'COMMENT_NOT_FOUND', 404)
		}
		return apiOk({ ok: true })
	} catch {
		return apiError('Failed to delete comment', 'DELETE_COMMENT_FAILED', 500)
	}
}
