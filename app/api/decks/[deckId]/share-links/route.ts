import { z } from 'zod'

import { apiError, apiOk } from '@/lib/api/response'
import { resolveDeckAccess } from '@/lib/auth/deck-access'
import { getAuthenticatedUser } from '@/lib/auth/user'
import { createDeckShareLink, listDeckShareLinks } from '@/lib/db/repository'

const paramsSchema = z.object({
	deckId: z.uuid(),
})

const createSchema = z.object({
	permission: z.enum(['viewer', 'commenter', 'editor']),
	expiresAt: z.string().datetime().optional(),
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

	const access = await resolveDeckAccess(parsedParams.data.deckId, user.id)
	if (!access.canEdit) {
		return apiError('Forbidden', 'FORBIDDEN', 403)
	}

	try {
		const links = await listDeckShareLinks(parsedParams.data.deckId)
		return apiOk({
			links: links.map((link) => ({
				id: link.id,
				deckId: link.deckId,
				permission: link.permission,
				expiresAt: link.expiresAt,
				revokedAt: link.revokedAt,
				createdBy: link.createdBy,
				createdAt: link.createdAt,
			})),
		})
	} catch {
		return apiError('Failed to load share links', 'LOAD_SHARE_LINKS_FAILED', 500)
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
	if (!access.canEdit) {
		return apiError('Forbidden', 'FORBIDDEN', 403)
	}

	let payload: unknown
	try {
		payload = await request.json()
	} catch {
		payload = {}
	}

	const parsedPayload = createSchema.safeParse(payload)
	if (!parsedPayload.success) {
		return apiError('Invalid payload', 'INVALID_PAYLOAD', 400)
	}

	try {
		const created = await createDeckShareLink(parsedParams.data.deckId, user.id, parsedPayload.data)
		return apiOk(
			{
				link: {
					id: created.link.id,
					deckId: created.link.deckId,
					permission: created.link.permission,
					expiresAt: created.link.expiresAt,
					revokedAt: created.link.revokedAt,
					createdBy: created.link.createdBy,
					createdAt: created.link.createdAt,
				},
				shareUrl: created.shareUrl,
			},
			201
		)
	} catch {
		return apiError('Failed to create share link', 'CREATE_SHARE_LINK_FAILED', 500)
	}
}
