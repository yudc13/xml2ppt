import { DeckListClient } from "@/features/deck-list/components/deck-list-client";
import { getDeckList } from "@/features/deck-list/server/get-deck-list";
import { getHomeTemplates } from "@/features/template/server/get-home-templates";

export default async function Page() {
  const [decks, homeTemplates] = await Promise.all([getDeckList(), getHomeTemplates(8)]);

  return <DeckListClient initialDecks={decks} initialHomeTemplates={homeTemplates} />;
}
