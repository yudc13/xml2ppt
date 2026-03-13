import { apiError, apiOk } from '@/lib/api/response'
import { listHomePptTemplates } from '@/lib/db/repository'

export async function GET() {
	try {
		const templates = await listHomePptTemplates(8)
		return apiOk({ templates })
	} catch {
		return apiError('Failed to load home templates', 'LOAD_HOME_TEMPLATES_FAILED', 500)
	}
}
