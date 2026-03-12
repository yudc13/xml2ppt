'use client'

import { useMutation } from '@tanstack/react-query'

import { requestJson } from '@/features/shared/api/request-json'
import type { DeckShareLinkEntity, SharePermission } from '@/features/deck-editor/types'

export function useCreateShareLink(deckId: string) {
	return useMutation({
		mutationFn: async (input: { permission: SharePermission; expiresAt?: string }) => {
			const response = await requestJson<{
				ok: true
				link: DeckShareLinkEntity
				shareUrl: string
			}>(`/api/decks/${deckId}/share-links`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(input),
			})

			return response
		},
	})
}

export function useListShareLinks(deckId: string) {
	return useMutation({
		mutationFn: async () => {
			const response = await requestJson<{ ok: true; links: DeckShareLinkEntity[] }>(
				`/api/decks/${deckId}/share-links`
			)

			return response.links
		},
	})
}

export function useRevokeShareLink() {
	return useMutation({
		mutationFn: async (linkId: string) => {
			await requestJson<{ ok: true }>(`/api/share-links/${linkId}/revoke`, {
				method: 'PATCH',
			})
		},
	})
}
