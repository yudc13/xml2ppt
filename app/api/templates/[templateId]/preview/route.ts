import { z } from 'zod'

import { apiError, apiOk } from '@/lib/api/response'
import { getPptTemplatePreview } from '@/lib/db/repository'

const paramsSchema = z.object({
	templateId: z.uuid(),
})

type RouteContext = {
	params: Promise<{ templateId: string }>
}

export async function GET(_: Request, context: RouteContext) {
	const params = await context.params
	const parsedParams = paramsSchema.safeParse(params)
	if (!parsedParams.success) {
		return apiError('Invalid template id', 'INVALID_TEMPLATE_ID', 400)
	}

	try {
		const preview = await getPptTemplatePreview(parsedParams.data.templateId)
		if (!preview) {
			return apiError('Template not found', 'TEMPLATE_NOT_FOUND', 404)
		}

		return apiOk({ preview })
	} catch {
		return apiError('Failed to load template preview', 'LOAD_TEMPLATE_PREVIEW_FAILED', 500)
	}
}
