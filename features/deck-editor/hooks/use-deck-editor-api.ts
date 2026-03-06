'use client'

import { useMutation } from '@tanstack/react-query'

import { ApiRequestError, requestJson } from '@/features/shared/api/request-json'
import type { DeckEntity, PersistedSlide, SlideRevisionEntity } from '@/features/deck-editor/types'

export { ApiRequestError }

export function useUpdateDeckTitle(deckId: string) {
	return useMutation({
		mutationFn: async (title: string) => {
			const response = await requestJson<{ ok: true; deck: DeckEntity }>(`/api/decks/${deckId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ title }),
			})

			return response.deck
		},
	})
}

export function useGetSlides(deckId: string) {
	return useMutation({
		mutationFn: async () => {
			const response = await requestJson<{ ok: true; slides: PersistedSlide[] }>(
				`/api/decks/${deckId}/slides`
			)
			return response.slides
		},
	})
}

export function useCreateSlide(deckId: string) {
	return useMutation({
		mutationFn: async (input?: { xmlContent?: string; position?: number }) => {
			const response = await requestJson<{ ok: true; slide: PersistedSlide }>(
				`/api/decks/${deckId}/slides`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(input ?? {}),
				}
			)

			return response.slide
		},
	})
}

export function useDeleteSlide() {
	return useMutation({
		mutationFn: async (slideId: string) => {
			await requestJson<{ ok: true }>(`/api/slides/${slideId}`, {
				method: 'DELETE',
			})
		},
	})
}

export function useSaveSlide() {
	return useMutation({
		mutationFn: async (input: {
			slideId: string
			version: number
			xmlContent: string
			reason: 'manual_save' | 'autosave'
		}) => {
			const response = await requestJson<{ ok: true; slide: PersistedSlide }>(
				`/api/slides/${input.slideId}`,
				{
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						version: input.version,
						xmlContent: input.xmlContent,
						reason: input.reason,
					}),
				}
			)

			return response.slide
		},
	})
}

export function useLoadRevisions() {
	return useMutation({
		mutationFn: async (slideId: string) => {
			const response = await requestJson<{ ok: true; revisions: SlideRevisionEntity[] }>(
				`/api/slides/${slideId}/revisions?limit=100`
			)

			return response.revisions
		},
	})
}

export function useGetRevision() {
	return useMutation({
		mutationFn: async (input: { slideId: string; version: number }) => {
			const response = await requestJson<{ ok: true; revision: SlideRevisionEntity }>(
				`/api/slides/${input.slideId}/revisions/${input.version}`
			)

			return response.revision
		},
	})
}

export function useRollbackSlide() {
	return useMutation({
		mutationFn: async (input: {
			slideId: string
			targetVersion: number
			currentVersion: number
		}) => {
			const response = await requestJson<{ ok: true; slide: PersistedSlide }>(
				`/api/slides/${input.slideId}/rollback`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						targetVersion: input.targetVersion,
						currentVersion: input.currentVersion,
					}),
				}
			)

			return response.slide
		},
	})
}
