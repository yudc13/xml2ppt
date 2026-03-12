'use client'

import { useMutation } from '@tanstack/react-query'

import { requestJson } from '@/features/shared/api/request-json'
import type { CommentEntity } from '@/features/deck-editor/types'

export function useListComments(deckId: string) {
	return useMutation({
		mutationFn: async (slideId: string) => {
			const response = await requestJson<{ ok: true; comments: CommentEntity[] }>(
				`/api/decks/${deckId}/comments?slideId=${encodeURIComponent(slideId)}`
			)
			return response.comments
		},
	})
}

export function useCreateComment(deckId: string) {
	return useMutation({
		mutationFn: async (input: {
			slideId: string
			shapeId?: string
			parentId?: string
			content: string
		}) => {
			const response = await requestJson<{ ok: true; comment: CommentEntity }>(
				`/api/decks/${deckId}/comments`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(input),
				}
			)
			return response.comment
		},
	})
}

export function useResolveComment() {
	return useMutation({
		mutationFn: async (input: { commentId: string; resolved: boolean }) => {
			const response = await requestJson<{ ok: true; comment: CommentEntity }>(
				`/api/comments/${input.commentId}/resolve`,
				{
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ resolved: input.resolved }),
				}
			)
			return response.comment
		},
	})
}

export function useDeleteComment() {
	return useMutation({
		mutationFn: async (commentId: string) => {
			await requestJson<{ ok: true }>(`/api/comments/${commentId}`, {
				method: 'DELETE',
			})
		},
	})
}
