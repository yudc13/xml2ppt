import { DeckListClient } from "@/features/deck-list/components/deck-list-client";
import { getDeckList } from "@/features/deck-list/server/get-deck-list";

export default async function Page() {
  const decks = await getDeckList();

  return <DeckListClient initialDecks={decks} />;
}
