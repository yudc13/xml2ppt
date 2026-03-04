"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { requestJson } from "@/features/shared/api/request-json";
import type { DeckItem } from "@/features/deck-list/types";

const DECKS_QUERY_KEY = ["decks"] as const;

export function useDeckList(initialDecks: DeckItem[]) {
  return useQuery({
    queryKey: DECKS_QUERY_KEY,
    queryFn: async () => {
      const response = await requestJson<{ ok: true; decks: DeckItem[] }>("/api/decks");
      return response.decks;
    },
    initialData: initialDecks,
  });
}

export function useCreateDeck() {
  return useMutation({
    mutationFn: async (title: string) => {
      const response = await requestJson<{ ok: true; deck: DeckItem }>("/api/decks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });

      return response.deck;
    },
  });
}
