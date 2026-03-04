import { listDecks } from "@/lib/db/repository";

import type { DeckItem } from "@/features/deck-list/types";

export async function getDeckList(): Promise<DeckItem[]> {
  const decks = await listDecks();

  return decks.map((deck) => ({
    id: deck.id,
    title: deck.title,
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
  }));
}
