import { listHomePptTemplates } from '@/lib/db/repository'

import type { TemplateItem } from '@/features/template/types'

export async function getHomeTemplates(limit = 8): Promise<TemplateItem[]> {
	try {
		const templates = await listHomePptTemplates(limit)
		return templates.map((template) => ({
			id: template.id,
			title: template.title,
			slug: template.slug,
			coverUrl: template.coverUrl,
			sceneTag: template.sceneTag,
			lang: template.lang,
			ratio: template.ratio,
			isFree: template.isFree,
			sortOrder: template.sortOrder,
		}))
	} catch {
		return []
	}
}
