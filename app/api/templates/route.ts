import { z } from 'zod'

import { apiError, apiOk } from '@/lib/api/response'
import { listPptTemplateScenes, listPptTemplates } from '@/lib/db/repository'

const listTemplatesQuerySchema = z.object({
	scene: z.string().trim().min(1).max(50).optional(),
	page: z.coerce.number().int().min(1).optional(),
	pageSize: z.coerce.number().int().min(1).max(50).optional(),
})

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url)
	const parsed = listTemplatesQuerySchema.safeParse({
		scene: searchParams.get('scene') ?? undefined,
		page: searchParams.get('page') ?? undefined,
		pageSize: searchParams.get('pageSize') ?? undefined,
	})
	if (!parsed.success) {
		return apiError('Invalid query parameters', 'INVALID_QUERY_PARAMS', 400)
	}

	try {
		const page = parsed.data.page ?? 1
		const pageSize = parsed.data.pageSize ?? 24
		const sceneTag = parsed.data.scene
		const [{ templates, total }, scenes] = await Promise.all([
			listPptTemplates({
				sceneTag,
				page,
				pageSize,
			}),
			listPptTemplateScenes(),
		])

		return apiOk({
			templates,
			total,
			page,
			pageSize,
			scenes,
		})
	} catch {
		return apiError('Failed to load templates', 'LOAD_TEMPLATES_FAILED', 500)
	}
}
