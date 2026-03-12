'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { requestJson } from '@/features/shared/api/request-json'
import type { CommentEntity } from '@/features/deck-editor/types'

function commentsQueryKey(deckId: string, slideId: string) {
	return ['deck-comments', deckId, slideId] as const
}

function commentsSummaryQueryKey(deckId: string) {
	return ['deck-comments-summary', deckId] as const
}

export function useListComments(deckId: string, slideId?: string) {
	return useSlideComments(deckId, slideId)
}

export function useDeckCommentCounts(deckId: string) {
	return useQuery({
		queryKey: commentsSummaryQueryKey(deckId),
		refetchInterval: 15_000,
		queryFn: async () => {
			const response = await requestJson<{
				ok: true
				summary: Array<{ slideId: string; count: number }>
			}>(`/api/decks/${deckId}/comments?summary=1`)
			return response.summary
		},
	})
}

export function useSlideComments(deckId: string, slideId?: string) {
	return useQuery({
		queryKey: commentsQueryKey(deckId, slideId ?? ''),
		enabled: !!slideId,
		refetchInterval: 12_000,
		queryFn: async () => {
			const response = await requestJson<{ ok: true; comments: CommentEntity[] }>(
				`/api/decks/${deckId}/comments?slideId=${encodeURIComponent(slideId ?? '')}`
			)
			return response.comments
		},
	})
}

export function useCreateComment(deckId: string) {
	const queryClient = useQueryClient()
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
		onSuccess: async (comment) => {
			await queryClient.invalidateQueries({
				queryKey: commentsQueryKey(deckId, comment.slideId),
			})
			await queryClient.invalidateQueries({
				queryKey: commentsSummaryQueryKey(deckId),
			})
		},
	})
}

export function useUpdateComment(deckId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: { commentId: string; content: string; slideId: string }) => {
			const response = await requestJson<{ ok: true; comment: CommentEntity }>(
				`/api/comments/${input.commentId}`,
				{
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ content: input.content }),
				}
			)
			return response.comment
		},
		onSuccess: async (comment) => {
			await queryClient.invalidateQueries({
				queryKey: commentsQueryKey(deckId, comment.slideId),
			})
			await queryClient.invalidateQueries({
				queryKey: commentsSummaryQueryKey(deckId),
			})
		},
	})
}

export function useResolveComment(deckId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: { commentId: string; resolved: boolean; slideId: string }) => {
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
		onSuccess: async (comment) => {
			await queryClient.invalidateQueries({
				queryKey: commentsQueryKey(deckId, comment.slideId),
			})
			await queryClient.invalidateQueries({
				queryKey: commentsSummaryQueryKey(deckId),
			})
		},
	})
}

export function useDeleteComment(deckId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: { commentId: string; slideId: string }) => {
			await requestJson<{ ok: true }>(`/api/comments/${input.commentId}`, {
				method: 'DELETE',
			})
		},
		onSuccess: async (_, variables) => {
			await queryClient.invalidateQueries({
				queryKey: commentsQueryKey(deckId, variables.slideId),
			})
			await queryClient.invalidateQueries({
				queryKey: commentsSummaryQueryKey(deckId),
			})
		},
	})
}
