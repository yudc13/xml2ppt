import { z } from 'zod'

import { apiError, apiOk } from '@/lib/api/response'
import { getAuthenticatedUser } from '@/lib/auth/user'
import { canManageShareLink, revokeDeckShareLink } from '@/lib/db/repository'

const paramsSchema = z.object({
	linkId: z.uuid(),
})

type RouteContext = {
	params: Promise<{ linkId: string }>
}

export async function PATCH(_: Request, context: RouteContext) {
	const user = await getAuthenticatedUser()
	if (!user) {
		return apiError('Unauthorized', 'UNAUTHORIZED', 401)
	}

	const params = await context.params
	const parsedParams = paramsSchema.safeParse(params)
	if (!parsedParams.success) {
		return apiError('Invalid share link id', 'INVALID_SHARE_LINK_ID', 400)
	}

	const manageable = await canManageShareLink(parsedParams.data.linkId, user.id)
	if (!manageable) {
		return apiError('Forbidden', 'FORBIDDEN', 403)
	}

	try {
		const revoked = await revokeDeckShareLink(parsedParams.data.linkId)
		if (!revoked) {
			return apiError('Share link not found', 'SHARE_LINK_NOT_FOUND', 404)
		}

		return apiOk({ ok: true })
	} catch {
		return apiError('Failed to revoke share link', 'REVOKE_SHARE_LINK_FAILED', 500)
	}
}
