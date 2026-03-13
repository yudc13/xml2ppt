import { z } from 'zod'

import { apiError, apiOk } from '@/lib/api/response'
import { getAuthenticatedUser } from '@/lib/auth/user'
import { createDeckFromTemplate } from '@/lib/db/repository'

const createFromTemplateSchema = z.object({
	templateId: z.uuid(),
})

export async function POST(request: Request) {
	let payload: unknown
	try {
		payload = await request.json()
	} catch {
		payload = {}
	}

	const parsed = createFromTemplateSchema.safeParse(payload)
	if (!parsed.success) {
		return apiError('Invalid payload', 'INVALID_PAYLOAD', 400)
	}

	const user = await getAuthenticatedUser()
	if (!user) {
		return apiError('Unauthorized', 'UNAUTHORIZED', 401)
	}

	try {
		const result = await createDeckFromTemplate(parsed.data.templateId, user.id)
		if (!result) {
			return apiError('Template not found', 'TEMPLATE_NOT_FOUND', 404)
		}

		return apiOk({ deck: result.deck }, 201)
	} catch {
		return apiError('Failed to create document from template', 'CREATE_FROM_TEMPLATE_FAILED', 500)
	}
}
