import { useMutation } from '@tanstack/react-query'
import { requestJson } from '@/features/shared/api/request-json'
import type { AiGenerationResponse, AiShapeEditRequest, AiShapeEditResponse } from '@/lib/ai/types'

export function useGenerateSlides() {
	return useMutation({
		mutationFn: async (prompt: string) => {
			const response = await requestJson<AiGenerationResponse>('/api/ai/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt }),
			})
			return response
		},
	})
}

export function useEditShape() {
	return useMutation({
		mutationFn: async (input: AiShapeEditRequest) => {
			const response = await requestJson<AiShapeEditResponse>('/api/ai/edit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input),
			})
			return response
		},
	})
}
