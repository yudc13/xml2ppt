import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'

import { apiError, apiOk } from '@/lib/api/response'
import { deleteSlide, updateSlideContent, verifySlideOwnership } from '@/lib/db/repository'
import { getAuthenticatedUser } from '@/lib/auth/user'

const paramsSchema = z.object({
	slideId: z.uuid(),
})

const saveSlideSchema = z.object({
	version: z.number().int().min(1),
	xmlContent: z.string().min(1),
	reason: z.enum(['manual_save', 'autosave']).optional(),
})

type RouteContext = {
	params: Promise<{ slideId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
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

	let payload: unknown
	try {
		payload = await request.json()
	} catch {
		return apiError('Invalid JSON payload', 'INVALID_PAYLOAD', 400)
	}

	const parsedPayload = saveSlideSchema.safeParse(payload)
	if (!parsedPayload.success) {
		return apiError(
			'Expected payload: { version: number, xmlContent: string }',
			'INVALID_PAYLOAD',
			400
		)
	}

	try {
		const result = await updateSlideContent({
			slideId: parsedParams.data.slideId,
			version: parsedPayload.data.version,
			xmlContent: parsedPayload.data.xmlContent,
			reason: parsedPayload.data.reason,
			actorId: user.id,
		})

		if (result.status === 'not_found') {
			return apiError('Slide not found', 'SLIDE_NOT_FOUND', 404)
		}

		if (result.status === 'conflict') {
			return apiError('Slide version conflict', 'SLIDE_VERSION_CONFLICT', 409)
		}

		return apiOk({ slide: result.slide })
	} catch {
		return apiError('Failed to save slide', 'SAVE_SLIDE_FAILED', 500)
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
		return apiError('Invalid slide id', 'INVALID_SLIDE_ID', 400)
	}

	const isOwner = await verifySlideOwnership(parsedParams.data.slideId, user.id)
	if (!isOwner) {
		return apiError('Slide not found or unauthorized', 'SLIDE_NOT_FOUND', 404)
	}

	try {
		const success = await deleteSlide(parsedParams.data.slideId)
		if (!success) {
			return apiError('Slide not found', 'SLIDE_NOT_FOUND', 404)
		}

		return apiOk({ ok: true })
	} catch {
		return apiError('Failed to delete slide', 'DELETE_SLIDE_FAILED', 500)
	}
}
